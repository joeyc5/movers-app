"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import type { ClientStatus, ClientType } from "@/app/(main)/dashboard/clients/_components/data";
import { requireAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Client account mutations. Each runs as the signed-in staff member, so RLS
 * (app.has_perm('clients', true)) is the real gate; a denial comes back as an
 * error the UI shows, not a crash. company_id is set by the column default
 * (app.current_company_id()), never passed from the client.
 */

export type ClientActionResult = { error: string } | { error?: undefined };

const LIST_PATH = "/dashboard/clients";
const detailPath = (code: string) => `/dashboard/clients/${code}`;

const STATUSES = ["Lead", "Active", "In Storage", "Past", "Inactive"] as const;

const addressSchema = z.object({
  street: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  zip: z.string().trim().min(1),
});

const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Enter the account name."),
  type: z.enum(["Residential", "Commercial"]),
  status: z.enum(STATUSES),
  primaryContactName: z.string().trim().min(1, "Enter the primary contact."),
  email: z.email("Enter a valid email address."),
  phone: z.string().trim().min(1, "Enter a phone number."),
  billing: addressSchema,
  // All-or-nothing, matching clients_origin_group_check /
  // clients_destination_group_check: an optional block is either complete or
  // absent, never half filled.
  origin: addressSchema.nullable(),
  destination: addressSchema.nullable(),
  ownerStaffId: z.uuid().nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

export type ClientInput = z.input<typeof clientInputSchema>;

function failure(prefix: string, message: string): ClientActionResult {
  return { error: `${prefix}: ${message}` };
}

/** Maps a Postgres constraint violation to copy a person can act on. */
function mapWriteError(prefix: string, error: { code?: string; message: string }): ClientActionResult {
  if (error.code === "23514") {
    return failure(prefix, "an origin or destination address is missing a line. Fill every line or clear the block.");
  }
  if (error.code === "42501" || error.code === "PGRST301") {
    return failure(prefix, "your role cannot change client accounts.");
  }
  return failure(prefix, error.message);
}

type ClientRowWrite = {
  name: string;
  type: ClientType;
  status: ClientStatus;
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
  account_owner_staff_id: string | null;
  notes: string | null;
};

function toRow(input: z.infer<typeof clientInputSchema>): ClientRowWrite {
  return {
    name: input.name,
    type: input.type,
    status: input.status,
    primary_contact_name: input.primaryContactName,
    email: input.email,
    phone: input.phone,
    billing_street: input.billing.street,
    billing_city: input.billing.city,
    billing_state: input.billing.state,
    billing_zip: input.billing.zip,
    origin_street: input.origin?.street ?? null,
    origin_city: input.origin?.city ?? null,
    origin_state: input.origin?.state ?? null,
    origin_zip: input.origin?.zip ?? null,
    destination_street: input.destination?.street ?? null,
    destination_city: input.destination?.city ?? null,
    destination_state: input.destination?.state ?? null,
    destination_zip: input.destination?.zip ?? null,
    account_owner_staff_id: input.ownerStaffId,
    notes: input.notes,
  };
}

export async function createClientAccount(input: ClientInput): Promise<ClientActionResult> {
  await requireAuth();

  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) return failure("Could not add the client", parsed.error.issues[0]?.message ?? "invalid input");

  const supabase = await createClient();

  const { data: code, error: codeError } = await supabase.rpc("next_client_code");
  if (codeError || !code) {
    return failure("Could not add the client", codeError?.message ?? "a client number was not issued");
  }

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("clients").insert({
    code,
    created_date: today,
    last_activity_date: today,
    ...toRow(parsed.data),
  });
  if (error) return mapWriteError("Could not add the client", error);

  revalidatePath(LIST_PATH);
  redirect(detailPath(code));
}

export async function updateClientAccount(code: string, input: ClientInput): Promise<ClientActionResult> {
  await requireAuth();

  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) return failure("Could not save the client", parsed.error.issues[0]?.message ?? "invalid input");

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(toRow(parsed.data)).eq("code", code);
  if (error) return mapWriteError("Could not save the client", error);

  revalidatePath(LIST_PATH);
  revalidatePath(detailPath(code));
  return {};
}

export async function setClientStatus(code: string, status: ClientStatus): Promise<ClientActionResult> {
  await requireAuth();

  const parsed = z.enum(STATUSES).safeParse(status);
  if (!parsed.success) return failure("Could not update the status", "unknown status");

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ status: parsed.data }).eq("code", code);
  if (error) return mapWriteError("Could not update the status", error);

  revalidatePath(LIST_PATH);
  revalidatePath(detailPath(code));
  return {};
}
