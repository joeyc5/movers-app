export type Role = {
  role: string;
  group: string;
  accessLevel: string;
  users: number;
  permissionSets: string[];
  lastReview: string;
  owner: string;
  status: "Active" | "Needs review";
};

export const roles: Role[] = [
  {
    role: "Owner",
    group: "Needs review",
    accessLevel: "Full",
    users: 1,
    permissionSets: ["Users", "Settings", "Billing", "Reports", "Clients", "Dispatch"],
    lastReview: "May 12, 2026",
    owner: "System",
    status: "Needs review",
  },
  {
    role: "Admin",
    group: "Needs review",
    accessLevel: "Full",
    users: 2,
    permissionSets: ["Users", "Settings", "Reports", "Billing", "Clients"],
    lastReview: "May 15, 2026",
    owner: "Grace Chen",
    status: "Needs review",
  },
  {
    role: "Driver",
    group: "Needs review",
    accessLevel: "Scoped",
    users: 3,
    permissionSets: ["Jobs", "Dispatch", "Fleet"],
    lastReview: "May 18, 2026",
    owner: "Grace Chen",
    status: "Needs review",
  },
  {
    role: "Read-only",
    group: "System roles",
    accessLevel: "Read only",
    users: 3,
    permissionSets: ["Clients", "Jobs", "Reports"],
    lastReview: "Jun 6, 2026",
    owner: "System",
    status: "Active",
  },
  {
    role: "Dispatcher",
    group: "Custom roles",
    accessLevel: "Scoped",
    users: 3,
    permissionSets: ["Dispatch", "Jobs", "Fleet", "Clients", "Calendar"],
    lastReview: "Jun 1, 2026",
    owner: "Grace Chen",
    status: "Active",
  },
  {
    role: "Sales Rep",
    group: "Custom roles",
    accessLevel: "Scoped",
    users: 4,
    permissionSets: ["Clients", "Pipeline", "Leads", "Proposals", "Calendar"],
    lastReview: "Jun 2, 2026",
    owner: "Marcus Webb",
    status: "Active",
  },
  {
    role: "Warehouse Lead",
    group: "Custom roles",
    accessLevel: "Scoped",
    users: 3,
    permissionSets: ["Storage", "Vaults", "Clients", "Reports"],
    lastReview: "Jun 3, 2026",
    owner: "Marcus Webb",
    status: "Active",
  },
  {
    role: "Crew Lead",
    group: "Custom roles",
    accessLevel: "Scoped",
    users: 3,
    permissionSets: ["Jobs", "Dispatch", "Fleet", "Documents"],
    lastReview: "May 30, 2026",
    owner: "Grace Chen",
    status: "Active",
  },
  {
    role: "Billing Specialist",
    group: "Custom roles",
    accessLevel: "Scoped",
    users: 3,
    permissionSets: ["Billing", "Invoices", "Clients", "Reports"],
    lastReview: "Jun 7, 2026",
    owner: "Marcus Webb",
    status: "Active",
  },
];
