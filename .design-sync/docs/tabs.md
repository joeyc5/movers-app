---
category: Navigation
---

Switches between views of the same record. Each `TabsTrigger` value must match a `TabsContent` value.

Use tabs for peer views. For navigation between pages, use links.

## Parts

Composed with `TabsContent`, `TabsList`, `TabsTrigger`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Default() {
  return (
    <Tabs defaultValue="overview" className="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-muted-foreground pt-3 text-sm">
        Two-bedroom move, San Jose to Reno. Survey completed 12 March.
      </TabsContent>
      <TabsContent value="inventory" className="text-muted-foreground pt-3 text-sm">
        184 items, 3 crated. Piano flagged for specialty handling.
      </TabsContent>
      <TabsContent value="billing" className="text-muted-foreground pt-3 text-sm">
        Deposit received. Balance due on delivery.
      </TabsContent>
    </Tabs>
  );
}
```
