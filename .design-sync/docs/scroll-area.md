---
category: Layout
---

A scroll container with styled bars. Give it a fixed height; it scrolls the overflow inside that box.

Use it for lists inside panels, not for the page itself.

## Parts

Composed with `ScrollBar`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const rooms = [
  "Kitchen", "Primary bedroom", "Guest bedroom", "Living room", "Dining room",
  "Home office", "Garage", "Basement", "Patio", "Attic",
];

export function Default() {
  return (
    <ScrollArea className="border-border h-48 w-64 rounded-md border">
      <div className="p-3">
        <p className="mb-2 text-sm font-medium">Rooms surveyed</p>
        {rooms.map((room) => (
          <div key={room}>
            <div className="text-muted-foreground py-1.5 text-sm">{room}</div>
            <Separator />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
```
