"use server";

import { revalidatePath } from "next/cache";

import { pipelineStages } from "@/app/(main)/dashboard/sales/_components/data";
import { requireAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Every exported function here is a public POST endpoint. Inputs are
 * validated at runtime, and RLS decides whether the caller's company and
 * role may write the row; a Read-only or wrong-company caller is denied by
 * the database, not by this file.
 */

const STAGES = pipelineStages as readonly string[];

export type DealActionResult = { error: string } | { error?: undefined };

interface DealPosition {
  code: string;
  position: number;
}

/**
 * Persist a pipeline drag. The moved card changes stage and position; the
 * other cards in the two affected columns get their new positions. The
 * stage write is done first and alone, because that is the write the
 * database can reject: dropping a deal into Won with no client violates
 * deals_won_needs_client (23514). When that happens the caller gets a
 * plain message and the board snaps back, and no position is touched.
 */
export async function moveDeal(input: {
  code: string;
  toStage: string;
  positions: DealPosition[];
}): Promise<DealActionResult> {
  await requireAuth();

  // A "use server" export is a public POST: the declared types are erased at
  // runtime, so the values are validated here as if they were unknown.
  const raw = input as { code?: unknown; toStage?: unknown; positions?: unknown };
  const code = String(raw.code ?? "").trim();
  const toStage = String(raw.toStage ?? "").trim();
  const positions = raw.positions;

  if (!/^DEAL-[0-9]+$/.test(code)) {
    return { error: "That deal could not be identified." };
  }
  if (!STAGES.includes(toStage)) {
    return { error: "That is not a real pipeline stage." };
  }
  if (
    !Array.isArray(positions) ||
    positions.some((p) => !/^DEAL-[0-9]+$/.test(String(p?.code)) || !Number.isInteger(p?.position))
  ) {
    return { error: "The board order was malformed." };
  }

  const validPositions = positions as DealPosition[];
  const supabase = await createClient();

  const moved = validPositions.find((p) => p.code === code);
  const movedPosition = moved?.position ?? 0;

  const { error: stageError } = await supabase
    .from("deals")
    .update({ stage: toStage, board_position: movedPosition })
    .eq("code", code);

  if (stageError) {
    // 23514 is the check-constraint class; the only reachable one here is
    // deals_won_needs_client.
    if (stageError.code === "23514") {
      return { error: "A won deal needs a client. Attach one before moving it to Won." };
    }
    return { error: "That move could not be saved." };
  }

  // Reindex the rest of the two affected columns. Small n; one round trip
  // per card is fine at this scale and keeps the write inside RLS with no
  // new database function.
  const rest = validPositions.filter((p) => p.code !== code);
  for (const p of rest) {
    const { error } = await supabase.from("deals").update({ board_position: p.position }).eq("code", p.code);
    if (error) {
      return { error: "The move saved, but the order did not fully update. Refresh to see the current board." };
    }
  }

  revalidatePath("/dashboard/sales");
  return {};
}
