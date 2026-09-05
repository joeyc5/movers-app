---
category: Calendar
---

The date picker, built on React DayPicker. `mode="single"` selects one day; `mode="range"` selects a span.

Set `defaultMonth` when the selection is not in the current month, or the picker opens on today.

## Parts

Composed with `CalendarDayButton`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Calendar } from "@/components/ui/calendar";

export function SingleDay() {
  return (
    <Calendar
      mode="single"
      defaultMonth={new Date(2026, 2, 1)}
      selected={new Date(2026, 2, 17)}
      className="border-border rounded-md border"
    />
  );
}

export function MoveWindow() {
  return (
    <Calendar
      mode="range"
      defaultMonth={new Date(2026, 2, 1)}
      selected={{ from: new Date(2026, 2, 16), to: new Date(2026, 2, 20) }}
      className="border-border rounded-md border"
    />
  );
}
```
