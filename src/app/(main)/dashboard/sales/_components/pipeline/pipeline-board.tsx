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
import { toast } from "sonner";

import { moveDeal } from "@/server/deal-actions";

import { type BoardState, type PipelineDeal, type PipelineStage, pipelineStages } from "../data";
import { DealCard } from "./deal-card";
import { PipelineColumn } from "./pipeline-column";

/** The stage that currently holds a given deal in a board snapshot. */
function stageOf(board: BoardState, code: string): PipelineStage | null {
  for (const stage of pipelineStages) {
    if (board[stage].some((deal) => deal.id === code)) return stage;
  }
  return null;
}

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
  const boardRef = React.useRef<BoardState>(initialBoard);
  const boardBeforeDrag = React.useRef<BoardState>(initialBoard);
  const [, startTransition] = React.useTransition();

  // Keep the latest board in sync everywhere. setBoard flows through here so
  // handleDragEnd can read the just-dropped arrangement from a ref without
  // waiting for a re-render.
  const commitBoard = React.useCallback((next: BoardState) => {
    boardRef.current = next;
    setBoard(next);
  }, []);

  // The server is the source of truth after a refresh, so a new server
  // snapshot from revalidation replaces local state.
  React.useEffect(() => {
    boardRef.current = initialBoard;
    boardBeforeDrag.current = initialBoard;
    setBoard(initialBoard);
  }, [initialBoard]);

  function handleDragStart(event: DragStartEvent) {
    if (event.operation.source?.type === "deal") {
      boardBeforeDrag.current = boardRef.current;
    }
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.operation.source?.type === "deal") {
      commitBoard(move(boardRef.current, event));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (event.operation.source?.type !== "deal") return;

    const snapshot = boardBeforeDrag.current;

    if (event.canceled) {
      commitBoard(snapshot);
      return;
    }

    // handleDragOver already moved the card; boardRef holds the drop result.
    const current = boardRef.current;
    const code = String(event.operation.source.id);
    const toStage = stageOf(current, code);
    const fromStage = stageOf(snapshot, code);
    if (!toStage) return;

    const affected: PipelineStage[] = fromStage && fromStage !== toStage ? [fromStage, toStage] : [toStage];

    // A drop that changed nothing writes nothing.
    const beforeKey = affected.map((s) => snapshot[s].map((d) => d.id).join(",")).join("|");
    const afterKey = affected.map((s) => current[s].map((d) => d.id).join(",")).join("|");
    if (beforeKey === afterKey) return;

    const positions = affected.flatMap((stage) =>
      current[stage].map((deal, index) => ({ code: deal.id, position: index })),
    );

    startTransition(async () => {
      const result = await moveDeal({ code, toStage, positions });
      if (result.error) {
        toast.error(result.error);
        commitBoard(snapshot);
      }
    });
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
