import Link from "next/link";

import { cn, formatCurrency } from "@/lib/utils";
import type { QuoteDetail } from "@/server/queries/quotes";

import { quoteStatusMeta } from "./quote-meta";

/** One pill per quote on the deal, newest first. Server-rendered links, no client state. */
export function QuoteSwitcher({
  dealCode,
  quotes,
  selectedCode,
}: {
  dealCode: string;
  quotes: QuoteDetail[];
  selectedCode: string;
}) {
  // One quote needs no switcher; the card header already names it.
  if (quotes.length <= 1) return null;

  return (
    <div className="scrollbar-none flex touch-pan-x gap-2 overflow-x-auto overscroll-x-contain">
      {quotes.map((quote) => {
        const meta = quoteStatusMeta[quote.status];
        const active = quote.code === selectedCode;

        return (
          <Link
            key={quote.id}
            href={`/dashboard/sales/${dealCode}?quote=${quote.code}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              active ? "border-foreground/25 bg-accent/50" : "hover:bg-accent/30",
            )}
          >
            <span className="font-medium tabular-nums">{quote.code}</span>
            <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
            <span className="text-muted-foreground">{quote.status}</span>
            <span className="text-muted-foreground tabular-nums">{formatCurrency(quote.totalAmount)}</span>
          </Link>
        );
      })}
    </div>
  );
}
