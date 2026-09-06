---
category: Overlays
---

A modal for a focused task. `DialogHeader` carries the title and description, `DialogFooter` carries the actions.

Every dialog needs a `DialogTitle` for screen readers. `DialogClose` with `asChild` turns any button into the cancel action.

## Parts

Composed with `DialogClose`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogOverlay`, `DialogPortal`, `DialogTitle`, `DialogTrigger`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function NewDeal() {
  return (
    <Dialog defaultOpen modal={false}>
      <DialogTrigger asChild>
        <Button>New deal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
          <DialogDescription>Start a quote for an inbound lead.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="d-client">Client</FieldLabel>
            <Input id="d-client" placeholder="Acme Relocation" />
          </Field>
          <Field>
            <FieldLabel htmlFor="d-scope">Scope</FieldLabel>
            <Textarea id="d-scope" rows={3} placeholder="Two-bedroom, San Jose to Reno" />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Create deal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```
