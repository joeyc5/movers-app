"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/supabase/auth";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type QuoteUpdate = Database["public"]["Tables"]["quotes"]["Update"];
type QuoteLineItemUpdate = Database["public"]["Tables"]["quote_line_items"]["Update"];

/**
 * Quote mutations. Every action runs as the signed-in staff member, so RLS
 * (has_any_perm(['proposals','pipeline'], true)) is the real gate; the freeze
 * triggers protect anything past Draft. Postgres computes every total.
 *
 * Actions return { error } instead of throwing: an RLS denial or a freeze
 * violation is an expected outcome the UI must show, not a crash.
 */

export type QuoteActionResult = { error: string } | { error?: undefined };

function failure(prefix: string, message: string): QuoteActionResult {
  return { error: `${prefix}: ${message}` };
}

const dealPath = (dealCode: string) => `/dashboard/sales/${dealCode}`;

/** Pricing inputs a Draft quote accepts. Snapshot fields come from crew_rates, never the client. */
export interface QuoteDraftPatch {
  rateCardId?: string;
  crewSize?: number;
  estimatedHours?: number;
  moveDate?: string | null;
  validUntil?: string | null;
  valuationType?: "Released Value" | "Full Value Protection";
  valuationFee?: number;
  discountType?: "fixed" | "percent";
  discountValue?: number;
  taxRateId?: string;
  depositType?: "fixed" | "percent";
  depositValue?: number;
  notes?: string | null;
}

async function snapshotCrewRate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rateCardId: string,
  crewSize: number,
) {
  const { data, error } = await supabase
    .from("crew_rates")
    .select("hourly_rate_per_mover, min_hours, ot_threshold_hours, ot_multiplier")
    .eq("rate_card_id", rateCardId)
    .eq("crew_size", crewSize)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No rate on this rate card for a crew of ${crewSize}.`);
  return {
    hourly_rate_per_mover: data.hourly_rate_per_mover,
    min_hours: data.min_hours,
    ot_threshold_hours: data.ot_threshold_hours,
    ot_multiplier: data.ot_multiplier,
  };
}

export async function createQuote(dealCode: string): Promise<QuoteActionResult> {
  await requireAuth();
  const supabase = await createClient();

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("id, code, client_id, client_name, move_date, owner_staff_id")
    .eq("code", dealCode)
    .maybeSingle();
  if (dealError || !deal) return failure("Could not create the quote", dealError?.message ?? "deal not found");

  // Pre-fill addresses from the client record when the deal has one.
  let addresses: Record<string, string | null> = {};
  if (deal.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select(
        "origin_street, origin_city, origin_state, origin_zip, destination_street, destination_city, destination_state, destination_zip",
      )
      .eq("id", deal.client_id)
      .maybeSingle();
    if (client) addresses = client;
  }

  const [{ data: card, error: cardError }, { data: tax }] = await Promise.all([
    supabase.from("rate_cards").select("id, crew_rates ( crew_size )").eq("is_default", true).maybeSingle(),
    supabase.from("tax_rates").select("id, rate_percent").eq("is_default", true).maybeSingle(),
  ]);
  if (cardError || !card) {
    return failure("Could not create the quote", cardError?.message ?? "no default rate card is configured");
  }

  const crewSizes = ((card.crew_rates ?? []) as { crew_size: number }[]).map((r) => r.crew_size).sort((a, b) => a - b);
  if (crewSizes.length === 0) return failure("Could not create the quote", "the default rate card has no crew rates");
  const crewSize = crewSizes.includes(3) ? 3 : crewSizes[0];

  let snapshot: Awaited<ReturnType<typeof snapshotCrewRate>>;
  try {
    snapshot = await snapshotCrewRate(supabase, card.id, crewSize);
  } catch (error) {
    return failure("Could not create the quote", error instanceof Error ? error.message : String(error));
  }

  const { data: code, error: codeError } = await supabase.rpc("next_quote_code");
  if (codeError || !code) {
    return failure("Could not create the quote", codeError?.message ?? "quote number was not issued");
  }

  const { error: insertError } = await supabase.from("quotes").insert({
    code,
    deal_id: deal.id,
    client_id: deal.client_id,
    client_name: deal.client_name,
    status: "Draft",
    issued_on: new Date().toISOString().slice(0, 10),
    move_date: deal.move_date,
    ...addresses,
    rate_card_id: card.id,
    crew_size: crewSize,
    estimated_hours: snapshot.min_hours,
    ...snapshot,
    valuation_type: "Released Value",
    valuation_fee: 0,
    labor_taxable: false,
    valuation_taxable: false,
    discount_type: "fixed",
    discount_value: 0,
    tax_rate_id: tax?.id ?? null,
    tax_rate_percent: tax?.rate_percent ?? 0,
    deposit_type: "fixed",
    deposit_value: 0,
    owner_staff_id: deal.owner_staff_id,
  });
  if (insertError) return failure("Could not create the quote", insertError.message);

  revalidatePath(dealPath(dealCode));
  redirect(`${dealPath(dealCode)}?quote=${code}`);
}

export async function updateQuoteDraft(
  quoteId: string,
  dealCode: string,
  patch: QuoteDraftPatch,
): Promise<QuoteActionResult> {
  await requireAuth();
  const supabase = await createClient();

  const update: QuoteUpdate = {};

  if (patch.rateCardId !== undefined || patch.crewSize !== undefined) {
    const { data: current, error: readError } = await supabase
      .from("quotes")
      .select("rate_card_id, crew_size")
      .eq("id", quoteId)
      .maybeSingle();
    if (readError || !current) return failure("Could not save", readError?.message ?? "quote not found");

    const rateCardId = patch.rateCardId ?? current.rate_card_id;
    const crewSize = patch.crewSize ?? current.crew_size;
    if (!rateCardId) return failure("Could not save", "the quote has no rate card");
    try {
      Object.assign(update, await snapshotCrewRate(supabase, rateCardId, crewSize));
    } catch (error) {
      return failure("Could not save", error instanceof Error ? error.message : String(error));
    }
    update.rate_card_id = rateCardId;
    update.crew_size = crewSize;
  }

  if (patch.taxRateId !== undefined) {
    const { data: tax, error: taxError } = await supabase
      .from("tax_rates")
      .select("id, rate_percent")
      .eq("id", patch.taxRateId)
      .maybeSingle();
    if (taxError || !tax) return failure("Could not save", taxError?.message ?? "tax rate not found");
    update.tax_rate_id = tax.id;
    update.tax_rate_percent = tax.rate_percent;
  }

  if (patch.estimatedHours !== undefined) update.estimated_hours = patch.estimatedHours;
  if (patch.moveDate !== undefined) update.move_date = patch.moveDate;
  if (patch.validUntil !== undefined) update.valid_until = patch.validUntil;
  if (patch.valuationType !== undefined) {
    update.valuation_type = patch.valuationType;
    // Released Value coverage is free by federal rule; the check constraint enforces it.
    if (patch.valuationType === "Released Value") update.valuation_fee = 0;
  }
  if (patch.valuationFee !== undefined) update.valuation_fee = patch.valuationFee;
  if (patch.discountType !== undefined) update.discount_type = patch.discountType;
  if (patch.discountValue !== undefined) update.discount_value = patch.discountValue;
  if (patch.depositType !== undefined) update.deposit_type = patch.depositType;
  if (patch.depositValue !== undefined) update.deposit_value = patch.depositValue;
  if (patch.notes !== undefined) update.notes = patch.notes;

  if (Object.keys(update).length === 0) return {};

  const { error } = await supabase.from("quotes").update(update).eq("id", quoteId);
  if (error) return failure("Could not save", error.message);

  revalidatePath(dealPath(dealCode));
  return {};
}

export async function addLineItem(quoteId: string, dealCode: string, feeCatalogId: string): Promise<QuoteActionResult> {
  await requireAuth();
  const supabase = await createClient();

  const { data: fee, error: feeError } = await supabase
    .from("fee_catalog")
    .select("id, name, category, pricing_mode, default_rate, taxable")
    .eq("id", feeCatalogId)
    .maybeSingle();
  if (feeError || !fee) return failure("Could not add the item", feeError?.message ?? "catalog item not found");

  const { data: positions } = await supabase
    .from("quote_line_items")
    .select("position")
    .eq("quote_id", quoteId)
    .order("position", { ascending: false })
    .limit(1);

  const { error } = await supabase.from("quote_line_items").insert({
    quote_id: quoteId,
    kind: fee.category,
    fee_catalog_id: fee.id,
    description: fee.name,
    pricing_mode: fee.pricing_mode,
    quantity: 1,
    unit_price: fee.default_rate,
    taxable: fee.taxable,
    position: (positions?.[0]?.position ?? 0) + 1,
  });
  if (error) return failure("Could not add the item", error.message);

  revalidatePath(dealPath(dealCode));
  return {};
}

export async function updateLineItem(
  lineId: string,
  dealCode: string,
  patch: { quantity?: number; unitPrice?: number },
): Promise<QuoteActionResult> {
  await requireAuth();
  const supabase = await createClient();

  const update: QuoteLineItemUpdate = {};
  if (patch.quantity !== undefined) update.quantity = patch.quantity;
  if (patch.unitPrice !== undefined) update.unit_price = patch.unitPrice;
  if (Object.keys(update).length === 0) return {};

  const { error } = await supabase.from("quote_line_items").update(update).eq("id", lineId);
  if (error) return failure("Could not save the item", error.message);

  revalidatePath(dealPath(dealCode));
  return {};
}

export async function removeLineItem(lineId: string, dealCode: string): Promise<QuoteActionResult> {
  await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase.from("quote_line_items").delete().eq("id", lineId);
  if (error) return failure("Could not remove the item", error.message);

  revalidatePath(dealPath(dealCode));
  return {};
}

export async function sendQuote(quoteId: string, dealCode: string): Promise<QuoteActionResult> {
  await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from("quotes")
    .update({ status: "Sent", sent_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("status", "Draft");
  if (error) return failure("Could not send the quote", error.message);

  revalidatePath(dealPath(dealCode));
  return {};
}

export async function decideQuote(
  quoteId: string,
  dealCode: string,
  decision: "Accepted" | "Declined",
): Promise<QuoteActionResult> {
  await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from("quotes")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("id", quoteId)
    .in("status", ["Sent", "Viewed"]);
  if (error) return failure(`Could not mark the quote ${decision.toLowerCase()}`, error.message);

  // An accepted quote is a booked move, so the deal follows to Won. Best
  // effort: a proposals-only writer may lack pipeline write, and the accept
  // itself (with its value write-back) must not fail on that.
  if (decision === "Accepted") {
    await supabase.from("deals").update({ stage: "Won" }).eq("code", dealCode).not("stage", "in", '("Won","Lost")');
  }

  revalidatePath(dealPath(dealCode));
  return {};
}

export async function deleteQuoteDraft(quoteId: string, dealCode: string): Promise<QuoteActionResult> {
  await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase.from("quotes").delete().eq("id", quoteId).eq("status", "Draft");
  if (error) return failure("Could not delete the draft", error.message);

  revalidatePath(dealPath(dealCode));
  redirect(dealPath(dealCode));
}
