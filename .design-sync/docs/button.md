---
category: Actions
---

The primary action control. Six variants and four sizes cover every button in the product, so reach for a variant before writing custom classes.

Use `variant="destructive"` only for actions that delete or cancel something. `asChild` renders the button's styling on a child element, which is how you style a link as a button.

## Examples

```tsx
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus, Trash2 } from "lucide-react";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button>Create deal</Button>
      <Button variant="secondary">Duplicate</Button>
      <Button variant="outline">Export</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="link">View invoice</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  );
}

export function WithIcons() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button>
        <Plus /> Add client
      </Button>
      <Button variant="outline">
        Continue <ArrowRight />
      </Button>
      <Button variant="destructive" size="icon" aria-label="Delete">
        <Trash2 />
      </Button>
      <Button disabled>Disabled</Button>
    </div>
  );
}
```
