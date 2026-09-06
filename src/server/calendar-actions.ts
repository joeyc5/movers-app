"use server";

import { revalidatePath } from "next/cache";

import { Temporal } from "temporal-polyfill";
import { z } from "zod";

import { requireAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getCompanyTimezone } from "@/server/queries/calendar";

/**
 * Calendar mutations. Every action runs as the signed-in staff member, so RLS
 * (has_any_perm(['calendar','dispatch','jobs'], true)) is the real gate. Actions
 * return { error } instead of throwing: an RLS denial or a check-constraint
 * violation is an expected outcome the dialog must show, not a crash.
 *
 * Instants: a job at "8:00 AM" means 8:00 in the company's own timezone, so the
 * dialog collects wall-clock date and time and this file resolves them to a real
 * UTC instant here. FullCalendar runs in the browser's local zone (no named-tz
 * plugin is installed), so a dragged event already carries a true instant and is
 * stored verbatim.
 */

export type CalendarActionResult = { error: string } | { error?: undefined };

function failure(prefix: string, message: string): CalendarActionResult {
  return { error: `${prefix}: ${message}` };
}

const CALENDAR_PATH = "/dashboard/calendar";

const EVENT_STATUSES = ["Scheduled", "In Progress", "Completed", "Delayed", "On Hold", "Canceled"] as const;

const TIME = /^\d{2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A wall-clock time in the company zone, as a UTC instant string Postgres accepts. */
function timedInstant(date: string, time: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime(timeZone).toInstant().toString();
}

/** Local midnight of a date in the company zone, as a UTC instant string. */
function dayStartInstant(date: string, timeZone: string): string {
  return Temporal.PlainDate.from(date).toZonedDateTime(timeZone).toInstant().toString();
}

/** Turns a check-constraint or RLS error into copy a dispatcher can act on. */
function explain(message: string): string {
  if (message.includes("end_after_start")) return "The end time has to be after the start time.";
  if (message.includes("shape_check")) return "A job or survey needs a status; an office event cannot have one.";
  if (message.includes("office_has_no_client")) return "An office event cannot be tied to a client.";
  if (message.includes("title_not_blank")) return "Give the event a title.";
  if (message.includes("row-level security") || message.includes("42501")) {
    return "You do not have permission to change the schedule.";
  }
  return message;
}

const createSchema = z
  .object({
    kind: z.enum(["job", "survey", "office"]),
    title: z.string().trim().min(1, "Give the event a title."),
    date: z.string().regex(DATE, "Pick a date."),
    allDay: z.boolean(),
    startTime: z.string().regex(TIME).optional(),
    endTime: z.string().regex(TIME).optional().or(z.literal("")),
    endDate: z.string().regex(DATE).optional().or(z.literal("")),
    status: z.enum(EVENT_STATUSES).optional(),
    clientCode: z.string().trim().min(1).optional().or(z.literal("")),
    estimatorId: z.string().uuid().optional().or(z.literal("")),
    warehouseLocationId: z.string().uuid().optional().or(z.literal("")),
    addressLine: z.string().trim().optional().or(z.literal("")),
    notes: z.string().trim().optional().or(z.literal("")),
    crewIds: z.array(z.string().uuid()).optional(),
  })
  .refine((v) => v.allDay || (v.startTime && TIME.test(v.startTime)), {
    message: "Pick a start time.",
    path: ["startTime"],
  })
  .refine((v) => v.kind === "office" || v.status !== undefined, {
    message: "Pick a status.",
    path: ["status"],
  });

export type CreateEventInput = z.input<typeof createSchema>;

export async function createEvent(input: CreateEventInput): Promise<CalendarActionResult> {
  await requireAuth();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Could not schedule the event", parsed.error.issues[0]?.message ?? "check the form");
  }
  const v = parsed.data;
  const supabase = await createClient();
  const timeZone = await getCompanyTimezone();

  let starts_at: string;
  let ends_at: string | null;
  try {
    if (v.allDay) {
      starts_at = dayStartInstant(v.date, timeZone);
      // FullCalendar's all-day end is exclusive: a single day ends at the next
      // local midnight, which is also what ends_at > starts_at requires.
      const lastDay = v.endDate && v.endDate.length > 0 ? v.endDate : v.date;
      const endExclusive = Temporal.PlainDate.from(lastDay).add({ days: 1 }).toString();
      ends_at = dayStartInstant(endExclusive, timeZone);
    } else {
      starts_at = timedInstant(v.date, v.startTime as string, timeZone);
      ends_at = v.endTime && v.endTime.length > 0 ? timedInstant(v.date, v.endTime, timeZone) : null;
    }
  } catch {
    return failure("Could not schedule the event", "that date or time is not valid");
  }

  if (ends_at && ends_at <= starts_at) {
    return failure("Could not schedule the event", "the end time has to be after the start time");
  }

  // Resolve the human client code to its id; the UI never handles uuids.
  let client_id: string | null = null;
  if (v.kind !== "office" && v.clientCode && v.clientCode.length > 0) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("code", v.clientCode)
      .maybeSingle();
    if (clientError) return failure("Could not schedule the event", clientError.message);
    if (!client) return failure("Could not schedule the event", `no client matches ${v.clientCode}`);
    client_id = client.id;
  }

  // rpc-then-insert is two round trips, not one transaction: an abandoned insert
  // burns a number. Same trade as createQuote. Blocked until 0024 applies.
  const { data: code, error: codeError } = await supabase.rpc("next_event_code", { p_kind: v.kind });
  if (codeError || !code) {
    return failure("Could not schedule the event", codeError?.message ?? "an event number was not issued");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("calendar_events")
    .insert({
      code,
      entity_type: v.kind,
      title: v.title,
      starts_at,
      ends_at,
      all_day: v.allDay,
      status: v.kind === "office" ? null : (v.status ?? null),
      client_id,
      estimator_id: v.estimatorId && v.estimatorId.length > 0 ? v.estimatorId : null,
      warehouse_location_id: v.warehouseLocationId && v.warehouseLocationId.length > 0 ? v.warehouseLocationId : null,
      address_line: v.addressLine && v.addressLine.length > 0 ? v.addressLine : null,
      notes: v.notes && v.notes.length > 0 ? v.notes : null,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return failure("Could not schedule the event", explain(insertError?.message ?? "the event was not created"));
  }

  const crewIds = v.crewIds ?? [];
  if (crewIds.length > 0) {
    const rows = crewIds.map((staff_id, position) => ({ calendar_event_id: inserted.id, staff_id, position }));
    const { error: crewError } = await supabase.from("calendar_event_crew").insert(rows);
    if (crewError) {
      // The event exists; only the roster failed. Report it without pretending
      // the whole booking was lost.
      revalidatePath(CALENDAR_PATH);
      return failure("Scheduled, but the crew was not saved", explain(crewError.message));
    }
  }

  revalidatePath(CALENDAR_PATH);
  return {};
}

const statusSchema = z.object({
  code: z.string().trim().min(1),
  status: z.enum(EVENT_STATUSES),
});

export async function updateEventStatus(code: string, status: string): Promise<CalendarActionResult> {
  await requireAuth();
  const parsed = statusSchema.safeParse({ code, status });
  if (!parsed.success) return failure("Could not update the status", "that status is not valid");

  const supabase = await createClient();
  // entity_type stays out of the payload, so tg_calendar_events_protect_job_type
  // (before update OF entity_type) never fires. Office rows carry no status, so
  // they are filtered out rather than pushed into a shape-check violation.
  const { error } = await supabase
    .from("calendar_events")
    .update({ status: parsed.data.status })
    .eq("code", parsed.data.code)
    .in("entity_type", ["job", "survey"]);

  if (error) return failure("Could not update the status", explain(error.message));
  revalidatePath(CALENDAR_PATH);
  return {};
}

const rescheduleSchema = z.object({
  code: z.string().trim().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  allDay: z.boolean(),
});

export async function rescheduleEvent(input: {
  code: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
}): Promise<CalendarActionResult> {
  await requireAuth();
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return failure("Could not reschedule", "the new time is not valid");
  const v = parsed.data;

  if (v.endsAt && v.endsAt <= v.startsAt) {
    return failure("Could not reschedule", "the end time has to be after the start time");
  }

  const supabase = await createClient();
  // entity_type is never in the payload, so the job-type guard cannot fire.
  const { error } = await supabase
    .from("calendar_events")
    .update({ starts_at: v.startsAt, ends_at: v.endsAt, all_day: v.allDay })
    .eq("code", v.code);

  if (error) return failure("Could not reschedule", explain(error.message));
  revalidatePath(CALENDAR_PATH);
  return {};
}
