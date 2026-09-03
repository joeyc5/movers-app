export type StorageAgreementStatus = "Active" | "Pending Move-In" | "Past Due" | "Move-Out Scheduled" | "Closed";

export interface StorageCustomer {
  id: string;
  clientId: string;
  customerName: string;
  vaultIds: string[];
  monthlyRate: number;
  status: StorageAgreementStatus;
  moveInDate: string;
  nextBillingDate: string;
  warehouseLocation: string;
}

export type VaultStatus = "Occupied" | "Partially Occupied" | "Empty" | "Reserved" | "Out of Service";

export interface Vault {
  id: string;
  warehouseLocation: string;
  rack: string;
  capacityCubicFt: number;
  occupiedCubicFt: number;
  status: VaultStatus;
  assignedCustomerId?: string;
  lastInspectionDate: string;
}

export const warehouseLocations = ["Oakland Warehouse", "San Jose Branch", "Fremont Depot"];

export const storageCustomers: StorageCustomer[] = [
  {
    id: "STO-2001",
    clientId: "CLT-1002",
    customerName: "Bellweather Logistics",
    vaultIds: ["V-101", "V-102", "V-103", "V-118"],
    monthlyRate: 1240,
    status: "Active",
    moveInDate: "2025-11-20",
    nextBillingDate: "2026-09-01",
    warehouseLocation: "Oakland Warehouse",
  },
  {
    id: "STO-2002",
    clientId: "CLT-1008",
    customerName: "Lena Brandt",
    vaultIds: ["V-204"],
    monthlyRate: 185,
    status: "Active",
    moveInDate: "2026-03-02",
    nextBillingDate: "2026-09-02",
    warehouseLocation: "San Jose Branch",
  },
  {
    id: "STO-2003",
    clientId: "CLT-1015",
    customerName: "Harold Weiss",
    vaultIds: ["V-205", "V-206"],
    monthlyRate: 360,
    status: "Past Due",
    moveInDate: "2026-01-25",
    nextBillingDate: "2026-08-25",
    warehouseLocation: "San Jose Branch",
  },
  {
    id: "STO-2004",
    clientId: "CLT-1023",
    customerName: "Felix Duarte",
    vaultIds: ["V-104"],
    monthlyRate: 195,
    status: "Move-Out Scheduled",
    moveInDate: "2026-03-12",
    nextBillingDate: "2026-09-12",
    warehouseLocation: "Oakland Warehouse",
  },
  {
    id: "STO-2005",
    clientId: "CLT-1005",
    customerName: "Owen Fitzgerald",
    vaultIds: ["V-301"],
    monthlyRate: 175,
    status: "Pending Move-In",
    moveInDate: "2026-09-08",
    nextBillingDate: "2026-10-01",
    warehouseLocation: "Fremont Depot",
  },
  {
    id: "STO-2006",
    clientId: "CLT-1004",
    customerName: "Whitfield & Sons Law",
    vaultIds: [],
    monthlyRate: 0,
    status: "Closed",
    moveInDate: "2025-03-20",
    nextBillingDate: "—",
    warehouseLocation: "San Jose Branch",
  },
];

export const vaults: Vault[] = [
  {
    id: "V-101",
    warehouseLocation: "Oakland Warehouse",
    rack: "Rack A",
    capacityCubicFt: 700,
    occupiedCubicFt: 700,
    status: "Occupied",
    assignedCustomerId: "STO-2001",
    lastInspectionDate: "2026-07-14",
  },
  {
    id: "V-102",
    warehouseLocation: "Oakland Warehouse",
    rack: "Rack A",
    capacityCubicFt: 700,
    occupiedCubicFt: 665,
    status: "Occupied",
    assignedCustomerId: "STO-2001",
    lastInspectionDate: "2026-07-14",
  },
  {
    id: "V-103",
    warehouseLocation: "Oakland Warehouse",
    rack: "Rack A",
    capacityCubicFt: 700,
    occupiedCubicFt: 410,
    status: "Partially Occupied",
    assignedCustomerId: "STO-2001",
    lastInspectionDate: "2026-07-14",
  },
  {
    id: "V-104",
    warehouseLocation: "Oakland Warehouse",
    rack: "Rack B",
    capacityCubicFt: 500,
    occupiedCubicFt: 480,
    status: "Occupied",
    assignedCustomerId: "STO-2004",
    lastInspectionDate: "2026-08-02",
  },
  {
    id: "V-105",
    warehouseLocation: "Oakland Warehouse",
    rack: "Rack B",
    capacityCubicFt: 500,
    occupiedCubicFt: 0,
    status: "Empty",
    lastInspectionDate: "2026-08-02",
  },
  {
    id: "V-118",
    warehouseLocation: "Oakland Warehouse",
    rack: "Rack B",
    capacityCubicFt: 500,
    occupiedCubicFt: 130,
    status: "Partially Occupied",
    assignedCustomerId: "STO-2001",
    lastInspectionDate: "2026-08-02",
  },
  {
    id: "V-204",
    warehouseLocation: "San Jose Branch",
    rack: "Rack A",
    capacityCubicFt: 600,
    occupiedCubicFt: 540,
    status: "Occupied",
    assignedCustomerId: "STO-2002",
    lastInspectionDate: "2026-06-30",
  },
  {
    id: "V-205",
    warehouseLocation: "San Jose Branch",
    rack: "Rack A",
    capacityCubicFt: 600,
    occupiedCubicFt: 600,
    status: "Occupied",
    assignedCustomerId: "STO-2003",
    lastInspectionDate: "2026-06-30",
  },
  {
    id: "V-206",
    warehouseLocation: "San Jose Branch",
    rack: "Rack B",
    capacityCubicFt: 450,
    occupiedCubicFt: 495,
    status: "Occupied",
    assignedCustomerId: "STO-2003",
    lastInspectionDate: "2026-06-30",
  },
  {
    id: "V-207",
    warehouseLocation: "San Jose Branch",
    rack: "Rack B",
    capacityCubicFt: 450,
    occupiedCubicFt: 0,
    status: "Reserved",
    assignedCustomerId: "STO-2005",
    lastInspectionDate: "2026-08-10",
  },
  {
    id: "V-301",
    warehouseLocation: "Fremont Depot",
    rack: "Rack A",
    capacityCubicFt: 550,
    occupiedCubicFt: 0,
    status: "Reserved",
    assignedCustomerId: "STO-2005",
    lastInspectionDate: "2026-08-12",
  },
  {
    id: "V-302",
    warehouseLocation: "Fremont Depot",
    rack: "Rack A",
    capacityCubicFt: 550,
    occupiedCubicFt: 90,
    status: "Partially Occupied",
    lastInspectionDate: "2026-08-12",
  },
  {
    id: "V-303",
    warehouseLocation: "Fremont Depot",
    rack: "Rack B",
    capacityCubicFt: 550,
    occupiedCubicFt: 0,
    status: "Out of Service",
    lastInspectionDate: "2026-05-19",
  },
  {
    id: "V-304",
    warehouseLocation: "Fremont Depot",
    rack: "Rack B",
    capacityCubicFt: 550,
    occupiedCubicFt: 0,
    status: "Empty",
    lastInspectionDate: "2026-08-12",
  },
];

export const storageCustomerFilters = {
  status: ["All", "Active", "Pending Move-In", "Past Due", "Move-Out Scheduled", "Closed"],
  location: ["All", ...warehouseLocations],
};

export const vaultFilters = {
  status: ["All", "Occupied", "Partially Occupied", "Empty", "Reserved", "Out of Service"],
  location: ["All", ...warehouseLocations],
};

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

export function getVaultOccupancyPercent(vault: Vault) {
  if (vault.capacityCubicFt <= 0) return 0;
  return Math.round((vault.occupiedCubicFt / vault.capacityCubicFt) * 100);
}
