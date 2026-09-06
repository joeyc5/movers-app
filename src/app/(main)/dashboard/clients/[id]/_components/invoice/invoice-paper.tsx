import { formatCurrency } from "@/lib/utils";
import type { InvoiceView } from "@/server/queries/invoices";

import { INVOICE_PAPER_HEIGHT, INVOICE_PAPER_WIDTH, type InvoiceFromDetails } from "./data";

export function InvoicePaper({ invoice, from }: { invoice: InvoiceView; from: InvoiceFromDetails }) {
  const discountLabel = invoice.discountType === "percent" ? `Discount ${invoice.discountValue}%` : "Discount";
  const billToAddress = [invoice.billToAddressLine1, invoice.billToAddressLine2].filter(Boolean) as string[];
  const issuedBy = invoice.issuedByName ?? from.issuerName;

  return (
    <article
      style={{ width: INVOICE_PAPER_WIDTH, height: INVOICE_PAPER_HEIGHT }}
      data-print-paper
      className="relative flex flex-col gap-24 bg-neutral-50 px-12.25 py-11 font-mono text-neutral-950"
    >
      <header className="flex flex-col gap-10">
        <div className="grid grid-cols-2 items-start gap-14">
          <svg className="size-12" viewBox="0 0 48 48" aria-hidden="true">
            <rect width="20" height="20" rx="3" fill="currentColor" />
            <rect x="28" width="20" height="20" rx="3" fill="currentColor" />
            <rect y="28" width="20" height="20" rx="3" fill="currentColor" />
            <rect x="28" y="28" width="20" height="20" rx="3" fill="currentColor" />
          </svg>
          <h2 className="text-4xl uppercase tracking-widest">Invoice</h2>
        </div>

        <section className="grid grid-cols-2 gap-14 text-sm leading-relaxed">
          <div>
            <p>Reference: {invoice.code}</p>
            <p>Issued: {invoice.issuedDate}</p>
            <p>Payment due: {invoice.paymentDueDate}</p>
          </div>
          <div>
            <p>Payment account</p>
            <p>{from.paymentAccountName}</p>
            <p>Routing no. {from.routingNumber}</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-14 text-sm leading-relaxed">
          <div>
            <p className="mb-4 font-semibold uppercase">From</p>
            <p>{from.name}</p>
            {from.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p>Tax ID: {from.taxId}</p>
          </div>
          <div>
            <p className="mb-4 font-semibold uppercase">Bill to</p>
            <p>{invoice.billToName}</p>
            {billToAddress.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {invoice.customerTaxId ? <p>Tax ID: {invoice.customerTaxId}</p> : null}
          </div>
        </section>
      </header>

      <div className="flex flex-col gap-5">
        <section className="text-sm">
          <div className="grid grid-cols-[1fr_74px_116px_116px] bg-stone-200 px-3 py-3 font-semibold uppercase">
            <span>Description</span>
            <span className="text-right">Units</span>
            <span className="text-right">Unit cost</span>
            <span className="text-right">Line total</span>
          </div>
          {invoice.lineItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_74px_116px_116px] border-[oklch(0.86_0_0)] border-b px-3 py-4"
            >
              <span>{item.description || "Item"}</span>
              <span className="text-right">{item.quantity}</span>
              <span className="text-right">{formatInvoiceCurrency(item.unitPrice)}</span>
              <span className="text-right">{formatInvoiceCurrency(item.amount)}</span>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-2 gap-14 text-sm leading-relaxed">
          <section className="col-start-2 space-y-2">
            <div>
              <div className="flex justify-between gap-8">
                <span>Net amount</span>
                <span>{formatInvoiceCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span>{discountLabel}</span>
                <span>{formatInvoiceCurrency(invoice.discountAmount)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span>Tax {invoice.taxRatePercent}%</span>
                <span>{formatInvoiceCurrency(invoice.taxAmount)}</span>
              </div>
            </div>
            <div className="border-current border-y-2 py-3">
              <div className="flex justify-between gap-8">
                <span className="font-semibold uppercase">Balance due</span>
                <span className="font-semibold">{formatInvoiceCurrency(invoice.balanceDue)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="absolute right-12.25 bottom-11 left-12.25 grid grid-cols-2 gap-14 text-neutral-500 text-sm leading-relaxed">
        <div>
          <p>{from.email}</p>
          <p>{from.phone}</p>
          <p>{from.website}</p>
        </div>
        <div>
          <p>Prepared for prompt processing.</p>
          <p>Issued by {issuedBy}</p>
        </div>
      </footer>
    </article>
  );
}

function formatInvoiceCurrency(value: number) {
  return formatCurrency(Number.isFinite(value) ? value : 0, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
