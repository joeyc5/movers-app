import "server-only";

import { cache } from "react";

import { getCurrentStaff } from "@/lib/supabase/auth";
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
  /** The agreement's uuid, used to target vault assignment writes. */
  agreementUuid: string;
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
  warehouseLocationId: string;
}

export interface VaultRow {
  id: string;
  warehouseLocation: string;
  warehouseLocationId: string;
  rack: string;
  groupLabel: string;
  capacityCubicFt: number;
  occupiedCubicFt: number;
  /** Generated in Postgres, so it can never drift from its two inputs. */
  occupancyPercent: number;
  status: VaultStatus;
  customerName: string | null;
  clientCode: string | null;
  storageAgreementId: string | null;
  storageAgreementCode: string | null;
  lastInspectionDate: string;
}

export interface WarehouseLocationRow {
  id: string;
  name: string;
}

export const getStorageCustomers = cache(async (): Promise<StorageCustomerRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("storage_agreements_expanded")
    .select(
      "id, code, client_code, client_name, vault_codes, monthly_rate, status, move_in_date, next_billing_date, warehouse_location_id, warehouse_location_name",
    )
    .order("code", { ascending: true });

  if (error) throw new Error(`Failed to load storage agreements: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.code as string,
    agreementUuid: row.id as string,
    clientCode: row.client_code as string,
    customerName: row.client_name as string,
    vaultIds: (row.vault_codes as string[]) ?? [],
    monthlyRate: Number(row.monthly_rate),
    status: row.status as StorageAgreementStatus,
    moveInDate: row.move_in_date as string,
    nextBillingDate: (row.next_billing_date as string | null) ?? null,
    warehouseLocation: row.warehouse_location_name as string,
    warehouseLocationId: row.warehouse_location_id as string,
  }));
});

export const getVaults = cache(async (): Promise<VaultRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vaults_expanded")
    .select(
      "code, warehouse_location_id, warehouse_location_name, rack, group_label, capacity_cubic_ft, occupied_cubic_ft, occupancy_percent, status, customer_name, client_code, storage_agreement_id, storage_agreement_code, last_inspection_date",
    )
    .order("code", { ascending: true });

  if (error) throw new Error(`Failed to load vaults: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.code as string,
    warehouseLocation: row.warehouse_location_name as string,
    warehouseLocationId: row.warehouse_location_id as string,
    rack: row.rack as string,
    groupLabel: row.group_label as string,
    capacityCubicFt: Number(row.capacity_cubic_ft),
    occupiedCubicFt: Number(row.occupied_cubic_ft),
    occupancyPercent: Number(row.occupancy_percent),
    status: row.status as VaultStatus,
    customerName: (row.customer_name as string | null) ?? null,
    clientCode: (row.client_code as string | null) ?? null,
    storageAgreementId: (row.storage_agreement_id as string | null) ?? null,
    storageAgreementCode: (row.storage_agreement_code as string | null) ?? null,
    lastInspectionDate: row.last_inspection_date as string,
  }));
});

/** Active warehouse locations for the create and edit forms' location selects. */
export const getWarehouseLocations = cache(async (): Promise<WarehouseLocationRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouse_locations")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to load warehouse locations: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id as string, name: row.name as string }));
});

/**
 * Whether the signed-in staff member can write to the warehouse. The RLS gate
 * is app.has_any_perm(['storage','vaults'], true), which resolves to:
 * access_level 'Full', OR (holds the storage or vaults permission set AND
 * access_level is not 'Read only'). A Scoped role such as Dispatcher passes the
 * access_level test but holds neither set, so it cannot write. Gating on
 * access_level alone would leave that role staring at buttons the database
 * rejects, so the capability is computed against the same predicate the policy
 * uses.
 */
export const getWarehouseAccess = cache(async (): Promise<boolean> => {
  const staff = await getCurrentStaff();
  if (!staff?.role) return false;
  if (staff.role.access_level === "Full") return true;
  if (staff.role.access_level === "Read only") return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_permission_sets")
    .select("permission_sets!inner(slug)")
    .eq("role_id", staff.role_id)
    .in("permission_sets.slug", ["storage", "vaults"]);

  if (error) return false;
  return (data ?? []).length > 0;
});
