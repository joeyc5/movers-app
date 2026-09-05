---
category: Navigation
---

A desktop-style menu bar. Each `MenubarMenu` holds a trigger and its content.

Use it for dense tools. For a single overflow menu, use `DropdownMenu`.

## Parts

Composed with `MenubarCheckboxItem`, `MenubarContent`, `MenubarGroup`, `MenubarItem`, `MenubarLabel`, `MenubarMenu`, `MenubarPortal`, `MenubarRadioGroup`, `MenubarRadioItem`, `MenubarSeparator`, `MenubarShortcut`, `MenubarSub`, `MenubarSubContent`, `MenubarSubTrigger`, `MenubarTrigger`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import {
  Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator,
  MenubarShortcut, MenubarTrigger,
} from "@/components/ui/menubar";

export function Default() {
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>Deal</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            New deal <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>Duplicate</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Archive</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Dispatch</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Assign crew</MenubarItem>
          <MenubarItem>Print run sheet</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Billing</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Create invoice</MenubarItem>
          <MenubarItem>Record payment</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
```
