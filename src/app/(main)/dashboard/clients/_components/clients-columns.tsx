"use client";
import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { format } from "date-fns";
import { Building2, MoreHorizontal, User } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { cn, getInitials } from "@/lib/utils";

import { type Client, statusMeta } from "./data";

function TypeIcon({ type }: { type: Client["type"] }) {
  return type === "Commercial" ? <Building2 className="size-3.5" /> : <User className="size-3.5" />;
}

function StatusBadge({ status }: { status: Client["status"] }) {
  const meta = statusMeta[status];

  return (
    <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badgeClass)} variant="outline">
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {status}
    </Badge>
  );
}

function NameCell({ client }: { client: Client }) {
  const subtext = client.type === "Commercial" ? `Attn: ${client.primaryContactName}` : client.email;

  return (
    <div className="flex items-center gap-3">
      <Avatar size="lg">
        <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
      </Avatar>
      {/* The max-w clamp is what lets the cell truncate at 390px: an auto-layout
          table never shrinks a cell below its content's min width on its own. */}
      <div className="min-w-0 max-w-36 sm:max-w-none">
        <Link
          className="block truncate font-medium text-foreground text-sm hover:underline"
          href={`/dashboard/clients/${client.id}`}
        >
          {client.name}
        </Link>
        <div className="truncate text-muted-foreground text-sm">{subtext}</div>
      </div>
    </div>
  );
}

export const clientsColumns: ColumnDef<DataTableFeatures, Client>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Subscribe
          source={table.atoms.rowSelection}
          selector={() =>
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected() && "indeterminate")
          }
        >
          {(checked) => (
            <Checkbox
              aria-label="Select all clients"
              checked={checked}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            />
          )}
        </Subscribe>
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Subscribe source={row.table.atoms.rowSelection} selector={(selection) => Boolean(selection?.[row.id])}>
          {(checked) => (
            <Checkbox
              aria-label={`Select ${row.original.name}`}
              checked={checked}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
            />
          )}
        </Subscribe>
      </div>
    ),
    enableHiding: false,
    enableSorting: false,
  },
  {
    id: "search",
    accessorFn: (row) => `${row.name} ${row.primaryContactName} ${row.email} ${row.id}`,
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    accessorKey: "name",
    header: "Client",
    cell: ({ row }) => <NameCell client={row.original} />,
  },
  {
    accessorKey: "type",
    header: "Type",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <Badge className="gap-1.5 font-medium" variant="outline">
        <TypeIcon type={row.original.type} />
        {row.original.type}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: "equalsString",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "accountOwner",
    header: "Account Owner",
    filterFn: "equalsString",
    cell: ({ row }) => <div className="text-sm">{row.original.accountOwner}</div>,
  },
  {
    id: "lastActivityDate",
    accessorFn: (row) => new Date(row.lastActivityDate).getTime(),
    header: "Last Activity",
    cell: ({ row }) => (
      <div className="text-foreground text-sm">{format(new Date(row.original.lastActivityDate), "MMM d, yyyy")}</div>
    ),
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Open actions for ${row.original.name}`}
              className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/clients/${row.original.id}`}>View client</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Edit details</DropdownMenuItem>
            <DropdownMenuItem>Log activity</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Archive client</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    enableSorting: false,
  },
];
