import "server-only";

import { cache } from "react";

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
