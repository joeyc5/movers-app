"use client";

import * as React from "react";

import { createPortal } from "react-dom";

import { draftInvoiceToView, type InvoiceFormValues } from "./data";
import { InvoicePaper } from "./invoice-paper";

export function PrintInvoice({ invoice }: { invoice: InvoiceFormValues }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div data-print-root>
      <InvoicePaper invoice={draftInvoiceToView(invoice)} from={invoice.from} />
    </div>,
    document.body,
  );
}
