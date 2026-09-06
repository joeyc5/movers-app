---
category: Forms
---

Picks a number or a range along a track. Pass an array to `defaultValue`: one entry for a single thumb, two for a range.

Show the current value next to the slider; the track alone does not tell the user where they are.

## Examples

```tsx
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export function Default() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Label>Estimated crew hours</Label>
      <Slider defaultValue={[6]} max={12} step={1} />
    </div>
  );
}

export function Range() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Label>Quote range</Label>
      <Slider defaultValue={[1800, 3400]} min={500} max={5000} step={100} />
    </div>
  );
}
```
