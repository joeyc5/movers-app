import "server-only";

import { cache } from "react";

import { endOfWeek, startOfWeek } from "date-fns";

import { createClient } from "@/lib/supabase/server";

/**
 * Aggregates for the dashboard metric cards. Each figure is measured from the
 * same tables the detail screens read, so a card can never disagree with the
 * screen it links to. No period-over-period deltas: the database holds no
 * history to compute them from, and a made-up trend is worse than none.
 */

export interface DashboardMetrics {
  jobsThisWeek: { total: number; moves: number; surveys: number };
  booked: { total: number; wonDeals: number };
  storage: { percent: number; occupiedCubicFt: number; capacityCubicFt: number; vaultCount: number };
  openLeads: { count: number; value: number };
}

const OPEN_STAGES = ["Discovery", "Qualified", "Proposal Sent", "Negotiation"];

export const getDashboardMetrics = cache(async (): Promise<DashboardMetrics> => {
  const supabase = await createClient();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [events, deals, vaults] = await Promise.all([
    supabase
      .from("calendar_events_expanded")
      .select("entity_type, status")
      .in("entity_type", ["job", "survey"])
      .gte("starts_at", weekStart.toISOString())
      .lte("starts_at", weekEnd.toISOString()),
    supabase.from("deals").select("stage, estimated_value"),
    supabase.from("vaults_expanded").select("capacity_cubic_ft, occupied_cubic_ft"),
  ]);

  const firstError = events.error ?? deals.error ?? vaults.error;
  if (firstError) throw new Error(`Failed to load dashboard metrics: ${firstError.message}`);

  const weekEvents = (events.data ?? []).filter((event) => event.status !== "Canceled");
  const moves = weekEvents.filter((event) => event.entity_type === "job").length;
  const surveys = weekEvents.filter((event) => event.entity_type === "survey").length;

  const dealRows = (deals.data ?? []).map((deal) => ({ stage: deal.stage, value: Number(deal.estimated_value) }));
  const wonDeals = dealRows.filter((deal) => deal.stage === "Won");
  const openDeals = dealRows.filter((deal) => OPEN_STAGES.includes(deal.stage));

  const capacityCubicFt = (vaults.data ?? []).reduce((total, vault) => total + Number(vault.capacity_cubic_ft), 0);
  const occupiedCubicFt = (vaults.data ?? []).reduce((total, vault) => total + Number(vault.occupied_cubic_ft), 0);

  return {
    jobsThisWeek: { total: moves + surveys, moves, surveys },
    booked: {
      total: wonDeals.reduce((total, deal) => total + deal.value, 0),
      wonDeals: wonDeals.length,
    },
    storage: {
      percent: capacityCubicFt > 0 ? Math.round((occupiedCubicFt / capacityCubicFt) * 100) : 0,
      occupiedCubicFt,
      capacityCubicFt,
      vaultCount: (vaults.data ?? []).length,
    },
    openLeads: {
      count: openDeals.length,
      value: openDeals.reduce((total, deal) => total + deal.value, 0),
    },
  };
});
