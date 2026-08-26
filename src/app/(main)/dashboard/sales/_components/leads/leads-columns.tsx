"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowRight, MoreHorizontal } from "lucide-react";

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

import { type PipelineDeal, stageBadgeMeta } from "../data";

function StageBadge({ stage }: { stage: PipelineDeal["stage"] }) {
  const meta = stageBadgeMeta[stage];

  return (
    <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badgeClass)} variant="outline">
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {stage}
    </Badge>
  );
}

export const leadsColumns: ColumnDef<DataTableFeatures, PipelineDeal>[] = [
  {
    id: "search",
    accessorFn: (row) => `${row.clientName} ${row.id} ${row.originCity ?? ""} ${row.destinationCity ?? ""}`,
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div className="text-sm tracking-tight">{row.original.id}</div>,
  },
  {
    accessorKey: "clientName",
    header: "Client",
    cell: ({ row }) => <div className="font-medium text-sm">{row.original.clientName}</div>,
  },
  {
    accessorKey: "stage",
    header: "Stage",
    filterFn: "equalsString",
    cell: ({ row }) => <StageBadge stage={row.original.stage} />,
  },
  {
    id: "route",
    header: "Route",
    cell: ({ row }) =>
      row.original.originCity ? (
        <div className="flex items-center gap-1 text-sm">
          <span>{row.original.originCity}</span>
          {row.original.destinationCity ? (
            <>
              <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
              <span>{row.original.destinationCity}</span>
            </>
          ) : null}
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      ),
  },
  {
    id: "moveDate",
    accessorFn: (row) => (row.moveDate ? new Date(row.moveDate).getTime() : 0),
    header: "Move Date",
    cell: ({ row }) =>
      row.original.moveDate ? (
        <div className="text-sm">{format(new Date(row.original.moveDate), "MMM d, yyyy")}</div>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      ),
  },
  {
    id: "estimatedValue",
    accessorFn: (row) => row.estimatedValue,
    header: "Est. Value",
    cell: ({ row }) => (
      <div className="font-medium text-sm tabular-nums">{formatCurrency(row.original.estimatedValue)}</div>
    ),
  },
  {
    accessorKey: "ownerName",
    header: "Owner",
    filterFn: "equalsString",
    cell: ({ row }) => <div className="text-sm">{row.original.ownerName}</div>,
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Open actions for ${row.original.clientName}`}
              className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Log activity</DropdownMenuItem>
            <DropdownMenuItem>Schedule survey</DropdownMenuItem>
            <DropdownMenuItem>Send proposal</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Mark lost</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    enableHiding: false,
    enableSorting: false,
  },
];
