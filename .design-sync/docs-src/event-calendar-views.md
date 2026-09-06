The scheduling calendar, built on FullCalendar. It needs a `controller` from
`useCalendarController`, the view plugins it will render, and a
`popoverCloseContent` render function.

Load a plugin for every view you name: `dayGridPlugin` for month,
`timeGridPlugin` for week and day, `listPlugin` for the agenda. A view without
its plugin throws at mount.

Its preview card is the typographic floor card, not a render. FullCalendar's
plugin classes and the copy of core compiled into this bundle are separate
module instances, so a preview that imports the plugins itself throws
`Class constructor DayGridView cannot be invoked without 'new'`. The component
works normally in the app, where both come from the same install.

## Examples

```tsx
import { useCalendarController } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { XIcon } from "lucide-react";

import { EventCalendarViews } from "@/components/calendar/event-calendar-views";

const events = [
  { id: "1", title: "Acme survey", start: "2026-03-16T09:00:00", end: "2026-03-16T11:00:00" },
  { id: "2", title: "Beckett load", start: "2026-03-18T08:00:00", end: "2026-03-18T15:00:00" },
];

export function Schedule() {
  const controller = useCalendarController({ initialDate: "2026-03-16" });

  return (
    <div className="h-96 w-full">
      <EventCalendarViews
        controller={controller}
        initialView="dayGridMonth"
        plugins={[dayGridPlugin, timeGridPlugin]}
        popoverCloseContent={() => <XIcon className="text-muted-foreground size-5" />}
        events={events}
        height="100%"
      />
    </div>
  );
}
```
