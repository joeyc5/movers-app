import { File, FileArchive, FileBadge, FileBox, FileChartColumn, FileCheck, FileText } from "lucide-react";

export type FileKind =
  | "document"
  | "spreadsheet"
  | "pdf"
  | "archive"
  | "contract"
  | "bill-of-lading"
  | "inventory"
  | "insurance-certificate";
export type FileManagerView = "grid" | "list";

export const fileIcons = {
  archive: FileArchive,
  "bill-of-lading": FileCheck,
  contract: FileText,
  document: FileText,
  "insurance-certificate": FileBadge,
  inventory: FileBox,
  pdf: File,
  spreadsheet: FileChartColumn,
} satisfies Record<FileKind, typeof File>;

export const fileKindLabels: Record<FileKind, string> = {
  archive: "Archive",
  "bill-of-lading": "Bill of Lading",
  contract: "Contract",
  document: "Document",
  "insurance-certificate": "Insurance Certificate",
  inventory: "Inventory",
  pdf: "PDF",
  spreadsheet: "Spreadsheet",
};

export interface FileManagerFolder {
  id: string;
  name: string;
  fileCount: number;
  size: string;
  updatedAt: string;
}

export interface FileManagerFile {
  id: string;
  name: string;
  kind: FileKind;
  size: string;
  owner: string;
  ownerInitials: string;
  modifiedAt: string;
  shared: boolean;
  starred: boolean;
}

export const folders: FileManagerFolder[] = [
  {
    id: "contracts",
    name: "Contracts & estimates",
    fileCount: 42,
    size: "310 MB",
    updatedAt: "24 min ago",
  },
  {
    id: "bills-of-lading",
    name: "Bills of lading",
    fileCount: 67,
    size: "480 MB",
    updatedAt: "Yesterday",
  },
  {
    id: "insurance",
    name: "Insurance & claims",
    fileCount: 19,
    size: "150 MB",
    updatedAt: "Aug 21",
  },
  {
    id: "inventories",
    name: "Inventory sheets",
    fileCount: 54,
    size: "260 MB",
    updatedAt: "Aug 19",
  },
  {
    id: "fleet",
    name: "Fleet & DOT records",
    fileCount: 23,
    size: "190 MB",
    updatedAt: "Aug 15",
  },
  {
    id: "hr-forms",
    name: "Crew & HR forms",
    fileCount: 31,
    size: "120 MB",
    updatedAt: "Aug 11",
  },
];

export const files: FileManagerFile[] = [
  {
    id: "ruiz-estimate",
    name: "Ruiz move estimate.pdf",
    kind: "contract",
    size: "1.1 MB",
    owner: "Sam Okafor",
    ownerInitials: "SO",
    modifiedAt: "18 minutes ago",
    shared: true,
    starred: true,
  },
  {
    id: "harborline-bol",
    name: "Harborline Dental bill of lading.pdf",
    kind: "bill-of-lading",
    size: "860 KB",
    owner: "Elena Torres",
    ownerInitials: "ET",
    modifiedAt: "2 hours ago",
    shared: true,
    starred: false,
  },
  {
    id: "storage-billing",
    name: "Storage billing August.xlsx",
    kind: "spreadsheet",
    size: "2.2 MB",
    owner: "Renee Castillo",
    ownerInitials: "RC",
    modifiedAt: "Yesterday",
    shared: false,
    starred: false,
  },
  {
    id: "bellweather-inventory",
    name: "Bellweather vault inventory.pdf",
    kind: "inventory",
    size: "3.4 MB",
    owner: "Julia Ferreira",
    ownerInitials: "JF",
    modifiedAt: "Aug 22, 2026",
    shared: true,
    starred: true,
  },
  {
    id: "coi-baywood",
    name: "COI - Baywood Dental building.pdf",
    kind: "insurance-certificate",
    size: "520 KB",
    owner: "Marcus Webb",
    ownerInitials: "MW",
    modifiedAt: "Aug 21, 2026",
    shared: true,
    starred: false,
  },
  {
    id: "weiss-agreement",
    name: "Weiss storage agreement.docx",
    kind: "contract",
    size: "410 KB",
    owner: "Omar Haddad",
    ownerInitials: "OH",
    modifiedAt: "Aug 20, 2026",
    shared: false,
    starred: false,
  },
  {
    id: "crew-timesheets",
    name: "Crew timesheets week 34.xlsx",
    kind: "spreadsheet",
    size: "1.6 MB",
    owner: "Marcus Webb",
    ownerInitials: "MW",
    modifiedAt: "Aug 19, 2026",
    shared: true,
    starred: false,
  },
  {
    id: "moreno-photos",
    name: "Moreno pre-move photos.zip",
    kind: "archive",
    size: "148 MB",
    owner: "Miguel Santos",
    ownerInitials: "MS",
    modifiedAt: "Aug 18, 2026",
    shared: false,
    starred: false,
  },
  {
    id: "claims-procedure",
    name: "Damage claims procedure.docx",
    kind: "document",
    size: "290 KB",
    owner: "Grace Chen",
    ownerInitials: "GC",
    modifiedAt: "Aug 15, 2026",
    shared: true,
    starred: true,
  },
  {
    id: "duarte-bol",
    name: "Duarte move-out bill of lading.pdf",
    kind: "bill-of-lading",
    size: "780 KB",
    owner: "Elena Torres",
    ownerInitials: "ET",
    modifiedAt: "Aug 14, 2026",
    shared: true,
    starred: false,
  },
  {
    id: "truck-inspections",
    name: "Truck inspection reports Q3.zip",
    kind: "archive",
    size: "64 MB",
    owner: "Tyler Brooks",
    ownerInitials: "TB",
    modifiedAt: "Aug 12, 2026",
    shared: false,
    starred: false,
  },
  {
    id: "rate-sheet",
    name: "2026 rate sheet.pdf",
    kind: "pdf",
    size: "1.9 MB",
    owner: "Grace Chen",
    ownerInitials: "GC",
    modifiedAt: "Aug 8, 2026",
    shared: true,
    starred: false,
  },
];
