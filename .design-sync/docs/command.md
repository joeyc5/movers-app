---
category: Navigation
---

The command palette and its filtered list, built on cmdk. `CommandInput` filters the `CommandItem`s below it.

`CommandDialog` puts the same palette in a modal, which is the ⌘K pattern. `CommandEmpty` covers the no-results case.

## Parts

Composed with `CommandDialog`, `CommandEmpty`, `CommandGroup`, `CommandInput`, `CommandItem`, `CommandList`, `CommandSeparator`, `CommandShortcut`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { Calendar, FileText, Truck, Users } from "lucide-react";

export function Palette() {
  return (
    <Command className="border-border w-full max-w-sm rounded-lg border">
      <CommandInput placeholder="Search deals, clients, invoices" />
      <CommandList>
        <CommandEmpty>Nothing matched.</CommandEmpty>
        <CommandGroup heading="Jump to">
          <CommandItem>
            <Users /> Clients
            <CommandShortcut>⌘1</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <FileText /> Invoices
            <CommandShortcut>⌘2</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Calendar /> Calendar
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem>
            <Truck /> Dispatch a crew
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
```
