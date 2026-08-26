import Link from "next/link";

import { ClipboardList, Truck } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { EventCalendar } from "./_components/calendar";
import { dispatchEvents, officeEvents } from "./_components/events-data";

interface PageProps {
  searchParams: Promise<{ view?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { view } = await searchParams;
  const activeView = view === "office" ? "office" : "dispatch";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading font-semibold text-xl tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm">
            {activeView === "dispatch"
              ? "Jobs and in-home surveys on the dispatch schedule."
              : "Internal meetings, maintenance, and deadlines."}
          </p>
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={activeView}
          aria-label="Calendar view"
        >
          <ToggleGroupItem value="dispatch" asChild>
            <Link href="?view=dispatch" replace scroll={false}>
              <Truck />
              Dispatch
            </Link>
          </ToggleGroupItem>
          <ToggleGroupItem value="office" asChild>
            <Link href="?view=office" replace scroll={false}>
              <ClipboardList />
              Office
            </Link>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {activeView === "dispatch" ? (
        <EventCalendar key="dispatch" events={dispatchEvents} addLabel="Add job" />
      ) : (
        <EventCalendar key="office" events={officeEvents} addLabel="Add event" />
      )}
    </div>
  );
}
