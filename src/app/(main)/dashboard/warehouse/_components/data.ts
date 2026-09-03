import type { StorageAgreementStatus, VaultStatus } from "@/server/queries/warehouse";

export type { StorageAgreementStatus, VaultStatus } from "@/server/queries/warehouse";

export const storageStatusOptions: StorageAgreementStatus[] = [
  "Active",
  "Pending Move-In",
  "Past Due",
  "Move-Out Scheduled",
  "Closed",
];

export const vaultStatusOptions: VaultStatus[] = [
  "Occupied",
  "Partially Occupied",
  "Empty",
  "Reserved",
  "Out of Service",
];

export const storageStatusFilterOptions = ["All", ...storageStatusOptions];
export const vaultStatusFilterOptions = ["All", ...vaultStatusOptions];

export const storageStatusMeta: Record<StorageAgreementStatus, { badgeClass: string; dotClass: string }> = {
  Active: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  "Pending Move-In": {
    badgeClass: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dotClass: "bg-sky-500",
  },
  "Past Due": {
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  "Move-Out Scheduled": {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  Closed: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
};

export const vaultStatusMeta: Record<VaultStatus, { badgeClass: string; dotClass: string }> = {
  Occupied: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  "Partially Occupied": {
    badgeClass: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dotClass: "bg-sky-500",
  },
  Empty: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
  Reserved: {
    badgeClass: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    dotClass: "bg-violet-500",
  },
  "Out of Service": {
    badgeClass: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
};
