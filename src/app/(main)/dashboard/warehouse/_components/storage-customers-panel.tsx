"use client";
import * as React from "react";

import { type ColumnFiltersState, type ColumnVisibilityState, useTable } from "@tanstack/react-table";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { dataTableFeatures } from "@/lib/data-table-features";

import { type StorageCustomer, storageCustomerFilters } from "./data";
import { storageCustomersColumns } from "./storage-customers-columns";

export function StorageCustomersPanel({ storageCustomers }: { storageCustomers: StorageCustomer[] }) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({
    search: false,
  });

  // Same responsive rule as Documents: secondary columns leave below md
  // instead of forcing the table into an undiscoverable horizontal scroll.
  const isMobile = useIsMobile();
  React.useEffect(() => {
    setColumnVisibility((visibility) => ({
      ...visibility,
      vaults: !isMobile,
      warehouseLocation: !isMobile,
      nextBillingDate: !isMobile,
      // Status (Past Due, Move-Out Scheduled) is the operational signal on a
      // phone; the rate lives one tap away on the agreement.
      monthlyRate: !isMobile,
      // The customer cell already links to the client record.
      actions: !isMobile,
    }));
  }, [isMobile]);

  const table = useTable({
    features: dataTableFeatures,
    data: storageCustomers,
    columns: storageCustomersColumns,
    state: { columnFilters, columnVisibility },
    getRowId: (row) => row.id,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string | undefined) ?? "";
  const statusFilter =
    (table.getColumn("status")?.getFilterValue() as string | undefined) ?? storageCustomerFilters.status[0];
  const locationFilter =
    (table.getColumn("warehouseLocation")?.getFilterValue() as string | undefined) ??
    storageCustomerFilters.location[0];

  function setColumnSelectFilter(columnId: string, value: string) {
    table.getColumn(columnId)?.setFilterValue(value === "All" ? undefined : value);
  }

  return (
    <Card>
      <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 @2xl/card-header:has-data-[slot=card-action]:grid-cols-1 @5xl/card-header:has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_minmax(0,auto)]">
        <CardTitle className="text-xl leading-none">Storage Customers</CardTitle>
        <CardDescription className="max-w-sm leading-snug">
          Storage agreements, their vaults, and billing state.
        </CardDescription>
        <CardAction className="col-start-1 row-start-auto w-full justify-self-stretch pt-1 @2xl/card-header:col-start-1 @2xl/card-header:row-start-auto @2xl/card-header:justify-start @2xl/card-header:justify-self-stretch @5xl/card-header:col-start-2 @5xl/card-header:row-span-2 @5xl/card-header:row-start-1 @5xl/card-header:w-auto @5xl/card-header:justify-end @5xl/card-header:justify-self-end @5xl/card-header:pt-0">
          <InputGroup className="h-7 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              className="h-7"
              placeholder="Search storage customers..."
              value={searchQuery}
              onChange={(event) => {
                table.getColumn("search")?.setFilterValue(event.target.value || undefined);
              }}
            />
          </InputGroup>
          <Button size="sm">
            <Plus /> New Agreement
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
                {storageCustomerFilters.status.map((option) => (
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
                {storageCustomerFilters.location.map((option) => (
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-border/60 hover:bg-white/2.5">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-4 align-middle">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
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
