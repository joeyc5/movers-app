import "server-only";

import { cache } from "react";

import { getCurrentStaff } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Quotes data access.
 *
 * Every dollar figure here was computed by Postgres: labor_total is a stored
 * generated column and a BEFORE trigger recomputes subtotal, discount, tax,
 * total and deposit on every write. Nothing in the app re-derives money, so
 * the number on screen is the number that freezes when a quote is accepted.
 */

export type QuoteStatus = "Draft" | "Sent" | "Viewed" | "Accepted" | "Declined" | "Expired";

export interface QuoteLineItem {
  id: string;
  kind: "labor" | "accessorial" | "materials" | "specialty" | "surcharge";
  feeCatalogId: string | null;
  description: string;
  pricingMode: "flat" | "per_unit" | "per_hour" | "percent_of_labor";
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  amount: number;
  position: number;
}

export interface QuoteDetail {
  id: string;
  code: string;
  dealId: string | null;
  clientId: string | null;
  clientName: string;
  status: QuoteStatus;
  issuedOn: string;
  validUntil: string | null;
  moveDate: string | null;
  originStreet: string | null;
  originCity: string | null;
  originState: string | null;
  originZip: string | null;
  destinationStreet: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  destinationZip: string | null;
  rateCardId: string | null;
  crewSize: number;
  estimatedHours: number;
  hourlyRatePerMover: number;
  minHours: number;
  otThresholdHours: number;
  otMultiplier: number;
  laborTotal: number;
  valuationType: "Released Value" | "Full Value Protection";
  valuationFee: number;
  laborTaxable: boolean;
  valuationTaxable: boolean;
  discountType: "fixed" | "percent";
  discountValue: number;
  taxRateId: string | null;
  taxRatePercent: number;
  accessorialsTotal: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  depositType: "fixed" | "percent";
  depositValue: number;
  depositAmount: number;
  notes: string | null;
  sentAt: string | null;
  decidedAt: string | null;
  lineItems: QuoteLineItem[];
}

const QUOTE_COLUMNS = `
  id, code, deal_id, client_id, client_name, status, issued_on, valid_until, move_date,
  origin_street, origin_city, origin_state, origin_zip,
  destination_street, destination_city, destination_state, destination_zip,
  rate_card_id, crew_size, estimated_hours, hourly_rate_per_mover, min_hours,
  ot_threshold_hours, ot_multiplier, labor_total,
  valuation_type, valuation_fee, labor_taxable, valuation_taxable,
  discount_type, discount_value, tax_rate_id, tax_rate_percent,
  accessorials_total, subtotal, discount_amount, tax_amount, total_amount,
  deposit_type, deposit_value, deposit_amount, notes, sent_at, decided_at,
  quote_line_items ( id, kind, fee_catalog_id, description, pricing_mode, quantity, unit_price, taxable, amount, position )
`;

// PostgREST types numerics loosely; normalise every money and rate figure once.
// biome-ignore lint/suspicious/noExplicitAny: raw PostgREST row
function toQuote(row: any): QuoteDetail {
  const items = ((row.quote_line_items ?? []) as any[])
    .map(
      (li): QuoteLineItem => ({
        id: li.id,
        kind: li.kind,
        feeCatalogId: li.fee_catalog_id ?? null,
        description: li.description,
        pricingMode: li.pricing_mode,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unit_price),
        taxable: li.taxable,
        amount: Number(li.amount),
        position: li.position,
      }),
    )
    .sort((a, b) => a.position - b.position);

  return {
    id: row.id,
    code: row.code,
    dealId: row.deal_id ?? null,
    clientId: row.client_id ?? null,
    clientName: row.client_name,
    status: row.status,
    issuedOn: row.issued_on,
    validUntil: row.valid_until ?? null,
    moveDate: row.move_date ?? null,
    originStreet: row.origin_street ?? null,
    originCity: row.origin_city ?? null,
    originState: row.origin_state ?? null,
    originZip: row.origin_zip ?? null,
    destinationStreet: row.destination_street ?? null,
    destinationCity: row.destination_city ?? null,
    destinationState: row.destination_state ?? null,
    destinationZip: row.destination_zip ?? null,
    rateCardId: row.rate_card_id ?? null,
    crewSize: row.crew_size,
    estimatedHours: Number(row.estimated_hours),
    hourlyRatePerMover: Number(row.hourly_rate_per_mover),
    minHours: Number(row.min_hours),
    otThresholdHours: Number(row.ot_threshold_hours),
    otMultiplier: Number(row.ot_multiplier),
    laborTotal: Number(row.labor_total),
    valuationType: row.valuation_type,
    valuationFee: Number(row.valuation_fee),
    laborTaxable: row.labor_taxable,
    valuationTaxable: row.valuation_taxable,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    taxRateId: row.tax_rate_id ?? null,
    taxRatePercent: Number(row.tax_rate_percent),
    accessorialsTotal: Number(row.accessorials_total),
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    taxAmount: Number(row.tax_amount),
    totalAmount: Number(row.total_amount),
    depositType: row.deposit_type,
    depositValue: Number(row.deposit_value),
    depositAmount: Number(row.deposit_amount),
    notes: row.notes ?? null,
    sentAt: row.sent_at ?? null,
    decidedAt: row.decided_at ?? null,
    lineItems: items,
  };
}

export const getQuotesForDeal = cache(async (dealId: string): Promise<QuoteDetail[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load quotes: ${error.message}`);
  return (data ?? []).map(toQuote);
});

export const getQuoteByCode = cache(async (code: string): Promise<QuoteDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotes").select(QUOTE_COLUMNS).eq("code", code).maybeSingle();

  if (error) throw new Error(`Failed to load quote ${code}: ${error.message}`);
  return data ? toQuote(data) : null;
});

/** Reference data the builder offers: rate cards with their crew pricing, tax rates, fee catalog. */
export interface CrewRateOption {
  crewSize: number;
  hourlyRatePerMover: number;
  minHours: number;
  otThresholdHours: number;
  otMultiplier: number;
}

export interface RateCardOption {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  crewRates: CrewRateOption[];
}

export interface TaxRateOption {
  id: string;
  name: string;
  ratePercent: number;
  isDefault: boolean;
}

export interface FeeCatalogOption {
  id: string;
  code: string;
  name: string;
  category: "accessorial" | "materials" | "specialty" | "surcharge";
  pricingMode: "flat" | "per_unit" | "per_hour" | "percent_of_labor";
  defaultRate: number;
  unitLabel: string | null;
  taxable: boolean;
}

export interface QuoteContext {
  rateCards: RateCardOption[];
  taxRates: TaxRateOption[];
  feeCatalog: FeeCatalogOption[];
}

export const getQuoteContext = cache(async (): Promise<QuoteContext> => {
  const supabase = await createClient();
  const [cards, taxes, fees] = await Promise.all([
    supabase
      .from("rate_cards")
      .select(
        "id, code, name, is_default, crew_rates ( crew_size, hourly_rate_per_mover, min_hours, ot_threshold_hours, ot_multiplier )",
      )
      .order("code"),
    supabase.from("tax_rates").select("id, name, rate_percent, is_default").eq("is_active", true).order("name"),
    supabase
      .from("fee_catalog")
      .select("id, code, name, category, pricing_mode, default_rate, unit_label, taxable")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const firstError = cards.error ?? taxes.error ?? fees.error;
  if (firstError) throw new Error(`Failed to load quote reference data: ${firstError.message}`);

  return {
    // biome-ignore lint/suspicious/noExplicitAny: raw PostgREST rows
    rateCards: ((cards.data ?? []) as any[]).map((card) => ({
      id: card.id,
      code: card.code,
      name: card.name,
      isDefault: card.is_default,
      // biome-ignore lint/suspicious/noExplicitAny: raw PostgREST rows
      crewRates: ((card.crew_rates ?? []) as any[])
        .map((rate) => ({
          crewSize: rate.crew_size,
          hourlyRatePerMover: Number(rate.hourly_rate_per_mover),
          minHours: Number(rate.min_hours),
          otThresholdHours: Number(rate.ot_threshold_hours),
          otMultiplier: Number(rate.ot_multiplier),
        }))
        .sort((a: CrewRateOption, b: CrewRateOption) => a.crewSize - b.crewSize),
    })),
    // biome-ignore lint/suspicious/noExplicitAny: raw PostgREST rows
    taxRates: ((taxes.data ?? []) as any[]).map((tax) => ({
      id: tax.id,
      name: tax.name,
      ratePercent: Number(tax.rate_percent),
      isDefault: tax.is_default,
    })),
    // biome-ignore lint/suspicious/noExplicitAny: raw PostgREST rows
    feeCatalog: ((fees.data ?? []) as any[]).map((fee) => ({
      id: fee.id,
      code: fee.code,
      name: fee.name,
      category: fee.category,
      pricingMode: fee.pricing_mode,
      defaultRate: Number(fee.default_rate),
      unitLabel: fee.unit_label ?? null,
      taxable: fee.taxable,
    })),
  };
});

/** Company-wide quote lifecycle counts for the Sales KPI cards. */
export interface QuoteStats {
  outstandingCount: number;
  outstandingValue: number;
  acceptedCount: number;
  decidedCount: number;
}

export const getQuoteStats = cache(async (): Promise<QuoteStats> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotes").select("status, total_amount");
  if (error) throw new Error(`Failed to load quote stats: ${error.message}`);

  const rows = (data ?? []).map((row) => ({ status: row.status as QuoteStatus, total: Number(row.total_amount) }));
  const outstanding = rows.filter((row) => row.status === "Sent" || row.status === "Viewed");
  const decided = rows.filter((row) => row.status === "Accepted" || row.status === "Declined");

  return {
    outstandingCount: outstanding.length,
    outstandingValue: outstanding.reduce((total, row) => total + row.total, 0),
    acceptedCount: rows.filter((row) => row.status === "Accepted").length,
    decidedCount: decided.length,
  };
});

/**
 * Mirrors app.has_any_perm(['proposals','pipeline'], true) read-side, so the
 * page can omit write affordances the database would reject. RLS remains the
 * enforcement; this only decides what to render.
 */
export const canWriteQuotes = cache(async (): Promise<boolean> => {
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
    .in("permission_set.slug", ["proposals", "pipeline"])
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
});
