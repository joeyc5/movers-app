import "server-only";

import { cache } from "react";

import { type BoardState, buildBoard, type PipelineDeal } from "@/app/(main)/dashboard/sales/_components/data";
import { createClient } from "@/lib/supabase/server";

/**
 * Sales deals data access.
 *
 * As with clients, the UI's `id` is the human code (`DEAL-3001`). `clientName`
 * is denormalised on the row on purpose: a deal at Discovery may have no client
 * record at all, which is the normal state for a lead.
 */

const DEAL_COLUMNS = `
  id, code, client_id, client_name, stage, priority,
  estimated_value, estimated_value_source, accepted_quote_id,
  move_date, origin_city, destination_city, board_position,
  client:deals_client_id_fkey ( code ),
  owner:deals_owner_staff_id_fkey ( full_name )
`;

type Ref<T> = T | T[] | null;

interface DealRow {
  id: string;
  code: string;
  client_id: string | null;
  client_name: string;
  stage: string;
  priority: string;
  estimated_value: number | string;
  estimated_value_source: string;
  accepted_quote_id: string | null;
  move_date: string | null;
  origin_city: string | null;
  destination_city: string | null;
  board_position: number;
  client: Ref<{ code: string }>;
  owner: Ref<{ full_name: string }>;
}

function one<T>(ref: Ref<T>): T | null {
  if (!ref) return null;
  return Array.isArray(ref) ? (ref[0] ?? null) : ref;
}

/** A movers deal detail carries more than the board card shows. */
export interface DealDetail extends PipelineDeal {
  uuid: string;
  clientCode?: string;
  estimatedValueSource: "manual" | "quote";
  acceptedQuoteId?: string;
  boardPosition: number;
}

function toDeal(row: DealRow): DealDetail {
  return {
    id: row.code,
    uuid: row.id,
    clientName: row.client_name,
    clientCode: one(row.client)?.code,
    stage: row.stage as PipelineDeal["stage"],
    priority: row.priority as PipelineDeal["priority"],
    // numeric arrives as a JS number over PostgREST, but a string would coerce
    // silently into a broken sort, so it is normalised rather than trusted.
    estimatedValue: Number(row.estimated_value),
    estimatedValueSource: row.estimated_value_source as "manual" | "quote",
    acceptedQuoteId: row.accepted_quote_id ?? undefined,
    moveDate: row.move_date ?? undefined,
    originCity: row.origin_city ?? undefined,
    destinationCity: row.destination_city ?? undefined,
    ownerName: one(row.owner)?.full_name ?? "",
    boardPosition: row.board_position,
  };
}

export const getDeals = cache(async (): Promise<DealDetail[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select(DEAL_COLUMNS)
    .order("board_position", { ascending: true });

  if (error) throw new Error(`Failed to load deals: ${error.message}`);
  return (data as unknown as DealRow[]).map(toDeal);
});

export const getDealByCode = cache(async (code: string): Promise<DealDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("deals").select(DEAL_COLUMNS).eq("code", code).maybeSingle();

  if (error) throw new Error(`Failed to load deal ${code}: ${error.message}`);
  return data ? toDeal(data as unknown as DealRow) : null;
});

/** Board state for the Pipeline tab, grouped by stage in board_position order. */
export const getPipelineBoard = cache(async (): Promise<BoardState> => {
  return buildBoard(await getDeals());
});
