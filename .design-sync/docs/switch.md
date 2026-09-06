---
category: Forms
---

An immediate on and off setting. Use it when the change applies as soon as it is flipped, with no save step.

For a choice that is submitted with a form, use `Checkbox`.

## Examples

```tsx
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function Default() {
  return (
    <div className="flex items-center gap-2">
      <Switch id="s-1" defaultChecked />
      <Label htmlFor="s-1">Auto-assign crews</Label>
    </div>
  );
}

export function Settings() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="s-2">Email invoice on completion</Label>
        <Switch id="s-2" defaultChecked />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="s-3">Require signature</Label>
        <Switch id="s-3" />
      </div>
      <div className="flex items-center justify-between gap-4 opacity-60">
        <Label htmlFor="s-4">Weekend dispatch</Label>
        <Switch id="s-4" disabled />
      </div>
    </div>
  );
}
```
