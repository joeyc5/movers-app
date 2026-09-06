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
  /** staff.id, the uuid every admin_* staff RPC targets. */
  id: string;
  roleSlug: string;
  email: string;
  joinedDate: string;
  lastActive: number;
  name: string;
  role: string;
  status: UserStatus;
  team: UserTeam;
  location: string[];
};

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
    id: member.id,
    roleSlug: member.roleSlug,
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
