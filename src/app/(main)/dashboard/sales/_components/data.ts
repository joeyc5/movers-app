export const pipelineStages = ["Discovery", "Qualified", "Proposal Sent", "Negotiation", "Won", "Lost"] as const;

export type PipelineStage = (typeof pipelineStages)[number];

export interface DealOwnerProfile {
  name: string;
  tone: string;
}

export interface PipelineDeal {
  id: string;
  clientName: string;
  stage: PipelineStage;
  priority: "High" | "Medium" | "Low";
  estimatedValue: number;
  moveDate?: string;
  originCity?: string;
  destinationCity?: string;
  ownerName: string;
}

export type BoardState = Record<PipelineStage, PipelineDeal[]>;

export const dealOwners: Record<string, DealOwnerProfile> = {
  "Sam Okafor": {
    name: "Sam Okafor",
    tone: "[&_[data-slot=avatar-fallback]]:bg-sky-100 [&_[data-slot=avatar-fallback]]:text-sky-700 after:border-sky-200 dark:[&_[data-slot=avatar-fallback]]:bg-sky-500/15 dark:[&_[data-slot=avatar-fallback]]:text-sky-300 dark:after:border-sky-500/20",
  },
  "Fatima Rahman": {
    name: "Fatima Rahman",
    tone: "[&_[data-slot=avatar-fallback]]:bg-violet-100 [&_[data-slot=avatar-fallback]]:text-violet-700 after:border-violet-200 dark:[&_[data-slot=avatar-fallback]]:bg-violet-500/15 dark:[&_[data-slot=avatar-fallback]]:text-violet-300 dark:after:border-violet-500/20",
  },
  "Omar Haddad": {
    name: "Omar Haddad",
    tone: "[&_[data-slot=avatar-fallback]]:bg-emerald-100 [&_[data-slot=avatar-fallback]]:text-emerald-700 after:border-emerald-200 dark:[&_[data-slot=avatar-fallback]]:bg-emerald-500/15 dark:[&_[data-slot=avatar-fallback]]:text-emerald-300 dark:after:border-emerald-500/20",
  },
  "Sofia Marchetti": {
    name: "Sofia Marchetti",
    tone: "[&_[data-slot=avatar-fallback]]:bg-pink-100 [&_[data-slot=avatar-fallback]]:text-pink-700 after:border-pink-200 dark:[&_[data-slot=avatar-fallback]]:bg-pink-500/15 dark:[&_[data-slot=avatar-fallback]]:text-pink-300 dark:after:border-pink-500/20",
  },
};

export function buildBoard(allDeals: PipelineDeal[]): BoardState {
  const board: BoardState = {
    Discovery: [],
    Qualified: [],
    "Proposal Sent": [],
    Negotiation: [],
    Won: [],
    Lost: [],
  };

  for (const deal of allDeals) {
    board[deal.stage].push(deal);
  }

  return board;
}

export const leadsFilters = {
  stage: ["All", ...pipelineStages],
};

export const stageBadgeMeta: Record<PipelineStage, { badgeClass: string; dotClass: string }> = {
  Discovery: {
    badgeClass: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dotClass: "bg-sky-500",
  },
  Qualified: {
    badgeClass: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    dotClass: "bg-violet-500",
  },
  "Proposal Sent": {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  Negotiation: {
    badgeClass: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
  Won: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  Lost: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
};
