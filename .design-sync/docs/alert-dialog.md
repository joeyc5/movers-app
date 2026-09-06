---
category: Overlays
---

A modal that interrupts to confirm something consequential. Unlike `Dialog`, it has no dismiss affordance: the user picks `AlertDialogCancel` or `AlertDialogAction`.

Use it for deletes and cancellations. `AlertDialogAction` accepts the `Button` variants, so destructive confirmations get `variant="destructive"`.

## Parts

Composed with `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogMedia`, `AlertDialogOverlay`, `AlertDialogPortal`, `AlertDialogTitle`, `AlertDialogTrigger`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DestructiveConfirm() {
  return (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete deal</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this deal?</AlertDialogTitle>
          <AlertDialogDescription>
            Deal #1042 and its three estimates will be removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep deal</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```
