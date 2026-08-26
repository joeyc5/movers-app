import {
  Calendar,
  ChartBar,
  FolderOpen,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Users,
  Warehouse,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    items: [
      {
        id: "dashboard",
        title: "Dashboard",
        url: "/dashboard/default",
        icon: LayoutDashboard,
      },
      {
        id: "sales",
        title: "Sales",
        url: "/dashboard/sales",
        icon: ChartBar,
      },
      {
        id: "calendar",
        title: "Calendar",
        url: "/dashboard/calendar",
        icon: Calendar,
      },
      {
        id: "warehouse",
        title: "Warehouse",
        url: "/dashboard/warehouse",
        icon: Warehouse,
      },
      {
        id: "clients",
        title: "Clients",
        url: "/dashboard/clients",
        icon: Users,
      },
      {
        id: "documents",
        title: "Documents",
        url: "/dashboard/documents",
        icon: FolderOpen,
      },
      {
        id: "settings",
        title: "Settings",
        url: "/dashboard/settings",
        icon: Settings,
      },
    ],
  },
];
