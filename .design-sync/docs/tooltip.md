---
category: Overlays
---

A one-line hint on hover or focus. The app wraps its root in `TooltipProvider`, which every tooltip needs.

Tooltips are the only label an icon-only button gets on desktop, so give that button an `aria-label` too.

## Parts

Composed with `TooltipContent`, `TooltipProvider`, `TooltipTrigger`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Archive } from "lucide-react";

export function Default() {
  return (
    <Tooltip defaultOpen>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Archive">
          <Archive />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Archive this deal</TooltipContent>
    </Tooltip>
  );
}
```
