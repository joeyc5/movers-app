import Link from "next/link";

import { format } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { DealDetail } from "@/server/queries/deals";

import { stageBadgeMeta } from "../../_components/data";

export function DealHeader({ deal, acceptedQuoteCode }: { deal: DealDetail; acceptedQuoteCode?: string }) {
  const stageMeta = stageBadgeMeta[deal.stage];

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/dashboard/sales"
        className="inline-flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Sales
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading font-semibold text-xl tracking-tight">{deal.clientName}</h1>
            <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", stageMeta.badgeClass)} variant="outline">
              <span className={cn("size-1.5 rounded-full", stageMeta.dotClass)} />
              {deal.stage}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
            <span className="tabular-nums">{deal.id}</span>
            {deal.clientCode && (
              <Link href={`/dashboard/clients/${deal.clientCode}`} className="hover:text-foreground hover:underline">
                Client record
              </Link>
            )}
            {deal.ownerName && <span>{deal.ownerName}</span>}
            {deal.moveDate && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                {format(new Date(`${deal.moveDate}T00:00:00`), "MMM d, yyyy")}
              </span>
            )}
            {deal.originCity && deal.destinationCity && (
              <span className="inline-flex items-center gap-1.5">
                {deal.originCity}
                <ArrowRight className="size-3.5" />
                {deal.destinationCity}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span className="font-medium text-2xl tabular-nums leading-none tracking-tight">
            {formatCurrency(deal.estimatedValue)}
          </span>
          {deal.estimatedValueSource === "quote" && acceptedQuoteCode ? (
            <Link
              href={`/dashboard/sales/${deal.id}?quote=${acceptedQuoteCode}`}
              className="text-muted-foreground text-xs hover:text-foreground hover:underline"
            >
              From accepted quote {acceptedQuoteCode}
            </Link>
          ) : (
            <span className="text-muted-foreground text-xs">Manual estimate</span>
          )}
        </div>
      </div>
    </div>
  );
}
