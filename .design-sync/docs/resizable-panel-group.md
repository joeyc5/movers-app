---
category: Layout
---

Draggable split panes. `direction` picks horizontal or vertical, and `defaultSize` sets each panel's starting percentage.

`ResizableHandle` with `withHandle` shows the grip.

## Parts

Composed with `ResizableHandle`, `ResizablePanel`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export function Horizontal() {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="border-border h-48 w-full max-w-md rounded-md border"
    >
      <ResizablePanel defaultSize={40}>
        <div className="flex h-full flex-col gap-1 p-3 text-sm">
          <span className="font-medium">Deals</span>
          <span className="text-muted-foreground">27 open</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={60}>
        <div className="flex h-full flex-col gap-1 p-3 text-sm">
          <span className="font-medium">Deal #1042</span>
          <span className="text-muted-foreground">Acme Relocation, San Jose to Reno</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
```
