"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PipelineDeal, PipelineStage } from "../data";
import { DealCard } from "./deal-card";

export function SortableDealCard({ deal, stage, index }: { deal: PipelineDeal; stage: PipelineStage; index: number }) {
  const { handleRef, isDragging, ref } = useSortable({
    id: deal.id,
    index,
    type: "deal",
    accept: "deal",
    group: stage,
    data: { type: "deal", deal, stage },
  });

  return (
    // No touch-action:none here. It used to sit on the whole card, which meant a horizontal
    // swipe starting anywhere on a card did nothing — and since cards cover most of the board,
    // 4 of the 5 columns were unreachable on a phone. Only the grip below opts out of panning.
    <div ref={ref} className={cn(isDragging && "opacity-30")}>
      <DealCard
        deal={deal}
        stage={stage}
        dragHandle={
          <button
            ref={handleRef}
            type="button"
            aria-label={`Reorder ${deal.clientName}`}
            className="touch-target -mr-1 cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  );
}
