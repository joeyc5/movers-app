---
category: Data
---

A determinate progress bar. `value` runs from 0 to 100.

Put the percentage in a label beside the bar; the bar alone does not give a number.

## Examples

```tsx
import { Progress } from "@/components/ui/progress";

export function Values() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span>Inventory catalogued</span>
          <span className="text-muted-foreground tabular-nums">32%</span>
        </div>
        <Progress value={32} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span>Load complete</span>
          <span className="text-muted-foreground tabular-nums">78%</span>
        </div>
        <Progress value={78} />
      </div>
    </div>
  );
}
```
