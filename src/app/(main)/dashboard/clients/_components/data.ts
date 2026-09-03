/**
 * Client types and display metadata. Rows come from `src/server/queries/clients.ts`;
 * the `id` the UI carries is the human code (`CLT-1001`), aliased there.
 */

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export type ClientType = "Residential" | "Commercial";
export type ClientStatus = "Lead" | "Active" | "In Storage" | "Past" | "Inactive";

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  status: ClientStatus;
  primaryContactName: string;
  email: string;
  phone: string;
  billingAddress: Address;
  originAddress?: Address;
  destinationAddress?: Address;
  accountOwner: string;
  createdDate: string;
  lastActivityDate: string;
  notes?: string;
}

export const filters = {
  type: ["All", "Residential", "Commercial"],
  status: ["All", "Lead", "Active", "In Storage", "Past", "Inactive"],
};

export const statusMeta: Record<ClientStatus, { badgeClass: string; dotClass: string }> = {
  Lead: {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  Active: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  "In Storage": {
    badgeClass: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dotClass: "bg-sky-500",
  },
  Past: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
  Inactive: {
    badgeClass: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
};

export function formatAddress(address?: Address) {
  if (!address) return undefined;
  return `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
}
