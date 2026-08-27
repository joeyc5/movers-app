import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { getQuoteStats } from "@/server/queries/quotes";

import type { PipelineDeal } from "./data";

const openStages = ["Discovery", "Qualified", "Proposal Sent", "Negotiation"];

/**
 * Every figure is measured from deals and quotes as they stand. No
 * period-over-period badges: the data carries no prior period to compare to.
 */
export async function KpiCards({ deals }: { deals: PipelineDeal[] }) {
  const stats = await getQuoteStats();

  const openDeals = deals.filter((deal) => openStages.includes(deal.stage));
  const openPipelineValue = openDeals.reduce((total, deal) => total + deal.estimatedValue, 0);
  const wonDeals = deals.filter((deal) => deal.stage === "Won");
  const bookedValue = wonDeals.reduce((total, deal) => total + deal.estimatedValue, 0);

  const cards = [
    {
      label: "Open Pipeline Value",
      value: formatCurrency(openPipelineValue),
      detail: `${openDeals.length} open ${openDeals.length === 1 ? "deal" : "deals"}`,
    },
    {
      label: "Booked",
      value: formatCurrency(bookedValue),
      detail: `${wonDeals.length} won ${wonDeals.length === 1 ? "deal" : "deals"}`,
    },
    {
      label: "Quotes Awaiting Answer",
      value: String(stats.outstandingCount),
      detail: `${formatCurrency(stats.outstandingValue)} sent and undecided`,
    },
    {
      label: "Quote Acceptance",
      value: stats.decidedCount > 0 ? `${Math.round((stats.acceptedCount / stats.decidedCount) * 100)}%` : "—",
      detail:
        stats.decidedCount > 0
          ? `${stats.acceptedCount} of ${stats.decidedCount} decided ${stats.decidedCount === 1 ? "quote" : "quotes"} accepted`
          : "No decided quotes yet",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <span className="text-3xl leading-none tracking-tight tabular-nums">{card.value}</span>
            <p className="text-muted-foreground text-sm">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
