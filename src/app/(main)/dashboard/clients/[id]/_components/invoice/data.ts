import type { InvoiceStatus } from "@/server/queries/invoices";

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
