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
