"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentStaff, requireAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Invoice mutations. Each runs as the signed-in staff member, so RLS
 * (app.has_any_perm(['invoices','billing'], true)) is the real gate; the
 * freeze triggers in 0006 protect anything past Draft. Postgres computes
 * every total, so these actions write inputs only and never subtotal,
 * discount, tax or total. company_id comes from the column default.
 */

export type InvoiceActionResult = { error: string } | { error?: undefined };
export type CreateInvoiceResult = { code: string } | { error: string };

const detailPath = (clientCode: string) => `/dashboard/clients/${clientCode}`;

function failure(prefix: string, message: string): InvoiceActionResult {
  return { error: `${prefix}: ${message}` };
}

/** Maps a Postgres constraint or RLS denial to copy a person can act on. */
function mapWriteError(prefix: string, error: { code?: string; message: string }): InvoiceActionResult {
  if (error.code === "42501" || error.code === "PGRST301") {
    return failure(prefix, "your role cannot change invoices.");
  }
  if (error.code === "23514") {
    // The freeze triggers and the due-after-issued check both surface here.
    if (/frozen/i.test(error.message)) {
      return failure(prefix, "this invoice has been sent and can no longer change. Void it and start a new one.");
    }
    if (/payment_due|due_after_issued/i.test(error.message)) {
      return failure(prefix, "the due date must fall on or after the issue date.");
    }
    return failure(prefix, "the invoice failed a validation rule.");
  }
  return failure(prefix, error.message);
}

const uuid = z.uuid();
const clientCodeSchema = z.string().trim().min(1);

// --- Create -----------------------------------------------------------

const createSchema = z.object({
  clientCode: clientCodeSchema,
  // "blank", "quote:<uuid>" or "deal:<uuid>".
  source: z
    .string()
    .trim()
    .regex(/^(blank|(quote|deal):[0-9a-f-]{36})$/i)
    .default("blank"),
});

type PrefillLine = {
  description: string;
  quantity: number;
  unit_price: number;
  taxable: boolean;
  position: number;
  source_quote_line_item_id?: string | null;
};

type QuotePrefill = {
  lines: PrefillLine[];
  discount_type: string;
  discount_value: number;
  tax_rate_id: string | null;
  tax_rate_percent: number;
};

/**
 * Reconciles a quote into invoice line items. A quote carries labor_total
 * and valuation_fee as header columns, not lines, so they are synthesized
 * here or the invoice total lands far below the quote it came from. A
 * percent_of_labor line has an amount that is not quantity * unit_price,
 * and invoice_line_items.amount is generated as quantity * unit_price, so
 * such a line is flattened to quantity 1 at its own amount.
 */
async function prefillFromQuote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
): Promise<QuotePrefill | null> {
  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, labor_total, valuation_fee, labor_taxable, valuation_taxable, discount_type, discount_value, tax_rate_id, tax_rate_percent, quote_line_items ( id, description, quantity, unit_price, taxable, amount, position )",
    )
    .eq("id", quoteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!quote) return null;

  const lines: PrefillLine[] = [];
  let position = 0;

  const laborTotal = Number(quote.labor_total);
  if (laborTotal > 0) {
    lines.push({
      description: "Labor",
      quantity: 1,
      unit_price: laborTotal,
      taxable: quote.labor_taxable,
      position: position++,
    });
  }

  const valuationFee = Number(quote.valuation_fee);
  if (valuationFee > 0) {
    lines.push({
      description: "Valuation coverage",
      quantity: 1,
      unit_price: valuationFee,
      taxable: quote.valuation_taxable,
      position: position++,
    });
  }

  const quoteLines = [...((quote.quote_line_items ?? []) as Record<string, unknown>[])].sort(
    (a, b) => Number(a.position) - Number(b.position),
  );
  for (const li of quoteLines) {
    const quantity = Number(li.quantity);
    const unitPrice = Number(li.unit_price);
    const amount = Number(li.amount);
    const simple = Math.round(quantity * unitPrice * 100) / 100 === amount;
    lines.push({
      description: String(li.description),
      quantity: simple ? quantity : 1,
      unit_price: simple ? unitPrice : amount,
      taxable: Boolean(li.taxable),
      position: position++,
      source_quote_line_item_id: String(li.id),
    });
  }

  return {
    lines,
    discount_type: quote.discount_type,
    discount_value: Number(quote.discount_value),
    tax_rate_id: quote.tax_rate_id ?? null,
    tax_rate_percent: Number(quote.tax_rate_percent),
  };
}

export async function createInvoice(input: z.input<typeof createSchema>): Promise<CreateInvoiceResult> {
  await requireAuth();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: "Could not create the invoice: the request was malformed." };
  const { clientCode, source } = parsed.data;

  const supabase = await createClient();
  const staff = await getCurrentStaff();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, email, billing_street, billing_city, billing_state, billing_zip")
    .eq("code", clientCode)
    .maybeSingle();
  if (clientError || !client) {
    return { error: `Could not create the invoice: ${clientError?.message ?? "client not found"}` };
  }

  let dealId: string | null = null;
  let quotePrefill: QuotePrefill | null = null;

  if (source.startsWith("quote:")) {
    const quoteId = source.slice("quote:".length);
    try {
      quotePrefill = await prefillFromQuote(supabase, quoteId);
    } catch (error) {
      return { error: `Could not create the invoice: ${error instanceof Error ? error.message : String(error)}` };
    }
  } else if (source.startsWith("deal:")) {
    dealId = source.slice("deal:".length);
    const { data: deal } = await supabase.from("deals").select("id, accepted_quote_id").eq("id", dealId).maybeSingle();
    if (deal?.accepted_quote_id) {
      try {
        quotePrefill = await prefillFromQuote(supabase, deal.accepted_quote_id);
      } catch {
        // A missing quote prefill is not fatal; the invoice links the deal
        // and the operator adds lines by hand.
        quotePrefill = null;
      }
    }
  }

  // Fall back to the default tax rate when nothing was prefilled.
  let taxRateId = quotePrefill?.tax_rate_id ?? null;
  let taxRatePercent = quotePrefill?.tax_rate_percent ?? 0;
  if (!quotePrefill) {
    const { data: tax } = await supabase
      .from("tax_rates")
      .select("id, rate_percent")
      .eq("is_default", true)
      .maybeSingle();
    taxRateId = tax?.id ?? null;
    taxRatePercent = tax ? Number(tax.rate_percent) : 0;
  }

  const { data: code, error: codeError } = await supabase.rpc("next_invoice_code");
  if (codeError || !code) {
    return mapWriteError("Could not create the invoice", codeError ?? { message: "an invoice number was not issued" });
  }

  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  const { data: invoice, error: insertError } = await supabase
    .from("invoices")
    .insert({
      code,
      client_id: client.id,
      deal_id: dealId,
      quote_id: source.startsWith("quote:") ? source.slice("quote:".length) : null,
      status: "Draft",
      payment_due_date: isoDate(due),
      bill_to_name: client.name,
      bill_to_email: client.email,
      bill_to_address_line1: client.billing_street,
      bill_to_address_line2: `${client.billing_city}, ${client.billing_state} ${client.billing_zip}`,
      tax_rate_id: taxRateId,
      tax_rate_percent: taxRatePercent,
      discount_type: quotePrefill?.discount_type ?? "fixed",
      discount_value: quotePrefill?.discount_value ?? 0,
      issued_by_staff_id: staff?.id ?? null,
    })
    .select("id")
    .single();
  if (insertError || !invoice) {
    return mapWriteError("Could not create the invoice", insertError ?? { message: "the invoice was not saved" });
  }

  if (quotePrefill && quotePrefill.lines.length > 0) {
    const { error: linesError } = await supabase.from("invoice_line_items").insert(
      quotePrefill.lines.map((line) => ({
        invoice_id: invoice.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        taxable: line.taxable,
        position: line.position,
        source_quote_line_item_id: line.source_quote_line_item_id ?? null,
      })),
    );
    if (linesError) return mapWriteError("Could not add the prefilled items", linesError);
  }

  revalidatePath(detailPath(clientCode));
  return { code };
}

// --- Draft edits ------------------------------------------------------

const draftPatchSchema = z.object({
  invoiceId: uuid,
  clientCode: clientCodeSchema,
  billToName: z.string().trim().min(1, "Enter who the invoice is billed to.").optional(),
  billToEmail: z.string().trim().max(255).nullable().optional(),
  billToAddressLine1: z.string().trim().max(255).nullable().optional(),
  billToAddressLine2: z.string().trim().max(255).nullable().optional(),
  customerTaxId: z.string().trim().max(255).nullable().optional(),
  issuedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  paymentDueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  taxRateId: uuid.nullable().optional(),
  discountType: z.enum(["fixed", "percent"]).optional(),
  discountValue: z.number().min(0).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function updateInvoiceDraft(input: z.input<typeof draftPatchSchema>): Promise<InvoiceActionResult> {
  await requireAuth();
  const parsed = draftPatchSchema.safeParse(input);
  if (!parsed.success)
    return failure("Could not save", parsed.error.issues[0]?.message ?? "the request was malformed.");
  const patch = parsed.data;

  const supabase = await createClient();
  const update: Record<string, unknown> = {};

  if (patch.billToName !== undefined) update.bill_to_name = patch.billToName;
  if (patch.billToEmail !== undefined) update.bill_to_email = patch.billToEmail || null;
  if (patch.billToAddressLine1 !== undefined) update.bill_to_address_line1 = patch.billToAddressLine1 || null;
  if (patch.billToAddressLine2 !== undefined) update.bill_to_address_line2 = patch.billToAddressLine2 || null;
  if (patch.customerTaxId !== undefined) update.customer_tax_id = patch.customerTaxId || null;
  if (patch.issuedDate !== undefined) update.issued_date = patch.issuedDate;
  if (patch.paymentDueDate !== undefined) update.payment_due_date = patch.paymentDueDate;
  if (patch.discountType !== undefined) update.discount_type = patch.discountType;
  if (patch.discountValue !== undefined) update.discount_value = patch.discountValue;
  if (patch.notes !== undefined) update.notes = patch.notes || null;

  if (patch.taxRateId !== undefined) {
    if (patch.taxRateId === null) {
      update.tax_rate_id = null;
      update.tax_rate_percent = 0;
    } else {
      const { data: tax, error: taxError } = await supabase
        .from("tax_rates")
        .select("id, rate_percent")
        .eq("id", patch.taxRateId)
        .maybeSingle();
      if (taxError || !tax) return failure("Could not save", taxError?.message ?? "that tax rate was not found.");
      update.tax_rate_id = tax.id;
      update.tax_rate_percent = Number(tax.rate_percent);
    }
  }

  if (Object.keys(update).length === 0) return {};

  const { error } = await supabase.from("invoices").update(update).eq("id", patch.invoiceId).eq("status", "Draft");
  if (error) return mapWriteError("Could not save", error);

  revalidatePath(detailPath(patch.clientCode));
  return {};
}

// --- Line items -------------------------------------------------------

export async function addInvoiceLineItem(input: {
  invoiceId: string;
  clientCode: string;
}): Promise<InvoiceActionResult> {
  await requireAuth();
  const parsed = z.object({ invoiceId: uuid, clientCode: clientCodeSchema }).safeParse(input);
  if (!parsed.success) return failure("Could not add the item", "the request was malformed.");
  const { invoiceId, clientCode } = parsed.data;

  const supabase = await createClient();
  const { data: positions } = await supabase
    .from("invoice_line_items")
    .select("position")
    .eq("invoice_id", invoiceId)
    .order("position", { ascending: false })
    .limit(1);

  const { error } = await supabase.from("invoice_line_items").insert({
    invoice_id: invoiceId,
    description: "",
    quantity: 1,
    unit_price: 0,
    taxable: true,
    position: (positions?.[0]?.position ?? -1) + 1,
  });
  if (error) return mapWriteError("Could not add the item", error);

  revalidatePath(detailPath(clientCode));
  return {};
}

const lineItemPatchSchema = z.object({
  lineId: uuid,
  clientCode: clientCodeSchema,
  description: z.string().trim().max(500).optional(),
  quantity: z.number().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
  taxable: z.boolean().optional(),
});

export async function updateInvoiceLineItem(input: z.input<typeof lineItemPatchSchema>): Promise<InvoiceActionResult> {
  await requireAuth();
  const parsed = lineItemPatchSchema.safeParse(input);
  if (!parsed.success) return failure("Could not save the item", "the request was malformed.");
  const patch = parsed.data;

  const update: Record<string, unknown> = {};
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.quantity !== undefined) update.quantity = patch.quantity;
  if (patch.unitPrice !== undefined) update.unit_price = patch.unitPrice;
  if (patch.taxable !== undefined) update.taxable = patch.taxable;
  if (Object.keys(update).length === 0) return {};

  const supabase = await createClient();
  const { error } = await supabase.from("invoice_line_items").update(update).eq("id", patch.lineId);
  if (error) return mapWriteError("Could not save the item", error);

  revalidatePath(detailPath(patch.clientCode));
  return {};
}

export async function removeInvoiceLineItem(input: {
  lineId: string;
  clientCode: string;
}): Promise<InvoiceActionResult> {
  await requireAuth();
  const parsed = z.object({ lineId: uuid, clientCode: clientCodeSchema }).safeParse(input);
  if (!parsed.success) return failure("Could not remove the item", "the request was malformed.");

  const supabase = await createClient();
  const { error } = await supabase.from("invoice_line_items").delete().eq("id", parsed.data.lineId);
  if (error) return mapWriteError("Could not remove the item", error);

  revalidatePath(detailPath(parsed.data.clientCode));
  return {};
}

// --- Lifecycle --------------------------------------------------------

export async function sendInvoice(input: { invoiceId: string; clientCode: string }): Promise<InvoiceActionResult> {
  await requireAuth();
  const parsed = z.object({ invoiceId: uuid, clientCode: clientCodeSchema }).safeParse(input);
  if (!parsed.success) return failure("Could not send the invoice", "the request was malformed.");
  const { invoiceId, clientCode } = parsed.data;

  const supabase = await createClient();
  const staff = await getCurrentStaff();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "Sent", issued_by_staff_id: staff?.id ?? null })
    .eq("id", invoiceId)
    .eq("status", "Draft");
  if (error) return mapWriteError("Could not send the invoice", error);

  revalidatePath(detailPath(clientCode));
  return {};
}

export async function markInvoicePaid(input: { invoiceId: string; clientCode: string }): Promise<InvoiceActionResult> {
  await requireAuth();
  const parsed = z.object({ invoiceId: uuid, clientCode: clientCodeSchema }).safeParse(input);
  if (!parsed.success) return failure("Could not mark the invoice paid", "the request was malformed.");
  const { invoiceId, clientCode } = parsed.data;

  const supabase = await createClient();
  // amount_paid must cover total_amount (invoices_paid_needs_payment_check).
  // Read the trigger-computed total and settle it in full.
  const { data: invoice, error: readError } = await supabase
    .from("invoices")
    .select("total_amount")
    .eq("id", invoiceId)
    .maybeSingle();
  if (readError || !invoice) {
    return failure("Could not mark the invoice paid", readError?.message ?? "the invoice was not found.");
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "Paid", amount_paid: Number(invoice.total_amount) })
    .eq("id", invoiceId)
    .eq("status", "Sent");
  if (error) return mapWriteError("Could not mark the invoice paid", error);

  revalidatePath(detailPath(clientCode));
  return {};
}

export async function voidInvoice(input: { invoiceId: string; clientCode: string }): Promise<InvoiceActionResult> {
  await requireAuth();
  const parsed = z.object({ invoiceId: uuid, clientCode: clientCodeSchema }).safeParse(input);
  if (!parsed.success) return failure("Could not void the invoice", "the request was malformed.");
  const { invoiceId, clientCode } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "Void" })
    .eq("id", invoiceId)
    .in("status", ["Draft", "Sent"]);
  if (error) return mapWriteError("Could not void the invoice", error);

  revalidatePath(detailPath(clientCode));
  return {};
}
