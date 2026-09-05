import {
  ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem,
  ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function OnRow() {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="border-border text-muted-foreground flex h-28 w-72 items-center justify-center rounded-md border border-dashed text-sm">
        Right-click a deal row
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuLabel>Deal #1042</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem>Open</ContextMenuItem>
        <ContextMenuItem>Send estimate</ContextMenuItem>
        <ContextMenuCheckboxItem checked>Flag for follow-up</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
