---
category: Forms
---

A binary choice that is part of a set. Wrap it in a `Label` so the text is clickable.

For a setting that takes effect immediately, use `Switch` instead.

## Examples

```tsx
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function Default() {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="c-1" defaultChecked />
      <Label htmlFor="c-1">Packing materials included</Label>
    </div>
  );
}

export function Group() {
  return (
    <div className="flex flex-col gap-3">
      <Label className="flex items-center gap-2">
        <Checkbox defaultChecked /> Full-service packing
      </Label>
      <Label className="flex items-center gap-2">
        <Checkbox /> Piano handling
      </Label>
      <Label className="flex items-center gap-2 opacity-60">
        <Checkbox disabled /> Storage in transit
      </Label>
    </div>
  );
}
```
