import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Warehouse data access. Reads the two expanded views rather than the base
 * tables, because the client components resolved these joins in the browser:
 * vaults-columns.tsx is "use client" and imported the agreements array by value
 * to render the customer cell. A client bundle cannot reach Postgres.
 *
 * Warehouse converts as ONE unit for that reason — both tabs depend on the same
 * resolved join, so neither can move on its own.
 */

export type StorageAgreementStatus = "Active" | "Pending Move-In" | "Past Due" | "Move-Out Scheduled" | "Closed";
export type VaultStatus = "Occupied" | "Partially Occupied" | "Empty" | "Reserved" | "Out of Service";

export interface StorageCustomerRow {
  id: string;
  clientCode: string;
  customerName: string;
  vaultIds: string[];
  monthlyRate: number;
  status: StorageAgreementStatus;
  moveInDate: string;
  /**
   * NULL for a closed agreement. The seed used an em-dash sentinel string here
   * and the column component compared against it literally; that check has to
   * become a null check.
   */
  nextBillingDate: string | null;
  warehouseLocation: string;
}

export interface VaultRow {
  id: string;
  warehouseLocation: string;
  rack: string;
  groupLabel: string;
  capacityCubicFt: number;
  occupiedCubicFt: number;
  /** Generated in Postgres, so it can never drift from its two inputs. */
  occupancyPercent: number;
  status: VaultStatus;
  customerName: string | null;
  clientCode: string | null;
  lastInspectionDate: string;
}

export const getStorageCustomers = cache(async (): Promise<StorageCustomerRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("storage_agreements_expanded")
    .select(
      "code, client_code, client_name, vault_codes, monthly_rate, status, move_in_date, next_billing_date, warehouse_location_name",
    )
    .order("code", { ascending: true });

  if (error) throw new Error(`Failed to load storage agreements: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.code as string,
    clientCode: row.client_code as string,
    customerName: row.client_name as string,
    vaultIds: (row.vault_codes as string[]) ?? [],
    monthlyRate: Number(row.monthly_rate),
    status: row.status as StorageAgreementStatus,
    moveInDate: row.move_in_date as string,
    nextBillingDate: (row.next_billing_date as string | null) ?? null,
    warehouseLocation: row.warehouse_location_name as string,
  }));
});

export const getVaults = cache(async (): Promise<VaultRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vaults_expanded")
    .select(
      "code, warehouse_location_name, rack, group_label, capacity_cubic_ft, occupied_cubic_ft, occupancy_percent, status, customer_name, client_code, last_inspection_date",
    )
    .order("code", { ascending: true });

  if (error) throw new Error(`Failed to load vaults: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.code as string,
    warehouseLocation: row.warehouse_location_name as string,
    rack: row.rack as string,
    groupLabel: row.group_label as string,
    capacityCubicFt: Number(row.capacity_cubic_ft),
    occupiedCubicFt: Number(row.occupied_cubic_ft),
    occupancyPercent: Number(row.occupancy_percent),
    status: row.status as VaultStatus,
    customerName: (row.customer_name as string | null) ?? null,
    clientCode: (row.client_code as string | null) ?? null,
    lastInspectionDate: row.last_inspection_date as string,
  }));
});
