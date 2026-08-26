import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

import { deals } from "./data";

const openStages = ["Discovery", "Qualified", "Proposal Sent", "Negotiation"];

export function KpiCards() {
  const openDeals = deals.filter((deal) => openStages.includes(deal.stage));
  const openPipelineValue = openDeals.reduce((total, deal) => total + deal.estimatedValue, 0);
  const bookedValue = deals
    .filter((deal) => deal.stage === "Won")
    .reduce((total, deal) => total + deal.estimatedValue, 0);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Open Pipeline Value</CardDescription>
          <CardAction>
            <ArrowUpRight className="size-4" />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none tracking-tight">{formatCurrency(openPipelineValue)}</span>
            <Badge
              variant="outline"
              className="border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300"
            >
              <TrendingUp />
              +9%
            </Badge>
          </div>
          <p className="text-sm">
            <span className="font-medium text-foreground">{openDeals.length}</span>{" "}
            <span className="text-muted-foreground">open deals</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Booked This Month</CardDescription>
          <CardAction>
            <ArrowUpRight className="size-4" />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none tracking-tight">{formatCurrency(bookedValue)}</span>
            <Badge
              variant="outline"
              className="border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300"
            >
              <TrendingUp />
              +2 jobs
            </Badge>
          </div>
          <p className="text-sm">
            <span className="font-medium text-foreground">{formatCurrency(14300)}</span>{" "}
            <span className="text-muted-foreground">last month</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>New Leads This Week</CardDescription>
          <CardAction>
            <ArrowUpRight className="size-4" />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none tracking-tight">7</span>
            <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
              <TrendingDown />
              -3
            </Badge>
          </div>
          <p className="text-sm">
            <span className="font-medium text-foreground">10</span>{" "}
            <span className="text-muted-foreground">last week</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Quote-to-Book Rate</CardDescription>
          <CardAction>
            <ArrowUpRight className="size-4" />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none tracking-tight">41%</span>
            <Badge
              variant="outline"
              className="border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300"
            >
              <TrendingUp />
              +4%
            </Badge>
          </div>
          <p className="text-sm">
            <span className="font-medium text-foreground">37%</span>{" "}
            <span className="text-muted-foreground">last month</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
