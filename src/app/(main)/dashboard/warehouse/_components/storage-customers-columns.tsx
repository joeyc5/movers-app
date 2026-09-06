"use client";
import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { cn, formatCurrency } from "@/lib/utils";

import { type StorageCustomer, storageStatusMeta } from "./data";

function StatusBadge({ status }: { status: StorageCustomer["status"] }) {
  const meta = storageStatusMeta[status];

  return (
    <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badgeClass)} variant="outline">
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {status}
    </Badge>
  );
}

export const storageCustomersColumns: ColumnDef<DataTableFeatures, StorageCustomer>[] = [
  {
    id: "search",
    accessorFn: (row) => `${row.customerName} ${row.id} ${row.clientCode} ${row.vaultIds.join(" ")}`,
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-36 sm:max-w-none">
        <Link
          className="block truncate font-medium text-foreground text-sm hover:underline"
          href={`/dashboard/clients/${row.original.clientCode}`}
        >
          {row.original.customerName}
        </Link>
        <div className="truncate text-muted-foreground text-sm">{row.original.id}</div>
      </div>
    ),
  },
  {
    id: "vaults",
    header: "Vaults",
    cell: ({ row }) =>
      row.original.vaultIds.length ? (
        <div className="flex flex-wrap gap-1">
          {row.original.vaultIds.map((vaultId) => (
            <Badge key={vaultId} className="rounded-sm font-normal" variant="outline">
              {vaultId}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      ),
  },
  {
    id: "monthlyRate",
    accessorFn: (row) => row.monthlyRate,
    header: "Monthly Rate",
    cell: ({ row }) => (
      <div className="text-sm tabular-nums">
        {row.original.monthlyRate > 0 ? formatCurrency(row.original.monthlyRate) : "—"}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: "equalsString",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "warehouseLocation",
    header: "Location",
    filterFn: "equalsString",
    cell: ({ row }) => <div className="text-sm">{row.original.warehouseLocation}</div>,
  },
  {
    id: "nextBillingDate",
    accessorFn: (row) => row.nextBillingDate,
    header: "Next Billing",
    cell: ({ row }) => (
      <div className="text-sm">
        {row.original.nextBillingDate ? format(new Date(row.original.nextBillingDate), "MMM d, yyyy") : "—"}
      </div>
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
              aria-label={`Open actions for ${row.original.customerName}`}
              className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/clients/${row.original.clientCode}`}>View client</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Record payment</DropdownMenuItem>
            <DropdownMenuItem>Schedule move-out</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Close agreement</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    enableSorting: false,
  },
];
