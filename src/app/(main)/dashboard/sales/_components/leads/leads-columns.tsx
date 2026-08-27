"use client";
import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    cell: ({ row }) => (
      <Link
        href={`/dashboard/sales/${row.original.id}`}
        className="block max-w-32 truncate font-medium text-sm hover:underline sm:max-w-none"
      >
        {row.original.clientName}
      </Link>
    ),
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
      <Link href={`/dashboard/sales/${row.original.id}`} className="font-medium text-sm tabular-nums hover:underline">
        {formatCurrency(row.original.estimatedValue)}
      </Link>
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
    header: () => <div className="text-right">Open</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <Button
          asChild
          aria-label={`Open deal for ${row.original.clientName}`}
          className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
          size="icon-sm"
          variant="ghost"
        >
          <Link href={`/dashboard/sales/${row.original.id}`}>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    ),
    enableSorting: false,
  },
];
