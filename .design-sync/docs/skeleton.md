---
category: Data
---

A loading placeholder. Size it with utility classes to match the content it stands in for, so the layout does not jump when the data arrives.

Mirror the real shape: a round skeleton for an avatar, a short bar for a heading.

## Examples

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export function Rows() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

export function CardPlaceholder() {
  return (
    <div className="border-border flex w-full max-w-sm gap-3 rounded-lg border p-4">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
```
