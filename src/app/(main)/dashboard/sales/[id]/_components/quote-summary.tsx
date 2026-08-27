import { cn, formatCurrency } from "@/lib/utils";
import type { QuoteDetail } from "@/server/queries/quotes";

/**
 * The totals rail. Every figure is read off the quote row the database
 * returned; nothing here is computed in the app.
 */
export function QuoteSummary({ quote, className }: { quote: QuoteDetail; className?: string }) {
  const rows: Array<{ label: string; value: number; hidden?: boolean }> = [
    { label: `Labor (${quote.crewSize} movers, ${quote.estimatedHours}h)`, value: quote.laborTotal },
    { label: "Fees & materials", value: quote.accessorialsTotal, hidden: quote.accessorialsTotal === 0 },
    { label: "Valuation coverage", value: quote.valuationFee, hidden: quote.valuationFee === 0 },
  ];

  return (
    <div className={cn("flex flex-col gap-2 text-sm", className)}>
      {rows
        .filter((row) => !row.hidden)
        .map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="tabular-nums">{formatCurrency(row.value)}</span>
          </div>
        ))}

      <div className="flex items-baseline justify-between gap-4 border-t pt-2">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="tabular-nums">{formatCurrency(quote.subtotal)}</span>
      </div>

      {quote.discountAmount > 0 && (
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-muted-foreground">
            Discount{quote.discountType === "percent" ? ` (${quote.discountValue}%)` : ""}
          </span>
          <span className="tabular-nums">-{formatCurrency(quote.discountAmount)}</span>
        </div>
      )}

      {quote.taxRatePercent > 0 && (
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-muted-foreground">Tax ({quote.taxRatePercent}%)</span>
          <span className="tabular-nums">{formatCurrency(quote.taxAmount)}</span>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-4 border-t pt-2">
        <span className="font-medium">Total</span>
        <span className="font-semibold text-lg tabular-nums">{formatCurrency(quote.totalAmount)}</span>
      </div>

      {quote.depositAmount > 0 && (
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-muted-foreground">
            Deposit due{quote.depositType === "percent" ? ` (${quote.depositValue}%)` : ""}
          </span>
          <span className="tabular-nums">{formatCurrency(quote.depositAmount)}</span>
        </div>
      )}
    </div>
  );
}
