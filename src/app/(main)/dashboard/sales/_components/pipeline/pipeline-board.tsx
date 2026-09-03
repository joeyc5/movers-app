"use client";

import * as React from "react";

import { move } from "@dnd-kit/helpers";
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";

import { type BoardState, type PipelineDeal, type PipelineStage, pipelineStages } from "../data";
import { DealCard } from "./deal-card";
import { PipelineColumn } from "./pipeline-column";

interface PipelineBoardProps {
  initialBoard: BoardState;
}

type DealDragData = {
  type: "deal";
  deal: PipelineDeal;
  stage: PipelineStage;
};

function isPipelineStage(value: unknown): value is PipelineStage {
  return typeof value === "string" && (pipelineStages as readonly string[]).includes(value);
}

function isDealDragData(value: unknown): value is DealDragData {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "deal" &&
    "deal" in value &&
    typeof value.deal === "object" &&
    value.deal !== null &&
    "stage" in value &&
    isPipelineStage(value.stage)
  );
}

export function PipelineBoard({ initialBoard }: PipelineBoardProps) {
  const [board, setBoard] = React.useState<BoardState>(initialBoard);
  const boardBeforeDrag = React.useRef<BoardState>(initialBoard);

  function handleDragStart(event: DragStartEvent) {
    if (event.operation.source?.type === "deal") {
      boardBeforeDrag.current = board;
    }
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.operation.source?.type === "deal") {
      setBoard((currentBoard) => move(currentBoard, event));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled && event.operation.source?.type === "deal") {
      setBoard(boardBeforeDrag.current);
    }
  }

  return (
    <DragDropProvider onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="scrollbar-thin max-h-[70vh] min-w-0 overflow-x-auto overflow-y-hidden rounded-xl bg-muted/25 p-4 [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-1">
        <div
          className="inline-grid h-full max-h-[calc(70vh-2rem)] min-w-full gap-4"
          style={{ gridTemplateColumns: `repeat(${pipelineStages.length}, minmax(18rem, 1fr))` }}
        >
          {pipelineStages.map((stage) => (
            <PipelineColumn key={stage} stage={stage} deals={board[stage]} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {(source) => {
          if (source.type !== "deal" || !isDealDragData(source.data)) {
            return null;
          }

          const stage = isSortable(source) && isPipelineStage(source.group) ? source.group : source.data.stage;

          return <DealCard deal={source.data.deal} stage={stage} isOverlay />;
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}
