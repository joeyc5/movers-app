import "server-only";

import { cache } from "react";

import { getCurrentStaff } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Invoice data access.
 *
 * Every dollar figure here was computed by Postgres. subtotal, discount,
 * tax and total are maintained by the BEFORE triggers in 0006, and
 * amount/balance_due are stored generated columns. Nothing in the app
 * re-derives money, so the number on screen is the number that freezes
 * when an invoice is sent.
 */

export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Void";
export type InvoiceDiscountType = "fixed" | "percent";

export interface InvoiceLineItemView {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  amount: number;
  position: number;
}

export interface InvoiceView {
  id: string;
  code: string;
  clientId: string;
  dealId: string | null;
  quoteId: string | null;
  status: InvoiceStatus;
  issuedDate: string;
  paymentDueDate: string;
  billToName: string;
  billToEmail: string | null;
  billToAddressLine1: string | null;
  billToAddressLine2: string | null;
  customerTaxId: string | null;
  taxRateId: string | null;
  taxRatePercent: number;
  discountType: InvoiceDiscountType;
  discountValue: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  notes: string | null;
  issuedByName: string | null;
  createdAt: string;
  lineItems: InvoiceLineItemView[];
}

const INVOICE_COLUMNS = `
  id, code, client_id, deal_id, quote_id, status, issued_date, payment_due_date,
  bill_to_name, bill_to_email, bill_to_address_line1, bill_to_address_line2, customer_tax_id,
  tax_rate_id, tax_rate_percent, discount_type, discount_value,
  subtotal, discount_amount, tax_amount, total_amount, amount_paid, balance_due,
  notes, created_at,
  issued_by:staff!invoices_issued_by_staff_id_fkey ( full_name ),
  invoice_line_items ( id, description, quantity, unit_price, taxable, amount, position )
`;

// PostgREST types numerics loosely; normalise every money and rate figure once.
// biome-ignore lint/suspicious/noExplicitAny: raw PostgREST row
function toInvoice(row: any): InvoiceView {
  const lineItems = ((row.invoice_line_items ?? []) as any[])
    .map(
      (li): InvoiceLineItemView => ({
        id: li.id,
        description: li.description,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unit_price),
        taxable: li.taxable,
        amount: Number(li.amount),
        position: li.position,
      }),
    )
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

  const issuedBy = Array.isArray(row.issued_by) ? (row.issued_by[0] ?? null) : row.issued_by;

  return {
    id: row.id,
    code: row.code,
    clientId: row.client_id,
    dealId: row.deal_id ?? null,
    quoteId: row.quote_id ?? null,
    status: row.status,
    issuedDate: row.issued_date,
    paymentDueDate: row.payment_due_date,
    billToName: row.bill_to_name,
    billToEmail: row.bill_to_email ?? null,
    billToAddressLine1: row.bill_to_address_line1 ?? null,
    billToAddressLine2: row.bill_to_address_line2 ?? null,
    customerTaxId: row.customer_tax_id ?? null,
    taxRateId: row.tax_rate_id ?? null,
    taxRatePercent: Number(row.tax_rate_percent),
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    taxAmount: Number(row.tax_amount),
    totalAmount: Number(row.total_amount),
    amountPaid: Number(row.amount_paid),
    balanceDue: Number(row.balance_due),
    notes: row.notes ?? null,
    issuedByName: issuedBy?.full_name ?? null,
    createdAt: row.created_at,
    lineItems,
  };
}

/** Resolves a client's human code (CLT-1001) to its uuid, or null. */
async function resolveClientId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientCode: string,
): Promise<string | null> {
  const { data, error } = await supabase.from("clients").select("id").eq("code", clientCode).maybeSingle();
  if (error) throw new Error(`Failed to resolve client ${clientCode}: ${error.message}`);
  return data?.id ?? null;
}

export const getInvoicesForClient = cache(async (clientCode: string): Promise<InvoiceView[]> => {
  const supabase = await createClient();
  const clientId = await resolveClientId(supabase, clientCode);
  if (!clientId) return [];

  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("client_id", clientId)
    .order("issued_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load invoices for ${clientCode}: ${error.message}`);
  return (data ?? []).map(toInvoice);
});

export interface TaxRateOption {
  id: string;
  name: string;
  ratePercent: number;
  isDefault: boolean;
}

export const getInvoiceTaxRates = cache(async (): Promise<TaxRateOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_rates")
    .select("id, name, rate_percent, is_default")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Failed to load tax rates: ${error.message}`);
  // biome-ignore lint/suspicious/noExplicitAny: raw PostgREST rows
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    ratePercent: Number(row.rate_percent),
    isDefault: row.is_default,
  }));
});

/**
 * The Won deals and Accepted quotes a new invoice can be prefilled from.
 * A quote here has priced totals; a deal points at its accepted quote when
 * one exists. Both are scoped to the client the invoice belongs to.
 */
export interface InvoiceSourceOption {
  kind: "quote" | "deal";
  id: string;
  code: string;
  label: string;
  amount: number;
}

export const getInvoiceSources = cache(async (clientCode: string): Promise<InvoiceSourceOption[]> => {
  const supabase = await createClient();
  const clientId = await resolveClientId(supabase, clientCode);
  if (!clientId) return [];

  const [quotes, deals] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, code, total_amount")
      .eq("client_id", clientId)
      .eq("status", "Accepted")
      .order("created_at", { ascending: false }),
    supabase
      .from("deals")
      .select("id, code, estimated_value, accepted_quote_id")
      .eq("client_id", clientId)
      .eq("stage", "Won")
      .order("created_at", { ascending: false }),
  ]);

  if (quotes.error) throw new Error(`Failed to load accepted quotes: ${quotes.error.message}`);
  if (deals.error) throw new Error(`Failed to load won deals: ${deals.error.message}`);

  const sources: InvoiceSourceOption[] = [];
  for (const quote of quotes.data ?? []) {
    sources.push({
      kind: "quote",
      id: quote.id,
      code: quote.code,
      label: `Accepted quote ${quote.code}`,
      amount: Number(quote.total_amount),
    });
  }
  for (const deal of deals.data ?? []) {
    sources.push({
      kind: "deal",
      id: deal.id,
      code: deal.code,
      label: `Won deal ${deal.code}`,
      amount: Number(deal.estimated_value),
    });
  }
  return sources;
});

/**
 * Mirrors app.has_any_perm(['invoices','billing'], true) read-side, so the
 * page can omit write affordances the database would reject. RLS remains the
 * enforcement; this only decides what to render.
 */
export const canWriteInvoices = cache(async (): Promise<boolean> => {
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
    .in("permission_set.slug", ["invoices", "billing"])
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
});
