"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { requireAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Warehouse mutations. Every action runs as the signed-in staff member, so RLS
 * (has_any_perm(['storage','vaults'], true)) is the real gate; the UI hides
 * these affordances from roles that cannot write, but a POST is public, so each
 * export re-validates its inputs and lets RLS decide.
 *
 * Actions return { error } instead of throwing: an RLS denial or a CHECK
 * violation is an expected outcome the UI shows, not a crash.
 */

export type WarehouseActionResult = { error: string } | { error?: undefined };

const WAREHOUSE_PATH = "/dashboard/warehouse";

const AGREEMENT_STATUSES = ["Active", "Pending Move-In", "Past Due", "Move-Out Scheduled", "Closed"] as const;
const VAULT_STATUSES = ["Occupied", "Partially Occupied", "Empty", "Reserved", "Out of Service"] as const;

const agreementCode = z.string().regex(/^STO-[0-9]+$/, "Not a storage agreement code.");
const vaultCode = z.string().regex(/^V-[0-9]+$/, "Not a vault code.");
const clientCode = z.string().regex(/^CLT-[0-9]+$/, "Not a client code.");
const uuid = z.uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

function failure(prefix: string, message: string): WarehouseActionResult {
  return { error: `${prefix}: ${message}` };
}

/** Turns a raw Postgres/PostgREST error into copy an operator can act on. */
function explain(message: string): string {
  if (message.includes("closed_not_billed")) return "A closed agreement cannot carry a next billing date.";
  if (message.includes("billing_after_move_in")) return "The next billing date cannot fall before the move-in date.";
  if (message.includes("row-level security") || message.includes("42501")) {
    return "You do not have permission to change the warehouse.";
  }
  return message;
}

// ---------------------------------------------------------------------
// Storage agreements
// ---------------------------------------------------------------------

export async function setAgreementStatus(code: string, status: string): Promise<WarehouseActionResult> {
  await requireAuth();
  const parsed = z.object({ code: agreementCode, status: z.enum(AGREEMENT_STATUSES) }).safeParse({ code, status });
  if (!parsed.success) return failure("Could not update the agreement", parsed.error.issues[0].message);

  const supabase = await createClient();
  // Closing must null the billing date in the same write, or
  // storage_agreements_closed_not_billed_check rejects the row.
  const update =
    parsed.data.status === "Closed"
      ? { status: parsed.data.status, next_billing_date: null }
      : { status: parsed.data.status };

  const { error } = await supabase.from("storage_agreements").update(update).eq("code", parsed.data.code);
  if (error) return failure("Could not update the agreement", explain(error.message));

  revalidatePath(WAREHOUSE_PATH);
  return {};
}

const agreementPatchSchema = z
  .object({
    status: z.enum(AGREEMENT_STATUSES),
    warehouseLocationId: uuid,
    monthlyRate: z.number().min(0, "Rate cannot be negative."),
    moveInDate: isoDate,
    nextBillingDate: isoDate.nullable(),
  })
  .refine((v) => v.status !== "Closed" || v.nextBillingDate === null, {
    message: "Clear the next billing date before closing.",
    path: ["nextBillingDate"],
  })
  .refine((v) => v.nextBillingDate === null || v.nextBillingDate >= v.moveInDate, {
    message: "The next billing date cannot fall before the move-in date.",
    path: ["nextBillingDate"],
  });

export async function updateAgreement(
  code: string,
  patch: z.input<typeof agreementPatchSchema>,
): Promise<WarehouseActionResult> {
  await requireAuth();
  const codeParsed = agreementCode.safeParse(code);
  if (!codeParsed.success) return failure("Could not save the agreement", codeParsed.error.issues[0].message);
  const parsed = agreementPatchSchema.safeParse(patch);
  if (!parsed.success) return failure("Could not save the agreement", parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("storage_agreements")
    .update({
      status: parsed.data.status,
      warehouse_location_id: parsed.data.warehouseLocationId,
      monthly_rate: parsed.data.monthlyRate,
      move_in_date: parsed.data.moveInDate,
      next_billing_date: parsed.data.status === "Closed" ? null : parsed.data.nextBillingDate,
    })
    .eq("code", codeParsed.data);
  if (error) return failure("Could not save the agreement", explain(error.message));

  revalidatePath(WAREHOUSE_PATH);
  return {};
}

const newAgreementSchema = z
  .object({
    clientCode,
    warehouseLocationId: uuid,
    status: z.enum(AGREEMENT_STATUSES),
    monthlyRate: z.number().min(0, "Rate cannot be negative."),
    moveInDate: isoDate,
    nextBillingDate: isoDate.nullable(),
  })
  .refine((v) => v.status !== "Closed" || v.nextBillingDate === null, {
    message: "A closed agreement does not bill.",
    path: ["nextBillingDate"],
  })
  .refine((v) => v.nextBillingDate === null || v.nextBillingDate >= v.moveInDate, {
    message: "The next billing date cannot fall before the move-in date.",
    path: ["nextBillingDate"],
  });

export async function createAgreement(input: z.input<typeof newAgreementSchema>): Promise<WarehouseActionResult> {
  await requireAuth();
  const parsed = newAgreementSchema.safeParse(input);
  if (!parsed.success) return failure("Could not create the agreement", parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("code", parsed.data.clientCode)
    .maybeSingle();
  if (clientError) return failure("Could not create the agreement", explain(clientError.message));
  if (!client) return failure("Could not create the agreement", "that client no longer exists");

  const { data: code, error: codeError } = await supabase.rpc("next_storage_code");
  if (codeError || !code) {
    return failure("Could not create the agreement", explain(codeError?.message ?? "no agreement number was issued"));
  }

  const { error } = await supabase.from("storage_agreements").insert({
    code,
    client_id: client.id,
    warehouse_location_id: parsed.data.warehouseLocationId,
    status: parsed.data.status,
    monthly_rate: parsed.data.monthlyRate,
    move_in_date: parsed.data.moveInDate,
    next_billing_date: parsed.data.status === "Closed" ? null : parsed.data.nextBillingDate,
  });
  if (error) return failure("Could not create the agreement", explain(error.message));

  revalidatePath(WAREHOUSE_PATH);
  return {};
}

// ---------------------------------------------------------------------
// Vaults
// ---------------------------------------------------------------------

export async function setVaultStatus(code: string, status: string): Promise<WarehouseActionResult> {
  await requireAuth();
  const parsed = z.object({ code: vaultCode, status: z.enum(VAULT_STATUSES) }).safeParse({ code, status });
  if (!parsed.success) return failure("Could not update the vault", parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("vaults").update({ status: parsed.data.status }).eq("code", parsed.data.code);
  if (error) return failure("Could not update the vault", explain(error.message));

  revalidatePath(WAREHOUSE_PATH);
  return {};
}

export async function assignVault(code: string, agreementId: string | null): Promise<WarehouseActionResult> {
  await requireAuth();
  const parsed = z.object({ code: vaultCode, agreementId: uuid.nullable() }).safeParse({ code, agreementId });
  if (!parsed.success) return failure("Could not assign the vault", parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("vaults")
    .update({ storage_agreement_id: parsed.data.agreementId })
    .eq("code", parsed.data.code);
  if (error) return failure("Could not assign the vault", explain(error.message));

  revalidatePath(WAREHOUSE_PATH);
  return {};
}

const newVaultSchema = z.object({
  warehouseLocationId: uuid,
  rack: z.string().trim().min(1, "Rack is required."),
  capacityCubicFt: z.number().int().positive("Capacity must be greater than zero."),
  occupiedCubicFt: z.number().int().min(0, "Occupied volume cannot be negative."),
  status: z.enum(VAULT_STATUSES),
  storageAgreementId: uuid.nullable(),
  lastInspectionDate: isoDate,
});

export async function createVault(input: z.input<typeof newVaultSchema>): Promise<WarehouseActionResult> {
  await requireAuth();
  const parsed = newVaultSchema.safeParse(input);
  if (!parsed.success) return failure("Could not create the vault", parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: code, error: codeError } = await supabase.rpc("next_vault_code");
  if (codeError || !code) {
    return failure("Could not create the vault", explain(codeError?.message ?? "no vault number was issued"));
  }

  const { error } = await supabase.from("vaults").insert({
    code,
    warehouse_location_id: parsed.data.warehouseLocationId,
    rack: parsed.data.rack,
    capacity_cubic_ft: parsed.data.capacityCubicFt,
    occupied_cubic_ft: parsed.data.occupiedCubicFt,
    status: parsed.data.status,
    storage_agreement_id: parsed.data.storageAgreementId,
    last_inspection_date: parsed.data.lastInspectionDate,
  });
  if (error) return failure("Could not create the vault", explain(error.message));

  revalidatePath(WAREHOUSE_PATH);
  return {};
}
