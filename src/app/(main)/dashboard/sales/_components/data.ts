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

export const deals: PipelineDeal[] = [
  {
    id: "DEAL-3001",
    clientName: "Priya Nair",
    stage: "Discovery",
    priority: "Medium",
    estimatedValue: 3200,
    moveDate: "2026-09-19",
    originCity: "Palo Alto",
    destinationCity: "San Jose",
    ownerName: "Fatima Rahman",
  },
  {
    id: "DEAL-3002",
    clientName: "Cascade Wealth Advisors",
    stage: "Discovery",
    priority: "High",
    estimatedValue: 18500,
    moveDate: "2026-10-03",
    originCity: "San Mateo",
    destinationCity: "Foster City",
    ownerName: "Omar Haddad",
  },
  {
    id: "DEAL-3003",
    clientName: "Odessa Fields",
    stage: "Discovery",
    priority: "Low",
    estimatedValue: 2100,
    originCity: "Santa Clara",
    ownerName: "Omar Haddad",
  },
  {
    id: "DEAL-3004",
    clientName: "Yusuf Karimi",
    stage: "Qualified",
    priority: "Medium",
    estimatedValue: 2850,
    moveDate: "2026-09-12",
    originCity: "San Jose",
    destinationCity: "Fremont",
    ownerName: "Sofia Marchetti",
  },
  {
    id: "DEAL-3005",
    clientName: "Meridian Title Co.",
    stage: "Qualified",
    priority: "High",
    estimatedValue: 12400,
    moveDate: "2026-10-17",
    originCity: "San Jose",
    destinationCity: "Campbell",
    ownerName: "Sam Okafor",
  },
  {
    id: "DEAL-3006",
    clientName: "Tessa Marlowe",
    stage: "Qualified",
    priority: "Low",
    estimatedValue: 1900,
    moveDate: "2026-09-26",
    originCity: "Sunnyvale",
    destinationCity: "Mountain View",
    ownerName: "Fatima Rahman",
  },
  {
    id: "DEAL-3007",
    clientName: "Amara Okonkwo",
    stage: "Proposal Sent",
    priority: "Medium",
    estimatedValue: 4600,
    moveDate: "2026-09-15",
    originCity: "Oakland",
    destinationCity: "Berkeley",
    ownerName: "Fatima Rahman",
  },
  {
    id: "DEAL-3008",
    clientName: "Baywood Dental Partners",
    stage: "Proposal Sent",
    priority: "High",
    estimatedValue: 21800,
    moveDate: "2026-11-07",
    originCity: "Hayward",
    destinationCity: "San Leandro",
    ownerName: "Sam Okafor",
  },
  {
    id: "DEAL-3009",
    clientName: "Colin Everhart",
    stage: "Proposal Sent",
    priority: "Low",
    estimatedValue: 2400,
    moveDate: "2026-09-29",
    originCity: "Walnut Creek",
    destinationCity: "Lafayette",
    ownerName: "Sofia Marchetti",
  },
  {
    id: "DEAL-3010",
    clientName: "Sasha Petrov",
    stage: "Negotiation",
    priority: "Medium",
    estimatedValue: 3900,
    moveDate: "2026-09-08",
    originCity: "Redwood City",
    destinationCity: "Menlo Park",
    ownerName: "Sam Okafor",
  },
  {
    id: "DEAL-3011",
    clientName: "Northgate Fitness",
    stage: "Negotiation",
    priority: "High",
    estimatedValue: 15600,
    moveDate: "2026-10-24",
    originCity: "Fremont",
    destinationCity: "Union City",
    ownerName: "Omar Haddad",
  },
  {
    id: "DEAL-3012",
    clientName: "Isabel Moreno",
    stage: "Won",
    priority: "Medium",
    estimatedValue: 4200,
    moveDate: "2026-09-05",
    originCity: "San Jose",
    destinationCity: "Mountain View",
    ownerName: "Sam Okafor",
  },
  {
    id: "DEAL-3013",
    clientName: "Harborline Dental Group",
    stage: "Won",
    priority: "High",
    estimatedValue: 16900,
    moveDate: "2026-09-22",
    originCity: "Oakland",
    destinationCity: "Berkeley",
    ownerName: "Fatima Rahman",
  },
  {
    id: "DEAL-3014",
    clientName: "Rosalind Pierce",
    stage: "Lost",
    priority: "Low",
    estimatedValue: 2700,
    originCity: "San Jose",
    ownerName: "Sam Okafor",
  },
  {
    id: "DEAL-3015",
    clientName: "Redline Auto Detailing",
    stage: "Lost",
    priority: "Medium",
    estimatedValue: 8300,
    originCity: "Fremont",
    ownerName: "Sofia Marchetti",
  },
];

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
  owner: ["All", "Sam Okafor", "Fatima Rahman", "Omar Haddad", "Sofia Marchetti"],
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
