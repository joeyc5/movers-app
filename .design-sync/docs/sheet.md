---
category: Overlays
---

A panel that slides in from an edge. Use it for editing a record without leaving the list behind it.

`side` picks the edge and defaults to the right. For a mobile bottom panel with drag, use `Drawer`.

## Parts

Composed with `SheetClose`, `SheetContent`, `SheetDescription`, `SheetFooter`, `SheetHeader`, `SheetTitle`, `SheetTrigger`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter,
  SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

export function EditClient() {
  return (
    <Sheet defaultOpen modal={false}>
      <SheetTrigger asChild>
        <Button variant="outline">Edit client</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit client</SheetTitle>
          <SheetDescription>Changes apply to every open deal.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <Field>
            <FieldLabel htmlFor="sh-name">Company</FieldLabel>
            <Input id="sh-name" defaultValue="Acme Relocation" />
          </Field>
          <Field>
            <FieldLabel htmlFor="sh-phone">Phone</FieldLabel>
            <Input id="sh-phone" defaultValue="(408) 555-0142" />
          </Field>
        </div>
        <SheetFooter>
          <Button>Save changes</Button>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```
