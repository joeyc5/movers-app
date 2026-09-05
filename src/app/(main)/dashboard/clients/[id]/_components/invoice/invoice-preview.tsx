"use client";

import * as React from "react";

import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  draftInvoiceToView,
  INVOICE_PAPER_HEIGHT,
  INVOICE_PAPER_SCALE,
  INVOICE_PAPER_WIDTH,
  type InvoiceFormValues,
} from "./data";
import { InvoicePaper } from "./invoice-paper";
import { PrintInvoice } from "./print-invoice";
import { useVisibleCenterPosition } from "./use-visible-center-position";

/**
 * Below the mobile breakpoint the fit-to-width scale lands near 0.36, which
 * renders the paper's small print at ~5px. The floor keeps text readable and
 * trades it for horizontal panning, which touch already affords.
 */
const MOBILE_MIN_SCALE = 0.7;

function handlePrint() {
  window.print();
}

export function InvoicePreview({ invoice }: { invoice: InvoiceFormValues }) {
  const isMobile = useIsMobile();
  const previewBodyRef = React.useRef<HTMLDivElement>(null);
  const paperLayout = useVisibleCenterPosition(previewBodyRef, {
    height: INVOICE_PAPER_HEIGHT,
    maxScale: INVOICE_PAPER_SCALE,
    width: INVOICE_PAPER_WIDTH,
  });

  return (
    <>
      <PrintInvoice invoice={invoice} />
      {/* min-w-0: as a grid item this would otherwise grow to the paper's
          width instead of letting the mobile scroller pan. */}
      <div className="flex min-w-0 flex-col rounded-xl border bg-card">
        <div className="flex items-center justify-between px-4 py-4">
          <h2 className="font-medium text-lg">Preview</h2>
          <ButtonGroup>
            <Button type="button" variant="outline" onClick={handlePrint}>
              <Printer data-icon="inline-start" />
              Print
            </Button>
            <Button type="button" variant="outline">
              <Download data-icon="inline-start" />
              Download PDF
            </Button>
          </ButtonGroup>
        </div>

        {isMobile ? (
          <div className="scrollbar-none touch-pan-x overflow-x-auto overscroll-x-contain rounded-b-xl bg-stone-200 p-4 dark:bg-stone-800">
            <div
              style={{
                height: INVOICE_PAPER_HEIGHT * MOBILE_MIN_SCALE,
                width: INVOICE_PAPER_WIDTH * MOBILE_MIN_SCALE,
              }}
            >
              <div style={{ transform: `scale(${MOBILE_MIN_SCALE})` }} className="origin-top-left">
                <InvoicePaper invoice={draftInvoiceToView(invoice)} from={invoice.from} />
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={previewBodyRef}
            className="@container/preview relative min-h-[calc(100svh-15rem)] flex-1 rounded-b-xl bg-stone-200 p-4 dark:bg-stone-800"
          >
            {paperLayout === null ? (
              <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
                Loading Preview
              </div>
            ) : null}
            <div
              style={{
                height: paperLayout
                  ? INVOICE_PAPER_HEIGHT * paperLayout.scale
                  : INVOICE_PAPER_HEIGHT * INVOICE_PAPER_SCALE,
                top: paperLayout?.top ?? "50%",
                transform: paperLayout === null ? "translate(-50%, -50%)" : "translateX(-50%)",
                width: paperLayout
                  ? INVOICE_PAPER_WIDTH * paperLayout.scale
                  : INVOICE_PAPER_WIDTH * INVOICE_PAPER_SCALE,
              }}
              className="absolute left-1/2 opacity-0 data-[ready=true]:opacity-100"
              data-ready={paperLayout !== null}
            >
              <div
                style={{ transform: `scale(${paperLayout?.scale ?? INVOICE_PAPER_SCALE})` }}
                className="origin-top-left"
              >
                <InvoicePaper invoice={draftInvoiceToView(invoice)} from={invoice.from} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
