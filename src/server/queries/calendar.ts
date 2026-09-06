import "server-only";

import { cache } from "react";

import { getCurrentStaff } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Calendar data access.
 *
 * One table now holds both dispatch (job/survey) and office events; they were
 * two unrelated shapes before, and office events had no id, no status and no
 * extendedProps at all.
 *
 * `color` is deliberately not stored or selected. It is derived from
 * entity_type here, in the mapper, because it is a design token — storing it
 * would turn a theme change into a data migration.
 */

export type CalendarEntityType = "job" | "survey" | "office";
export type JobStatus = "Scheduled" | "In Progress" | "Completed" | "Delayed" | "On Hold" | "Canceled";

const COLOR_BY_TYPE: Record<CalendarEntityType, string> = {
  job: "var(--chart-2)",
  survey: "var(--chart-4)",
  office: "var(--chart-1)",
};

/** The shape FullCalendar's EventInput wants, with our data under extendedProps. */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  color: string;
  extendedProps: {
    entityType: CalendarEntityType;
    status: JobStatus | null;
    clientName: string | null;
    clientCode: string | null;
    address: string | null;
    crew: string[];
    estimator: string | null;
    notes: string | null;
    warehouseLocation: string | null;
  };
}

const EVENT_COLUMNS = `
  code, entity_type, title, starts_at, ends_at, all_day, status,
  client_name, client_code, estimator_name, address_line, notes,
  warehouse_location_name, crew
`;

async function loadEvents(types: CalendarEntityType[]): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events_expanded")
    .select(EVENT_COLUMNS)
    .in("entity_type", types)
    .order("starts_at", { ascending: true });

  if (error) throw new Error(`Failed to load calendar events: ${error.message}`);

  return (data ?? []).map((row) => {
    const entityType = row.entity_type as CalendarEntityType;
    return {
      id: row.code as string,
      title: row.title as string,
      start: row.starts_at as string,
      end: (row.ends_at as string | null) ?? undefined,
      allDay: Boolean(row.all_day),
      color: COLOR_BY_TYPE[entityType],
      extendedProps: {
        entityType,
        status: (row.status as JobStatus | null) ?? null,
        clientName: (row.client_name as string | null) ?? null,
        clientCode: (row.client_code as string | null) ?? null,
        address: (row.address_line as string | null) ?? null,
        // Order is meaningful: the crew lead is listed first, preserved through
        // calendar_event_crew.position.
        crew: (row.crew as string[]) ?? [],
        // Never filtered by staff.status — one seeded survey's estimator is
        // Deactivated and would otherwise lose her name.
        estimator: (row.estimator_name as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        warehouseLocation: (row.warehouse_location_name as string | null) ?? null,
      },
    };
  });
}

export const getDispatchEvents = cache(() => loadEvents(["job", "survey"]));
export const getOfficeEvents = cache(() => loadEvents(["office"]));

// ---------------------------------------------------------------------
// Options and permissions for the scheduling dialogs.
// ---------------------------------------------------------------------

export interface StaffOption {
  id: string;
  name: string;
  team: string;
  active: boolean;
}

/**
 * Staff for the estimator and crew selects. Deactivated staff are included and
 * marked, never dropped: one seeded survey's estimator is Deactivated, and
 * hiding her would blank the field the moment that event is edited.
 */
export const getStaffOptions = cache(async (): Promise<StaffOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name, team, status")
    .order("full_name", { ascending: true });

  if (error) throw new Error(`Failed to load staff: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.full_name as string,
    team: row.team as string,
    active: row.status === "Active",
  }));
});

export interface WarehouseLocationOption {
  id: string;
  name: string;
}

/** The active facilities, in the dispatch dropdown's own order (Oakland, San Jose, Fremont). */
export const getWarehouseLocationOptions = cache(async (): Promise<WarehouseLocationOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouse_locations")
    .select("id, name, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to load warehouse locations: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id as string, name: row.name as string }));
});

/**
 * The current company's IANA timezone, used to turn a wall-clock time typed into
 * the dialog into a real instant. companies_select scopes the read to the
 * caller's own company, so an unfiltered select returns exactly that one row.
 * Falls back to the column default rather than throwing on a silent zero-row read.
 */
export const getCompanyTimezone = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").select("timezone").maybeSingle();
  if (error || !data?.timezone) return "America/Los_Angeles";
  return data.timezone;
});

/**
 * Mirrors app.has_any_perm(['calendar','dispatch','jobs'], true) read-side, so the
 * page omits write affordances the database would reject. RLS is the enforcement;
 * this only decides what to render. Same shape as canWriteQuotes in queries/quotes.ts.
 */
export const canWriteCalendar = cache(async (): Promise<boolean> => {
  const staff = await getCurrentStaff();
  if (!staff || staff.status !== "Active") return false;

  const level = staff.role?.access_level;
  if (level === "Read only") return false;
  if (level === "Full") return true;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_permission_sets")
    .select("permission_set:permission_set_id!inner ( slug )")
    .eq("role_id", staff.role_id)
    .in("permission_set.slug", ["calendar", "dispatch", "jobs"])
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
});
