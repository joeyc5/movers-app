import "server-only";

import { cache } from "react";

import type {
  DocumentFolderCard,
  DocumentItem,
  DocumentVisibility,
  FileKind,
  UploadClientOption,
} from "@/app/(main)/dashboard/documents/_components/data";
import { getCurrentStaff } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/utils";

/**
 * Documents data access.
 *
 * The screen is a company-wide file library backed by one private Storage
 * bucket. This table holds metadata only: size and modified-time are not
 * stored (0005), and the bucket holds no bytes yet, so the list shows the
 * record's own timestamp and omits size rather than inventing one.
 *
 * Every read runs as the signed-in staff member, so RLS decides which rows
 * come back. `starred` is the viewer's own state, joined from a set the
 * viewer alone can read.
 */

type StaffRef = { full_name: string } | { full_name: string }[] | null;

interface DocumentRow {
  id: string;
  name: string;
  kind: string;
  visibility: string;
  folder_id: string | null;
  storage_path: string;
  owner_staff_id: string | null;
  updated_at: string;
  owner: StaffRef;
}

const modifiedFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function ownerName(ref: StaffRef): string {
  if (!ref) return "";
  return Array.isArray(ref) ? (ref[0]?.full_name ?? "") : ref.full_name;
}

/** The library, newest first, with the viewer's stars folded in. */
export const getDocuments = cache(async (): Promise<DocumentItem[]> => {
  const supabase = await createClient();

  const [staff, documentsResult, starsResult] = await Promise.all([
    getCurrentStaff(),
    supabase
      .from("documents")
      .select(
        "id, name, kind, visibility, folder_id, storage_path, owner_staff_id, updated_at, owner:documents_owner_staff_id_fkey ( full_name )",
      )
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase.from("document_stars").select("document_id"),
  ]);

  if (documentsResult.error) {
    console.error("getDocuments: list failed", {
      code: documentsResult.error.code,
      message: documentsResult.error.message,
      details: documentsResult.error.details,
      hint: documentsResult.error.hint,
    });
    return [];
  }

  const currentStaffId = staff?.id ?? null;
  const starred = new Set((starsResult.data ?? []).map((row) => row.document_id));

  return (documentsResult.data as DocumentRow[]).map((row) => {
    const name = ownerName(row.owner);
    return {
      id: row.id,
      name: row.name,
      kind: row.kind as FileKind,
      ownerName: name,
      ownerInitials: name ? getInitials(name) : "",
      modifiedAt: modifiedFormatter.format(new Date(row.updated_at)),
      visibility: row.visibility as DocumentVisibility,
      folderId: row.folder_id,
      storagePath: row.storage_path,
      starred: starred.has(row.id),
      isOwn: currentStaffId !== null && row.owner_staff_id === currentStaffId,
    } satisfies DocumentItem;
  });
});

/** The flat folder taxonomy, with counts taken from the documents the viewer can see. */
export const getDocumentFolders = cache(async (): Promise<DocumentFolderCard[]> => {
  const supabase = await createClient();

  const [foldersResult, documents] = await Promise.all([
    supabase.from("document_folders").select("id, slug, name").order("position", { ascending: true }),
    getDocuments(),
  ]);

  if (foldersResult.error) {
    console.error("getDocumentFolders: list failed", {
      code: foldersResult.error.code,
      message: foldersResult.error.message,
    });
    return [];
  }

  const counts = new Map<string, number>();
  for (const document of documents) {
    if (document.folderId) counts.set(document.folderId, (counts.get(document.folderId) ?? 0) + 1);
  }

  return (foldersResult.data ?? []).map((folder) => ({
    id: folder.id,
    slug: folder.slug,
    name: folder.name,
    fileCount: counts.get(folder.id) ?? 0,
  }));
});

/** Clients a file can be filed under. A minimal projection kept here so this stream owns no other query file. */
export const getUploadClients = cache(async (): Promise<UploadClientOption[]> => {
  const supabase = await createClient();

  const { data, error } = await supabase.from("clients").select("id, code, name").order("name", { ascending: true });

  if (error) {
    console.error("getUploadClients: list failed", { code: error.code, message: error.message });
    return [];
  }

  return (data ?? []).map((client) => ({ id: client.id, code: client.code, name: client.name }));
});

/**
 * Mirrors app.has_perm('documents', true) on the read side, so the page can
 * omit library-manager affordances the database would reject. RLS is the
 * enforcement; this only decides what to render. Managing the library means
 * acting on files you do not own, creating folders, and filing to the
 * company shelf.
 */
export const canManageLibrary = cache(async (): Promise<boolean> => {
  const staff = await getCurrentStaff();
  if (!staff || staff.status !== "Active") return false;

  const level = staff.role?.access_level;
  if (level === "Read only") return false;
  if (level === "Full") return true;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_permission_sets")
    .select("permission_set:permission_set_id!inner ( slug )")
    .eq("role_id", staff.role_id)
    .eq("permission_set.slug", "documents")
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
});
