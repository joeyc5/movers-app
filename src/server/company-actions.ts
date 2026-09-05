"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentCompany, requireAuth } from "@/lib/supabase/auth";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaffAccess } from "@/server/queries/staff";

/**
 * The company billing profile: the remittance block printed on every invoice
 * this company sends. Writes are gated on has_perm('settings', true) in RLS,
 * but that gate filters rows rather than raising for a non-settings caller, so
 * this action refuses up front instead of reporting a false success on a
 * no-op update. The two banking columns move only for a Full-access caller;
 * a Scoped settings-holder can edit the printed block, not the bank details.
 */

export type CompanyActionResult = { error: string } | { error?: undefined };

const SETTINGS_PATH = "/dashboard/settings";

const schema = z.object({
  name: z.string().trim().max(200),
  email: z.union([z.email("Enter a valid email."), z.literal("")]),
  phone: z.string().trim().max(50),
  website: z.string().trim().max(200),
  addressLine1: z.string().trim().max(200),
  addressLine2: z.string().trim().max(200),
  taxId: z.string().trim().max(100),
  paymentAccountName: z.string().trim().max(200).optional(),
  routingNumber: z.string().trim().max(50).optional(),
});

export async function updateCompanyBillingProfile(input: z.infer<typeof schema>): Promise<CompanyActionResult> {
  await requireAuth();

  const access = await getCurrentStaffAccess();
  if (!access?.canEditSettings) return { error: "You do not have permission to edit company details." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const d = parsed.data;

  const company = await getCurrentCompany();
  if (!company?.company_id) return { error: "Your company could not be resolved." };

  const update: TablesUpdate<"company_billing_profile"> = {
    name: d.name,
    email: d.email,
    phone: d.phone,
    website: d.website,
    address_line1: d.addressLine1,
    address_line2: d.addressLine2,
    tax_id: d.taxId,
  };
  if (access.accessLevel === "Full") {
    update.payment_account_name = d.paymentAccountName ?? "";
    update.routing_number = d.routingNumber ?? "";
  }

  const supabase = await createClient();
  const { error } = await supabase.from("company_billing_profile").update(update).eq("company_id", company.company_id);
  if (error) return { error: `Could not save: ${error.message}` };

  revalidatePath(SETTINGS_PATH);
  return {};
}
