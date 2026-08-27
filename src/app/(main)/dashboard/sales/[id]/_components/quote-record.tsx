import { format } from "date-fns";
import { ArrowRight, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";
import type { QuoteDetail } from "@/server/queries/quotes";

import { QuoteLifecycleActions } from "./quote-lifecycle-actions";
import { quoteStatusMeta } from "./quote-meta";
import { QuoteSummary } from "./quote-summary";

function shortDate(value: string) {
  return format(new Date(value.length === 10 ? `${value}T00:00:00` : value), "MMM d, yyyy");
}

function addressLine(street: string | null, city: string | null, state: string | null, zip: string | null) {
  if (!street || !city) return city ?? null;
  return `${street}, ${city}${state ? `, ${state}` : ""}${zip ? ` ${zip}` : ""}`;
}

/** A quote past editing, or any quote for a reader without sales access. */
export function QuoteRecord({
  quote,
  dealCode,
  canWrite,
}: {
  quote: QuoteDetail;
  dealCode: string;
  canWrite: boolean;
}) {
  const meta = quoteStatusMeta[quote.status];
  const origin = addressLine(quote.originStreet, quote.originCity, quote.originState, quote.originZip);
  const destination = addressLine(
    quote.destinationStreet,
    quote.destinationCity,
    quote.destinationState,
    quote.destinationZip,
  );

  const timeline = [
    { label: "Issued", value: quote.issuedOn },
    { label: "Sent", value: quote.sentAt },
    { label: quote.status === "Declined" ? "Declined" : "Decided", value: quote.decidedAt },
    { label: "Valid until", value: quote.validUntil },
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry.value));

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-lg leading-none tabular-nums">{quote.code}</CardTitle>
              <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badgeClass)} variant="outline">
                <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
                {quote.status}
              </Badge>
            </div>
            {canWrite && <QuoteLifecycleActions quote={quote} dealCode={dealCode} />}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Client</span>
              <span className="font-medium">{quote.clientName}</span>
            </div>
            {quote.moveDate && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Move date</span>
                <span className="font-medium">{shortDate(quote.moveDate)}</span>
              </div>
            )}
            {(origin ?? destination) && (
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <span className="text-muted-foreground">Route</span>
                <span className="flex flex-wrap items-center gap-1.5 font-medium">
                  {origin ?? "Origin not recorded"}
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  {destination ?? "Destination not recorded"}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-medium tracking-tight">Pricing</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-normal">Item</TableHead>
                  <TableHead className="hidden text-right font-normal sm:table-cell">Qty</TableHead>
                  <TableHead className="hidden text-right font-normal sm:table-cell">Rate</TableHead>
                  <TableHead className="text-right font-normal">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    Labor: {quote.crewSize} movers, {quote.estimatedHours}h
                    <span className="block text-muted-foreground text-xs">
                      {quote.minHours}h minimum, overtime {quote.otMultiplier}x after {quote.otThresholdHours}h
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{quote.estimatedHours}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatCurrency(quote.hourlyRatePerMover)}/mover
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(quote.laborTotal)}</TableCell>
                </TableRow>
                {quote.lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{item.quantity}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {item.pricingMode === "percent_of_labor"
                        ? `${item.unitPrice}% of labor`
                        : formatCurrency(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
                {quote.valuationFee > 0 && (
                  <TableRow>
                    <TableCell>{quote.valuationType}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">1</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {formatCurrency(quote.valuationFee)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(quote.valuationFee)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {quote.notes && (
            <div className="flex flex-col gap-1 text-sm">
              <h3 className="font-medium tracking-tight">Notes</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{quote.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 lg:sticky lg:top-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-base leading-none">Quote summary</CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteSummary quote={quote} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2 text-sm">
            {timeline.map((entry) => (
              <div key={entry.label} className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">{entry.label}</span>
                <span className="tabular-nums">{shortDate(entry.value)}</span>
              </div>
            ))}
            {quote.status !== "Draft" && (
              <p className="flex items-center gap-1.5 border-t pt-2 text-muted-foreground text-xs">
                <Lock className="size-3" />
                Pricing locked when sent. Create a new quote to change it.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
