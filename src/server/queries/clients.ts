import "server-only";

import { cache } from "react";

import type { Address, Client } from "@/app/(main)/dashboard/clients/_components/data";
import { getCurrentStaff } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Clients data access.
 *
 * The `id` the UI works with is the human code (`CLT-1001`), not the uuid. That
 * alias lives here rather than in the schema: a view column named `id` that is
 * not the primary key breaks every future join and misleads the next reader.
 * Keeping it in the DTO also means `/dashboard/clients/CLT-1001` and the table's
 * `getRowId` keep working untouched.
 */

const CLIENT_COLUMNS = `
  id, code, name, type, status,
  primary_contact_name, email, phone,
  billing_street, billing_city, billing_state, billing_zip,
  origin_street, origin_city, origin_state, origin_zip,
  destination_street, destination_city, destination_state, destination_zip,
  created_date, last_activity_date, notes,
  account_owner_staff_id,
  account_owner:clients_account_owner_staff_id_fkey ( full_name )
`;

type StaffRef = { full_name: string } | { full_name: string }[] | null;

interface ClientRow {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  primary_contact_name: string;
  email: string;
  phone: string;
  billing_street: string;
  billing_city: string;
  billing_state: string;
  billing_zip: string;
  origin_street: string | null;
  origin_city: string | null;
  origin_state: string | null;
  origin_zip: string | null;
  destination_street: string | null;
  destination_city: string | null;
  destination_state: string | null;
  destination_zip: string | null;
  created_date: string;
  last_activity_date: string;
  notes: string | null;
  account_owner_staff_id: string | null;
  account_owner: StaffRef;
}

/** PostgREST returns an embedded to-one as an object, but types it as either. */
function staffName(ref: StaffRef): string {
  if (!ref) return "";
  return Array.isArray(ref) ? (ref[0]?.full_name ?? "") : ref.full_name;
}

function address(street: string | null, city: string | null, state: string | null, zip: string | null) {
  if (!street || !city || !state || !zip) return undefined;
  return { street, city, state, zip } satisfies Address;
}

function toClient(row: ClientRow): Client {
  return {
    id: row.code,
    name: row.name,
    type: row.type as Client["type"],
    status: row.status as Client["status"],
    primaryContactName: row.primary_contact_name,
    email: row.email,
    phone: row.phone,
    billingAddress: {
      street: row.billing_street,
      city: row.billing_city,
      state: row.billing_state,
      zip: row.billing_zip,
    },
    originAddress: address(row.origin_street, row.origin_city, row.origin_state, row.origin_zip),
    destinationAddress: address(
      row.destination_street,
      row.destination_city,
      row.destination_state,
      row.destination_zip,
    ),
    // Never filtered by staff.status: one seeded rep is Deactivated and owns
    // five clients. Requiring an active owner would silently drop those rows.
    accountOwner: staffName(row.account_owner),
    accountOwnerId: row.account_owner_staff_id,
    createdDate: row.created_date,
    lastActivityDate: row.last_activity_date,
    notes: row.notes ?? undefined,
  };
}

export const getClients = cache(async (): Promise<Client[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .order("last_activity_date", { ascending: false });

  if (error) throw new Error(`Failed to load clients: ${error.message}`);
  return (data as unknown as ClientRow[]).map(toClient);
});

/** `code` lookup, so a bad id is a clean null rather than a thrown 22P02. */
export const getClientByCode = cache(async (code: string): Promise<Client | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select(CLIENT_COLUMNS).eq("code", code).maybeSingle();

  if (error) throw new Error(`Failed to load client ${code}: ${error.message}`);
  return data ? toClient(data as unknown as ClientRow) : null;
});

export interface AccountOwnerOption {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Assignable account owners. Every staff member is returned, deactivated
 * included: Sofia Marchetti owns five clients and dropping her would blank
 * the owner on any account she holds when it is edited. The form marks who
 * is no longer active rather than hiding them.
 */
export const getAccountOwnerOptions = cache(async (): Promise<AccountOwnerOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name, status")
    .order("full_name", { ascending: true });

  if (error) throw new Error(`Failed to load account owners: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, name: row.full_name, active: row.status === "Active" }));
});

/**
 * Mirrors app.has_perm('clients', true) read-side, so the screen omits write
 * affordances the database would reject. RLS is the enforcement; this only
 * decides what to render. Same shape as canWriteQuotes in queries/quotes.ts.
 */
export const canWriteClients = cache(async (): Promise<boolean> => {
  const staff = await getCurrentStaff();
  if (!staff || staff.status !== "Active") return false;

  const level = staff.role?.access_level;
  if (level === "Read only") return false;
  if (level === "Full") return true;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_permission_sets")
    .select("permission_set:permission_set_id!inner ( slug )")
    .eq("role_id", staff.role_id)
    .eq("permission_set.slug", "clients")
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
});
