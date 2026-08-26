"use client";

import { format } from "date-fns";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Flame,
  type LucideIcon,
  Minus,
  XCircle,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn, formatCurrency, getInitials } from "@/lib/utils";

import { dealOwners, type PipelineDeal, type PipelineStage } from "../data";

const priorityBadgeConfig: Record<
  PipelineDeal["priority"],
  { icon: LucideIcon; variant: "destructive" | "secondary"; className: string }
> = {
  High: {
    icon: Flame,
    variant: "destructive",
    className: "border-transparent",
  },
  Medium: {
    icon: ArrowUpRight,
    variant: "secondary",
    className: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  Low: {
    icon: Minus,
    variant: "secondary",
    className: "bg-slate-500/10 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  },
};

export function DealCard({
  deal,
  stage,
  isOverlay = false,
}: {
  deal: PipelineDeal;
  stage?: PipelineStage;
  isOverlay?: boolean;
}) {
  const isWon = stage === "Won";
  const isLost = stage === "Lost";
  const owner = dealOwners[deal.ownerName];
  const PriorityIcon = priorityBadgeConfig[deal.priority].icon;

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs",
        isOverlay && "w-68 rotate-1 shadow-lg",
        isLost && "opacity-75",
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="min-w-0 truncate font-medium text-sm leading-none">{deal.clientName}</h3>
          <Badge
            variant={priorityBadgeConfig[deal.priority].variant}
            className={cn(
              "shrink-0 rounded-md border-transparent px-2 font-medium",
              priorityBadgeConfig[deal.priority].className,
            )}
          >
            <PriorityIcon data-icon="inline-start" />
            {deal.priority}
          </Badge>
        </div>
        <div className="font-medium text-lg tabular-nums leading-none">{formatCurrency(deal.estimatedValue)}</div>
        {deal.originCity ? (
          <p className="flex items-center gap-1 text-muted-foreground text-sm leading-5">
            <span className="truncate">{deal.originCity}</span>
            {deal.destinationCity ? (
              <>
                <ArrowRight className="size-3 shrink-0" />
                <span className="truncate">{deal.destinationCity}</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Avatar className={cn("size-5 after:rounded-sm", owner?.tone)}>
            <AvatarFallback className="rounded-sm text-xs">{getInitials(deal.ownerName)}</AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground text-sm">{deal.ownerName}</span>
        </div>

        {deal.moveDate ? (
          <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <span className="truncate text-sm">{format(new Date(deal.moveDate), "MMM d")}</span>
            <CalendarDays className="size-3" />
          </div>
        ) : null}
      </div>

      {isWon || isLost ? (
        <>
          <Separator />
          {isWon ? (
            <div className="flex items-center gap-1 font-medium text-green-700 text-sm dark:text-green-600">
              <BadgeCheck className="size-4" />
              Booked
            </div>
          ) : (
            <div className="flex items-center gap-1 font-medium text-muted-foreground text-sm">
              <XCircle className="size-4" />
              Lost
            </div>
          )}
        </>
      ) : null}
    </article>
  );
}
