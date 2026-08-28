import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * The current company's billing profile -- the single source for the
 * invoice "From" block, replacing the formerly hardcoded
 * movingCompanyFromDetails literal in the invoice/data.ts module.
 *
 * company_id IS the primary key on this table (0018 rekeyed it off a
 * surrogate id + singleton CHECK), and the tenant_isolation RESTRICTIVE
 * policy scopes every read to the caller's current company, so an
 * unfiltered select returns at most one row: the caller's own.
 */
const BILLING_PROFILE_COLUMNS =
  "name, email, phone, website, address_line1, address_line2, tax_id, payment_account_name, routing_number";

export const getCompanyBillingProfile = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_billing_profile").select(BILLING_PROFILE_COLUMNS).maybeSingle();

  if (error) {
    console.error("getCompanyBillingProfile: lookup failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  return data;
});
