---
category: Overlays
---

The right-click menu. `ContextMenuTrigger` wraps the region that responds.

It is not reachable on touch, so every action in it needs another route.

## Parts

Composed with `ContextMenuCheckboxItem`, `ContextMenuContent`, `ContextMenuGroup`, `ContextMenuItem`, `ContextMenuLabel`, `ContextMenuPortal`, `ContextMenuRadioGroup`, `ContextMenuRadioItem`, `ContextMenuSeparator`, `ContextMenuShortcut`, `ContextMenuSub`, `ContextMenuSubContent`, `ContextMenuSubTrigger`, `ContextMenuTrigger`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import {
  ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem,
  ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function OnRow() {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="border-border text-muted-foreground flex h-28 w-72 items-center justify-center rounded-md border border-dashed text-sm">
        Right-click a deal row
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuLabel>Deal #1042</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem>Open</ContextMenuItem>
        <ContextMenuItem>Send estimate</ContextMenuItem>
        <ContextMenuCheckboxItem checked>Flag for follow-up</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
```
