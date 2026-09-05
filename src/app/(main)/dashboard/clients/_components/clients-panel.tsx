"use client";
import * as React from "react";

import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { Cog, Download, Plus, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { dataTableFeatures } from "@/lib/data-table-features";
import type { AccountOwnerOption } from "@/server/queries/clients";

import { ClientFormSheet } from "./client-form-sheet";
import { clientsColumns } from "./clients-columns";
import { ClientsTable } from "./clients-table";
import { type Client, filters } from "./data";

export function ClientsPanel({
  clients,
  owners,
  canWrite,
}: {
  clients: Client[];
  owners: AccountOwnerOption[];
  canWrite: boolean;
}) {
  // Derived from the rows rather than hardcoded: the owner list is whatever
  // staff actually own accounts, including deactivated ones.
  const ownerOptions = React.useMemo(
    () => ["All", ...Array.from(new Set(clients.map((client) => client.accountOwner))).sort()],
    [clients],
  );

  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "lastActivityDate", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({
    search: false,
  });
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Same responsive rule as Documents: secondary columns leave below md
  // instead of forcing the table into an undiscoverable horizontal scroll.
  const isMobile = useIsMobile();
  React.useEffect(() => {
    setColumnVisibility((visibility) => ({
      ...visibility,
      select: !isMobile,
      type: !isMobile,
      accountOwner: !isMobile,
      lastActivityDate: !isMobile,
      // The name already links to the client; the row menu adds nothing a
      // phone needs and its width alone forces horizontal clipping.
      actions: !isMobile,
    }));
  }, [isMobile]);

  const table = useTable({
    features: dataTableFeatures,
    data: clients,
    columns: clientsColumns,
    state: {
      rowSelection,
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string | undefined) ?? "";
  const typeFilter = (table.getColumn("type")?.getFilterValue() as string | undefined) ?? filters.type[0];
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string | undefined) ?? filters.status[0];
  const accountOwnerFilter = (table.getColumn("accountOwner")?.getFilterValue() as string | undefined) ?? "All";
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  function setColumnSelectFilter(columnId: string, value: string) {
    table.getColumn(columnId)?.setFilterValue(value === "All" ? undefined : value);
    table.setPageIndex(0);
  }

  return (
    <Card>
      <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 @2xl/card-header:has-data-[slot=card-action]:grid-cols-1 @5xl/card-header:has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_minmax(0,auto)]">
        <CardTitle className="text-xl leading-none">Clients</CardTitle>
        <CardDescription className="max-w-sm leading-snug">
          Every household and business account, from first lead to past move.
        </CardDescription>
        <CardAction className="col-start-1 row-start-auto w-full justify-self-stretch pt-1 @2xl/card-header:col-start-1 @2xl/card-header:row-start-auto @2xl/card-header:justify-start @2xl/card-header:justify-self-stretch @5xl/card-header:col-start-2 @5xl/card-header:row-span-2 @5xl/card-header:row-start-1 @5xl/card-header:w-auto @5xl/card-header:justify-end @5xl/card-header:justify-self-end @5xl/card-header:pt-0">
          <InputGroup className="h-7 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              className="h-7"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(event) => {
                table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                table.setPageIndex(0);
              }}
            />
            <InputGroupAddon align="inline-end">
              <Kbd className="h-4 text-[10px]">⌘K</Kbd>
            </InputGroupAddon>
          </InputGroup>
          <Button variant="outline" size="sm">
            <SlidersHorizontal /> Hide
          </Button>
          <Button variant="outline" size="sm">
            <Cog /> Customize
          </Button>
          <Button variant="outline" size="sm">
            <Download /> Export
          </Button>
          {canWrite ? (
            <ClientFormSheet
              mode="create"
              owners={owners}
              trigger={
                <Button size="sm">
                  <Plus /> Add Client
                </Button>
              }
            />
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={typeFilter} onValueChange={(value) => setColumnSelectFilter("type", value)}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Type:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {filters.type.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setColumnSelectFilter("status", value)}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Status:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {filters.status.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={accountOwnerFilter} onValueChange={(value) => setColumnSelectFilter("accountOwner", value)}>
              <SelectTrigger size="sm">
                <span className="text-muted-foreground">Owner:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {ownerOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="text-muted-foreground text-sm tabular-nums">{selectedCount} selected</div>
        </div>

        <ClientsTable table={table} />
      </CardContent>
    </Card>
  );
}
