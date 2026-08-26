"use client";

import { useSortable } from "@dnd-kit/react/sortable";

import { cn } from "@/lib/utils";

import type { PipelineDeal, PipelineStage } from "../data";
import { DealCard } from "./deal-card";

export function SortableDealCard({ deal, stage, index }: { deal: PipelineDeal; stage: PipelineStage; index: number }) {
  const { isDragging, ref } = useSortable({
    id: deal.id,
    index,
    type: "deal",
    accept: "deal",
    group: stage,
    data: { type: "deal", deal, stage },
  });

  return (
    <div ref={ref} className={cn("touch-none", isDragging && "opacity-30")}>
      <DealCard deal={deal} stage={stage} />
    </div>
  );
}
