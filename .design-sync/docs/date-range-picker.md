---
category: Calendar
---

A calendar range picker in a popover, wired to a button that shows the selected span. Use it for report filters and move windows.

It is controlled: pass `value` and handle `onChange`.

## Examples

```tsx
import { DateRangePicker } from "@/components/date-range-picker";

export function Default() {
  return (
    <div className="w-full max-w-sm">
      <DateRangePicker
        value={{ from: new Date(2026, 2, 16), to: new Date(2026, 2, 20) }}
      />
    </div>
  );
}
```
