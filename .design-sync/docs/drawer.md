---
category: Overlays
---

A bottom panel that can be dragged, built on Vaul. It is the mobile counterpart to `Dialog`.

Use it for short mobile flows. On desktop, `Sheet` gives more room.

## Parts

Composed with `DrawerClose`, `DrawerContent`, `DrawerDescription`, `DrawerFooter`, `DrawerHeader`, `DrawerOverlay`, `DrawerPortal`, `DrawerTitle`, `DrawerTrigger`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter,
  DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";

export function CrewSheet() {
  return (
    <Drawer defaultOpen modal={false}>
      <DrawerTrigger asChild>
        <Button variant="outline">Assign crew</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Assign crew</DrawerTitle>
          <DrawerDescription>Tuesday, four movers available.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button>Assign crew A</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
```
