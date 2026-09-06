---
category: Feedback
---

The empty state for a list or a panel. `EmptyMedia` takes the icon, `EmptyTitle` and `EmptyDescription` explain the state, and `EmptyContent` holds the action that resolves it.

Say what will appear here and how to make it appear.

## Parts

Composed with `EmptyContent`, `EmptyDescription`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Button } from "@/components/ui/button";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import { Inbox } from "lucide-react";

export function NoDeals() {
  return (
    <Empty className="w-full max-w-md">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>No open deals</EmptyTitle>
        <EmptyDescription>
          New leads land here the moment a quote request comes in.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">Create a deal</Button>
      </EmptyContent>
    </Empty>
  );
}
```
