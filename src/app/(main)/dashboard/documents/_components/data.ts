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
export type DocumentVisibility = "team" | "restricted" | "private";

export const fileKinds: FileKind[] = [
  "document",
  "spreadsheet",
  "pdf",
  "archive",
  "contract",
  "bill-of-lading",
  "inventory",
  "insurance-certificate",
];

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

export const visibilityLabels: Record<DocumentVisibility, string> = {
  team: "Everyone",
  restricted: "Managers only",
  private: "Only me",
};

/** One folder card. Counts are computed over the documents the viewer can see. */
export interface DocumentFolderCard {
  id: string;
  slug: string;
  name: string;
  fileCount: number;
}

/** One file row. Size and modified-time are not stored; modifiedAt is the record's own timestamp. */
export interface DocumentItem {
  id: string;
  name: string;
  kind: FileKind;
  ownerName: string;
  ownerInitials: string;
  modifiedAt: string;
  visibility: DocumentVisibility;
  folderId: string | null;
  storagePath: string;
  starred: boolean;
  isOwn: boolean;
}

/** A client the uploader can attach a file to. */
export interface UploadClientOption {
  id: string;
  code: string;
  name: string;
}
