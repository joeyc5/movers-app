---
category: Layout
---

A single show and hide region. Use it for an optional detail block inside a form or a panel.

For several sections that behave as a set, use `Accordion`.

## Parts

Composed with `CollapsibleContent`, `CollapsibleTrigger`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronsUpDown } from "lucide-react";

export function Default() {
  return (
    <Collapsible defaultOpen className="flex w-full max-w-md flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Crew assignments</span>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Toggle">
            <ChevronsUpDown />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="text-muted-foreground flex flex-col gap-2 text-sm">
        <div className="border-border rounded-md border px-3 py-2">Dana Ramos, lead</div>
        <div className="border-border rounded-md border px-3 py-2">Kim Ide, driver</div>
        <div className="border-border rounded-md border px-3 py-2">Pat O'Brien, helper</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```
