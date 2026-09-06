import { addDays, format } from "date-fns";

import type { InvoiceDiscountType, InvoiceStatus, InvoiceView } from "@/server/queries/invoices";

export type { InvoiceDiscountType } from "@/server/queries/invoices";

import type { Client } from "../../../_components/data";

/** The scaled paper preview geometry, shared by the preview and print views. */
export const INVOICE_PAPER_WIDTH = 816;
export const INVOICE_PAPER_HEIGHT = 1056;
export const INVOICE_PAPER_SCALE = 0.6;

/** The company block printed at the top of every invoice. */
export interface InvoiceFromDetails {
  name: string;
  email: string;
  phone: string;
  website: string;
  addressLines: string[];
  taxId: string;
  paymentAccountName: string;
  routingNumber: string;
  issuerName: string;
}

/** Shape of the columns read from public.company_billing_profile. */
export interface CompanyBillingProfile {
  name: string;
  email: string;
  phone: string;
  website: string;
  address_line1: string;
  address_line2: string;
  tax_id: string;
  payment_account_name: string;
  routing_number: string;
}

/**
 * Maps the company's billing profile row to the invoice "From" shape.
 * `profile` is null only when the lookup itself failed (see
 * getCompanyBillingProfile); every provisioned company has exactly one
 * row, so this renders blank fields rather than another tenant's data.
 */
export function companyBillingProfileToInvoiceFrom(
  profile: CompanyBillingProfile | null,
  issuerName: string,
): InvoiceFromDetails {
  if (!profile) {
    return {
      name: "",
      email: "",
      phone: "",
      website: "",
      addressLines: [],
      taxId: "",
      paymentAccountName: "",
      routingNumber: "",
      issuerName,
    };
  }

  return {
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    website: profile.website,
    addressLines: [profile.address_line1, profile.address_line2].filter(Boolean),
    taxId: profile.tax_id,
    paymentAccountName: profile.payment_account_name,
    routingNumber: profile.routing_number,
    issuerName,
  };
}

export const invoiceStatusMeta: Record<InvoiceStatus, { label: string; badgeClass: string; dotClass: string }> = {
  Draft: {
    label: "Draft",
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
  Sent: {
    label: "Sent",
    badgeClass: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dotClass: "bg-sky-500",
  },
  Paid: {
    label: "Paid",
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  Void: {
    label: "Void",
    badgeClass: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
};

/* The invoice form model and its money math. Restored from the
 * pre-multi-tenancy module: the live-data pass replaced the persisted
 * invoice shape here but left the draft-form components importing these. */

const today = new Date();

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTaxOption {
  id: string;
  name: string;
  rate: number;
}

export interface InvoiceToDetails {
  id: string;
  name: string;
  email: string;
  addressLines: string[];
  taxId?: string;
}

export interface InvoiceFormValues {
  referenceNumber: string;
  issuedDate: string;
  paymentDueDate: string;
  from: InvoiceFromDetails;
  to: InvoiceToDetails;
  taxId: string;
  discountType: InvoiceDiscountType;
  discountValue: number;
  items: InvoiceLineItem[];
}

export function clientToInvoiceDetails(client: Client): InvoiceToDetails {
  const { billingAddress } = client;

  return {
    id: client.id,
    name: client.name,
    email: client.email,
    addressLines: [billingAddress.street, `${billingAddress.city}, ${billingAddress.state} ${billingAddress.zip}`],
  };
}

export function getDefaultInvoiceValues(client: Client, from: InvoiceFromDetails): InvoiceFormValues {
  return {
    referenceNumber: `INV-${format(today, "yyyyMMdd")}`,
    issuedDate: format(today, "yyyy-MM-dd"),
    paymentDueDate: format(addDays(today, 14), "yyyy-MM-dd"),
    from,
    to: clientToInvoiceDetails(client),
    taxId: invoiceTaxOptions[0].id,
    discountType: "fixed",
    discountValue: 0,
    items: [],
  };
}

export const invoiceTaxOptions: InvoiceTaxOption[] = [
  {
    id: "ca-sales-tax",
    name: "CA Sales Tax",
    rate: 8.75,
  },
  {
    id: "none",
    name: "No Tax",
    rate: 0,
  },
];

export function getLineAmount(item?: InvoiceLineItem) {
  if (!item) return 0;

  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
  const unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;

  return quantity * unitPrice;
}

export function getInvoiceItems(invoice: InvoiceFormValues) {
  return invoice.items;
}

export function getInvoiceSubtotal(invoice: InvoiceFormValues) {
  return getInvoiceItems(invoice).reduce((subtotal, item) => subtotal + getLineAmount(item), 0);
}

export function getInvoiceTaxOption(invoice: InvoiceFormValues) {
  return invoiceTaxOptions.find((taxOption) => taxOption.id === invoice.taxId) ?? invoiceTaxOptions[0];
}

export function getInvoiceTax(invoice: InvoiceFormValues) {
  const taxRate = getInvoiceTaxOption(invoice).rate;

  return Math.max(getInvoiceSubtotal(invoice) - getInvoiceDiscount(invoice), 0) * (taxRate / 100);
}

export function getInvoiceDiscount(invoice: InvoiceFormValues) {
  const subtotal = getInvoiceSubtotal(invoice);
  const discountValue = Number.isFinite(invoice.discountValue) ? invoice.discountValue : 0;
  const discount = invoice.discountType === "percent" ? subtotal * (discountValue / 100) : discountValue;

  return Math.min(Math.max(discount, 0), subtotal);
}

export function getInvoiceTotal(invoice: InvoiceFormValues) {
  return Math.max(getInvoiceSubtotal(invoice) - getInvoiceDiscount(invoice), 0) + getInvoiceTax(invoice);
}

/**
 * Render a not-yet-saved invoice through the same paper component the saved
 * one uses. The draft carries only what the form collects; everything else is
 * either computed by the money helpers above or genuinely absent until the
 * invoice is persisted.
 */
export function draftInvoiceToView(invoice: InvoiceFormValues): InvoiceView {
  const [addressLine1 = null, addressLine2 = null] = invoice.to.addressLines;
  const subtotal = getInvoiceSubtotal(invoice);
  const discountAmount = getInvoiceDiscount(invoice);
  const taxOption = getInvoiceTaxOption(invoice);
  const taxAmount = getInvoiceTax(invoice);

  return {
    id: "",
    code: invoice.referenceNumber,
    clientId: invoice.to.id,
    dealId: null,
    quoteId: null,
    status: "Draft",
    issuedDate: invoice.issuedDate,
    paymentDueDate: invoice.paymentDueDate,
    billToName: invoice.to.name,
    billToEmail: invoice.to.email || null,
    billToAddressLine1: addressLine1,
    billToAddressLine2: addressLine2,
    customerTaxId: invoice.to.taxId ?? null,
    taxRateId: taxOption.id,
    taxRatePercent: taxOption.rate,
    discountType: invoice.discountType,
    discountValue: invoice.discountValue,
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount: getInvoiceTotal(invoice),
    amountPaid: 0,
    balanceDue: getInvoiceTotal(invoice),
    notes: null,
    issuedByName: null,
    createdAt: new Date().toISOString(),
    lineItems: invoice.items.map((item, position) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxable: true,
      amount: getLineAmount(item),
      position,
    })),
  };
}
