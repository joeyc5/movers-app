"use client";
import * as React from "react";

import { type ColumnFiltersState, type ColumnVisibilityState, type Row, useTable } from "@tanstack/react-table";
import { Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type DataTableFeatures, dataTableFeatures } from "@/lib/data-table-features";

import { type Vault, vaultFilters } from "./data";
import { vaultsColumns } from "./vaults-columns";

type VaultRow = Row<DataTableFeatures, Vault>;

function groupRowsByRack(rows: VaultRow[]) {
  return rows.reduce<Array<{ label: string; rows: VaultRow[] }>>((groups, row) => {
    const label = `${row.original.warehouseLocation} — ${row.original.rack}`;
    const group = groups.find((item) => item.label === label);

    if (group) {
      group.rows.push(row);
    } else {
      groups.push({ label, rows: [row] });
    }

    return groups;
  }, []);
}

export function VaultsPanel({ vaults }: { vaults: Vault[] }) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({
    search: false,
    group: false,
    warehouseLocation: false,
  });

  const table = useTable({
    features: dataTableFeatures,
    data: vaults,
    columns: vaultsColumns,
    state: { columnFilters, columnVisibility },
    getRowId: (row) => row.id,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string | undefined) ?? "";
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string | undefined) ?? vaultFilters.status[0];
  const locationFilter =
    (table.getColumn("warehouseLocation")?.getFilterValue() as string | undefined) ?? vaultFilters.location[0];

  const rows = table.getRowModel().rows;
  const groupedRows = groupRowsByRack(rows);
  const columnCount = table.getVisibleLeafColumns().length;

  function setColumnSelectFilter(columnId: string, value: string) {
    table.getColumn(columnId)?.setFilterValue(value === "All" ? undefined : value);
  }

  return (
    <Card>
      <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 @2xl/card-header:has-data-[slot=card-action]:grid-cols-1 @5xl/card-header:has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_minmax(0,auto)]">
        <CardTitle className="text-xl leading-none">Vaults</CardTitle>
        <CardDescription className="max-w-sm leading-snug">
          Every vault by warehouse and rack, with occupancy and inspection state.
        </CardDescription>
        <CardAction className="col-start-1 row-start-auto w-full justify-self-stretch pt-1 @2xl/card-header:col-start-1 @2xl/card-header:row-start-auto @2xl/card-header:justify-start @2xl/card-header:justify-self-stretch @5xl/card-header:col-start-2 @5xl/card-header:row-span-2 @5xl/card-header:row-start-1 @5xl/card-header:w-auto @5xl/card-header:justify-end @5xl/card-header:justify-self-end @5xl/card-header:pt-0">
          <InputGroup className="h-7 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              className="h-7"
              placeholder="Search vaults..."
              value={searchQuery}
              onChange={(event) => {
                table.getColumn("search")?.setFilterValue(event.target.value || undefined);
              }}
            />
          </InputGroup>
          <Button size="sm">
            <Plus /> Add Vault
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex flex-wrap items-center gap-3 px-4">
          <Select value={statusFilter} onValueChange={(value) => setColumnSelectFilter("status", value)}>
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Status:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                {vaultFilters.status.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={locationFilter} onValueChange={(value) => setColumnSelectFilter("warehouseLocation", value)}>
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Location:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                {vaultFilters.location.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
          <TableHeader className="[&_tr]:border-t">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="py-4 font-normal">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {groupedRows.length ? (
              groupedRows.map((group) => (
                <React.Fragment key={group.label}>
                  <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={columnCount} className="px-4 py-2.5">
                      <span className="flex items-center gap-2 font-medium text-sm">
                        {group.label}
                        <Badge className="rounded-sm font-normal tabular-nums" variant="outline">
                          {group.rows.length} {group.rows.length === 1 ? "vault" : "vaults"}
                        </Badge>
                      </span>
                    </TableCell>
                  </TableRow>
                  {group.rows.map((row) => (
                    <TableRow key={row.id} className="border-border/60 hover:bg-white/2.5">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-3 py-4 align-middle">
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
