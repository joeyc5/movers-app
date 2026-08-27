"use client";
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
import { cn } from "@/lib/utils";

import { getVaultOccupancyPercent, storageCustomers, type Vault, vaultStatusMeta } from "./data";

function StatusBadge({ status }: { status: Vault["status"] }) {
  const meta = vaultStatusMeta[status];

  return (
    <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badgeClass)} variant="outline">
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {status}
    </Badge>
  );
}

function OccupancyMeter({ vault }: { vault: Vault }) {
  const percent = getVaultOccupancyPercent(vault);
  const isOverCapacity = percent > 100;
  const isWellUtilized = percent >= 70 && percent <= 100;
  const isUnderutilized = percent > 0 && percent < 30;

  return (
    <span className="block min-w-32 space-y-1">
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span
          className={cn(
            "font-medium tabular-nums",
            isOverCapacity && "text-destructive",
            isWellUtilized && "text-emerald-600 dark:text-emerald-400",
            !isOverCapacity && !isWellUtilized && "text-muted-foreground",
          )}
        >
          {percent}%
        </span>
        {isOverCapacity ? <span className="font-medium text-destructive">Over capacity</span> : null}
        {isUnderutilized ? <span className="text-amber-600 dark:text-amber-400">Underutilized</span> : null}
      </span>
      <span className="block h-1.5 overflow-hidden rounded-full bg-muted-foreground/20">
        <span
          className={cn(
            "block h-full rounded-full bg-muted-foreground/60",
            isWellUtilized && "bg-emerald-500",
            isUnderutilized && "bg-amber-500",
            isOverCapacity && "bg-destructive",
          )}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </span>
    </span>
  );
}

function getCustomerName(assignedCustomerId?: string) {
  if (!assignedCustomerId) return undefined;
  return storageCustomers.find((customer) => customer.id === assignedCustomerId)?.customerName;
}

export const vaultsColumns: ColumnDef<DataTableFeatures, Vault>[] = [
  {
    id: "search",
    accessorFn: (row) =>
      `${row.id} ${row.warehouseLocation} ${row.rack} ${getCustomerName(row.assignedCustomerId) ?? ""}`,
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    id: "group",
    accessorFn: (row) => `${row.warehouseLocation} — ${row.rack}`,
    filterFn: "equalsString",
    enableHiding: true,
  },
  {
    accessorKey: "warehouseLocation",
    header: "Location",
    filterFn: "equalsString",
    enableHiding: true,
  },
  {
    accessorKey: "id",
    header: "Vault",
    cell: ({ row }) => <div className="font-medium text-sm">{row.original.id}</div>,
  },
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => {
      const name = getCustomerName(row.original.assignedCustomerId);
      return name ? (
        <div className="max-w-20 truncate text-sm sm:max-w-none">{name}</div>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      );
    },
  },
  {
    id: "capacity",
    header: "Capacity",
    cell: ({ row }) => (
      <div className="text-sm tabular-nums">
        {row.original.occupiedCubicFt} / {row.original.capacityCubicFt} ft³
      </div>
    ),
  },
  {
    id: "occupancy",
    header: "Occupancy",
    cell: ({ row }) => <OccupancyMeter vault={row.original} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: "equalsString",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "lastInspectionDate",
    accessorFn: (row) => new Date(row.lastInspectionDate).getTime(),
    header: "Last Inspection",
    cell: ({ row }) => (
      <div className="text-sm">{format(new Date(row.original.lastInspectionDate), "MMM d, yyyy")}</div>
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
              aria-label={`Open actions for vault ${row.original.id}`}
              className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Assign customer</DropdownMenuItem>
            <DropdownMenuItem>Log inspection</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Mark out of service</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    enableSorting: false,
  },
];
