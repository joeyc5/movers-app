export type UserStatus = "Active" | "Pending invite" | "Deactivated" | "Locked" | "Suspended";

const teamValues = [
  "Dispatch",
  "Sales",
  "Warehouse",
  "Fleet & Maintenance",
  "Customer Service",
  "Billing",
  "HR & Admin",
  "Leadership",
] as const;

export type UserTeam = (typeof teamValues)[number];

import type { StaffMember } from "@/server/queries/staff";

export type UserRow = {
  email: string;
  joinedDate: string;
  lastActive: number;
  name: string;
  role: string;
  status: UserStatus;
  team: UserTeam;
  location: string[];
};

export const users: UserRow[] = [
  {
    name: "Grace Chen",
    email: "grace.chen@example.com",
    role: "Owner",
    status: "Active",
    team: "Leadership",
    location: ["Oakland Warehouse", "San Jose Branch", "Fremont Depot"],
    joinedDate: "12 Jan 2021, 8:00 AM",
    lastActive: 0,
  },
  {
    name: "Marcus Webb",
    email: "marcus.webb@example.com",
    role: "Admin",
    status: "Active",
    team: "HR & Admin",
    location: ["Oakland Warehouse"],
    joinedDate: "03 Mar 2022, 9:15 AM",
    lastActive: 5,
  },
  {
    name: "Elena Torres",
    email: "elena.torres@example.com",
    role: "Dispatcher",
    status: "Active",
    team: "Dispatch",
    location: ["San Jose Branch"],
    joinedDate: "18 Jun 2023, 7:40 AM",
    lastActive: 12,
  },
  {
    name: "Sam Okafor",
    email: "sam.okafor@example.com",
    role: "Sales Rep",
    status: "Active",
    team: "Sales",
    location: ["Oakland Warehouse"],
    joinedDate: "22 Feb 2023, 1:20 PM",
    lastActive: 60,
  },
  {
    name: "Julia Ferreira",
    email: "julia.ferreira@example.com",
    role: "Warehouse Lead",
    status: "Active",
    team: "Warehouse",
    location: ["Fremont Depot"],
    joinedDate: "09 Sep 2022, 6:50 AM",
    lastActive: 20,
  },
  {
    name: "Tyler Brooks",
    email: "tyler.brooks@example.com",
    role: "Crew Lead",
    status: "Active",
    team: "Fleet & Maintenance",
    location: ["Oakland Warehouse", "Fremont Depot"],
    joinedDate: "14 Nov 2021, 11:05 AM",
    lastActive: 90,
  },
  {
    name: "Ana Delgado",
    email: "ana.delgado@example.com",
    role: "Driver",
    status: "Active",
    team: "Fleet & Maintenance",
    location: ["San Jose Branch"],
    joinedDate: "30 Jul 2023, 5:30 AM",
    lastActive: 240,
  },
  {
    name: "Derek Simmons",
    email: "derek.simmons@example.com",
    role: "Dispatcher",
    status: "Locked",
    team: "Dispatch",
    location: ["Oakland Warehouse"],
    joinedDate: "05 May 2022, 2:10 PM",
    lastActive: 480,
  },
  {
    name: "Fatima Rahman",
    email: "fatima.rahman@example.com",
    role: "Sales Rep",
    status: "Active",
    team: "Sales",
    location: ["San Jose Branch"],
    joinedDate: "11 Apr 2024, 10:45 AM",
    lastActive: 15,
  },
  {
    name: "Connor Blake",
    email: "connor.blake@example.com",
    role: "Admin",
    status: "Pending invite",
    team: "HR & Admin",
    location: ["Oakland Warehouse"],
    joinedDate: "20 Jun 2024, 3:15 PM",
    lastActive: 90 * 24 * 60,
  },
  {
    name: "Nadia Petrov",
    email: "nadia.petrov@example.com",
    role: "Warehouse Lead",
    status: "Active",
    team: "Warehouse",
    location: ["Oakland Warehouse"],
    joinedDate: "01 Oct 2022, 8:25 AM",
    lastActive: 30,
  },
  {
    name: "Wesley Grant",
    email: "wesley.grant@example.com",
    role: "Driver",
    status: "Suspended",
    team: "Fleet & Maintenance",
    location: ["Fremont Depot"],
    joinedDate: "17 Jan 2023, 4:00 PM",
    lastActive: 8 * 24 * 60,
  },
  {
    name: "Renee Castillo",
    email: "renee.castillo@example.com",
    role: "Billing Specialist",
    status: "Active",
    team: "Billing",
    location: ["Oakland Warehouse"],
    joinedDate: "25 Dec 2022, 9:35 AM",
    lastActive: 45,
  },
  {
    name: "Omar Haddad",
    email: "omar.haddad@example.com",
    role: "Sales Rep",
    status: "Active",
    team: "Sales",
    location: ["Fremont Depot"],
    joinedDate: "08 Aug 2023, 1:10 PM",
    lastActive: 24 * 60,
  },
  {
    name: "Lindsey Park",
    email: "lindsey.park@example.com",
    role: "Read-only",
    status: "Pending invite",
    team: "Customer Service",
    location: ["San Jose Branch"],
    joinedDate: "17 Jan 2024, 5:45 PM",
    lastActive: 90 * 24 * 60,
  },
  {
    name: "Miguel Santos",
    email: "miguel.santos@example.com",
    role: "Crew Lead",
    status: "Active",
    team: "Fleet & Maintenance",
    location: ["Oakland Warehouse"],
    joinedDate: "02 Oct 2021, 7:15 AM",
    lastActive: 6,
  },
  {
    name: "Brianna Cole",
    email: "brianna.cole@example.com",
    role: "Dispatcher",
    status: "Active",
    team: "Dispatch",
    location: ["San Jose Branch", "Fremont Depot"],
    joinedDate: "22 May 2023, 6:30 AM",
    lastActive: 10,
  },
  {
    name: "Jason Kwan",
    email: "jason.kwan@example.com",
    role: "Read-only",
    status: "Active",
    team: "Customer Service",
    location: ["Oakland Warehouse"],
    joinedDate: "14 Jul 2022, 6:05 PM",
    lastActive: 4 * 60,
  },
  {
    name: "Sofia Marchetti",
    email: "sofia.marchetti@example.com",
    role: "Sales Rep",
    status: "Deactivated",
    team: "Sales",
    location: ["Oakland Warehouse"],
    joinedDate: "26 Nov 2021, 3:40 PM",
    lastActive: 21 * 24 * 60,
  },
  {
    name: "Trevor Lang",
    email: "trevor.lang@example.com",
    role: "Driver",
    status: "Active",
    team: "Fleet & Maintenance",
    location: ["San Jose Branch"],
    joinedDate: "11 Apr 2023, 9:05 AM",
    lastActive: 18,
  },
  {
    name: "Aisha Bello",
    email: "aisha.bello@example.com",
    role: "Warehouse Lead",
    status: "Active",
    team: "Warehouse",
    location: ["Fremont Depot"],
    joinedDate: "09 Sep 2022, 12:25 PM",
    lastActive: 2 * 24 * 60,
  },
  {
    name: "Dylan Whitfield",
    email: "dylan.whitfield@example.com",
    role: "Billing Specialist",
    status: "Active",
    team: "Billing",
    location: ["Oakland Warehouse"],
    joinedDate: "05 Dec 2022, 2:15 PM",
    lastActive: 0,
  },
  {
    name: "Camille Roux",
    email: "camille.roux@example.com",
    role: "Crew Lead",
    status: "Active",
    team: "Fleet & Maintenance",
    location: ["San Jose Branch"],
    joinedDate: "18 Jun 2024, 4:50 PM",
    lastActive: 7,
  },
  {
    name: "Isaac Bergstrom",
    email: "isaac.bergstrom@example.com",
    role: "Read-only",
    status: "Active",
    team: "Customer Service",
    location: ["Fremont Depot"],
    joinedDate: "07 Feb 2024, 7:20 PM",
    lastActive: 60,
  },
  {
    name: "Paige Donovan",
    email: "paige.donovan@example.com",
    role: "Billing Specialist",
    status: "Pending invite",
    team: "Billing",
    location: ["San Jose Branch"],
    joinedDate: "29 Apr 2024, 11:55 AM",
    lastActive: 90 * 24 * 60,
  },
];

export const filters = {
  role: [
    "All",
    "Owner",
    "Admin",
    "Dispatcher",
    "Sales Rep",
    "Warehouse Lead",
    "Crew Lead",
    "Driver",
    "Billing Specialist",
    "Read-only",
  ],
  team: ["All", ...teamValues],
  status: ["All", "Active", "Pending invite", "Deactivated", "Locked", "Suspended"],
  location: ["All", "Oakland Warehouse", "San Jose Branch", "Fremont Depot"],
};

export const statusMeta: Record<UserStatus, { badgeClass: string; dotClass: string }> = {
  Active: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  "Pending invite": {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  Deactivated: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
  Locked: {
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  Suspended: {
    badgeClass: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
};

/**
 * Adapt a live staff row to the shape this table renders. Status and team are
 * free text in the database; anything outside the table's own vocabulary falls
 * back to a value it can style. Location has no column behind it, so it comes
 * back empty and the panel hides that column.
 */
export function staffToUserRow(member: StaffMember): UserRow {
  const status = (["Active", "Pending invite", "Deactivated", "Locked", "Suspended"] as const).find(
    (value) => value === member.status,
  );
  const team = teamValues.find((value) => value === member.team);
  const lastActiveMinutes = member.lastActiveAt
    ? Math.max(0, Math.round((Date.now() - new Date(member.lastActiveAt).getTime()) / 60_000))
    : Number.POSITIVE_INFINITY;

  return {
    name: member.fullName,
    email: member.workEmail,
    role: member.roleName,
    status: status ?? "Active",
    team: team ?? "Dispatch",
    location: [],
    joinedDate: new Date(member.joinedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    lastActive: lastActiveMinutes,
  };
}
