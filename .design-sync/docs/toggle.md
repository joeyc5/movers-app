---
category: Actions
---

A button that stays pressed. Use it for a single on and off state such as a filter or a formatting mark.

For a set of mutually exclusive options, use `ToggleGroup` instead.

## Examples

```tsx
import { Toggle } from "@/components/ui/toggle";
import { Bold, Italic, Star, Underline } from "lucide-react";

export function Default() {
  return (
    <div className="flex items-center gap-2">
      <Toggle aria-label="Bold">
        <Bold />
      </Toggle>
      <Toggle aria-label="Italic" defaultPressed>
        <Italic />
      </Toggle>
      <Toggle aria-label="Underline" disabled>
        <Underline />
      </Toggle>
    </div>
  );
}

export function Outline() {
  return (
    <div className="flex items-center gap-2">
      <Toggle variant="outline" size="sm">
        <Star /> Starred
      </Toggle>
      <Toggle variant="outline" size="default" defaultPressed>
        Priority
      </Toggle>
      <Toggle variant="outline" size="lg">
        Archived
      </Toggle>
    </div>
  );
}
```
