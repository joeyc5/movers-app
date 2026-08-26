"use client";

import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";

import { formatCurrency } from "@/lib/utils";

import type { PipelineDeal, PipelineStage } from "../data";
import { SortableDealCard } from "./sortable-deal-card";

interface PipelineColumnProps {
  stage: PipelineStage;
  deals: PipelineDeal[];
}

export function PipelineColumn({ stage, deals }: PipelineColumnProps) {
  const dropTarget = useDroppable({
    id: stage,
    type: "deal-container",
    accept: "deal",
    collisionPriority: CollisionPriority.Low,
    data: { type: "deal-container", stage },
  });

  const stageValue = deals.reduce((total, deal) => total + deal.estimatedValue, 0);

  return (
    <section
      className={`flex min-h-0 flex-col rounded-t-xl border bg-muted/50 transition-colors ${
        dropTarget.isDropTarget ? "bg-muted/70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate font-medium text-base leading-none">{stage}</h2>
          <p className="text-muted-foreground text-sm tabular-nums leading-none">
            {deals.length} {deals.length === 1 ? "deal" : "deals"}
          </p>
        </div>
        <span className="shrink-0 font-medium text-muted-foreground text-sm tabular-nums">
          {formatCurrency(stageValue)}
        </span>
      </div>

      <div
        ref={dropTarget.ref}
        className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1"
      >
        {deals.map((deal, index) => (
          <SortableDealCard key={deal.id} deal={deal} stage={stage} index={index} />
        ))}
      </div>
    </section>
  );
}
