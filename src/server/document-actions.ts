"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentCompany, getCurrentStaff, requireAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Document mutations. Every action runs as the signed-in staff member, so RLS
 * is the real gate: the upload object policy checks the path's company and
 * scope segments, the row insert policy requires you to own the file, and
 * there is no delete grant, so "move to trash" is an update that sets
 * deleted_at behind the 49 CFR 375.505(d) retention floor.
 *
 * Actions return { error } instead of throwing: an RLS denial or a missing
 * object is an expected outcome the UI must show, not a crash.
 */

const DOCUMENTS_PATH = "/dashboard/documents";

export type DocumentActionResult = { error: string } | { error?: undefined };

function failure(prefix: string, message: string): DocumentActionResult {
  return { error: `${prefix}: ${message}` };
}

const KINDS = [
  "document",
  "spreadsheet",
  "pdf",
  "archive",
  "contract",
  "bill-of-lading",
  "inventory",
  "insurance-certificate",
] as const;

const VISIBILITIES = ["team", "restricted", "private"] as const;

/** Base filename without extension into a URL-safe segment. */
function slugify(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "file";
}

function extension(fileName: string): string {
  const match = fileName.match(/(\.[^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

const targetSchema = z.object({
  fileName: z.string().min(1).max(200),
  destination: z.enum(["client", "company"]),
  clientId: z.uuid().optional(),
});

/**
 * Reserves the object key the browser will upload to. The key encodes the
 * company and scope the storage insert policy checks; the caller streams the
 * bytes there, then calls saveDocument to write the metadata row.
 */
export async function createUploadTarget(
  input: z.infer<typeof targetSchema>,
): Promise<{ documentId: string; storagePath: string } | { error: string }> {
  await requireAuth();

  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return { error: "That upload could not be prepared." };
  const { fileName, destination, clientId } = parsed.data;

  const company = await getCurrentCompany();
  if (!company || company.state !== "ok" || !company.company_id) {
    return { error: "Your company could not be resolved." };
  }

  const documentId = crypto.randomUUID();
  const objectName = `${documentId}-${slugify(fileName)}${extension(fileName)}`;

  let scope: string;
  if (destination === "client") {
    if (!clientId) return { error: "Choose a client to file this under." };
    scope = `clients/${clientId}`;
  } else {
    scope = "company/shared";
  }

  return { documentId, storagePath: `${company.company_id}/${scope}/${objectName}` };
}

const saveSchema = z.object({
  documentId: z.uuid(),
  storagePath: z.string().min(1),
  name: z.string().trim().min(1, { message: "Give the file a name." }).max(200),
  kind: z.enum(KINDS),
  mimeType: z.string().min(1).max(200),
  folderId: z.uuid().nullable(),
  visibility: z.enum(VISIBILITIES),
});

/** Writes the metadata row once the bytes are in the bucket. Scope columns are derived from the path, so the two never disagree. */
export async function saveDocument(input: z.infer<typeof saveSchema>): Promise<DocumentActionResult> {
  await requireAuth();

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Could not save the file", parsed.error.issues[0]?.message ?? "invalid input");
  }
  const { documentId, storagePath, name, kind, mimeType, folderId, visibility } = parsed.data;

  const [company, staff] = await Promise.all([getCurrentCompany(), getCurrentStaff()]);
  if (!company || company.state !== "ok" || !company.company_id) {
    return failure("Could not save the file", "your company could not be resolved");
  }
  if (!staff) return failure("Could not save the file", "you are not staff on this company");

  const segments = storagePath.split("/");
  if (segments[0] !== company.company_id) {
    return failure("Could not save the file", "that upload path does not belong to your company");
  }
  const clientId = segments[1] === "clients" ? (segments[2] ?? null) : null;

  const { error } = await supabase(await createClient())
    .from("documents")
    .insert({
      id: documentId,
      name,
      kind,
      storage_bucket: "documents",
      storage_path: storagePath,
      mime_type: mimeType,
      owner_staff_id: staff.id,
      client_id: clientId,
      folder_id: folderId,
      visibility,
    });
  if (error) return failure("Could not save the file", error.message);

  revalidatePath(DOCUMENTS_PATH);
  return {};
}

/** Narrow helper so the insert above reads on one line. */
function supabase(client: Awaited<ReturnType<typeof createClient>>) {
  return client;
}

/** A short-lived signed URL, minted as the caller so object RLS decides whether it is issued. */
export async function createSignedDownloadUrl(storagePath: string): Promise<{ url: string } | { error: string }> {
  await requireAuth();
  const client = await createClient();

  const { data, error } = await client.storage.from("documents").createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) {
    return { error: "This file's contents aren't available to download." };
  }
  return { url: data.signedUrl };
}

/** Star is the viewer's own state, so even a read-only account may set it. */
export async function toggleStar(documentId: string, starred: boolean): Promise<DocumentActionResult> {
  await requireAuth();
  const staff = await getCurrentStaff();
  if (!staff) return failure("Could not update your star", "you are not staff on this company");

  const client = await createClient();

  if (starred) {
    const { error } = await client
      .from("document_stars")
      .upsert(
        { staff_id: staff.id, document_id: documentId },
        { onConflict: "staff_id,document_id", ignoreDuplicates: true },
      );
    if (error) return failure("Could not star the file", error.message);
  } else {
    const { error } = await client
      .from("document_stars")
      .delete()
      .eq("document_id", documentId)
      .eq("staff_id", staff.id);
    if (error) return failure("Could not unstar the file", error.message);
  }

  revalidatePath(DOCUMENTS_PATH);
  return {};
}

/** Move to trash: no delete grant exists, so this sets deleted_at. The bytes stay for the retention floor. */
export async function moveToTrash(documentId: string): Promise<DocumentActionResult> {
  await requireAuth();
  const client = await createClient();

  const { error } = await client
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId)
    .is("deleted_at", null);
  if (error) return failure("Could not move the file to trash", error.message);

  revalidatePath(DOCUMENTS_PATH);
  return {};
}

const folderSchema = z.object({
  name: z.string().trim().min(2, { message: "Give the folder a name." }).max(60),
});

/** New folder. Gated by has_perm('documents') in RLS, so a scoped user's attempt returns a clean denial. */
export async function createFolder(input: z.infer<typeof folderSchema>): Promise<DocumentActionResult> {
  await requireAuth();

  const parsed = folderSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Could not create the folder", parsed.error.issues[0]?.message ?? "invalid name");
  }

  const client = await createClient();
  const slug = slugify(parsed.data.name);

  const { error } = await client.from("document_folders").insert({ name: parsed.data.name, slug });
  if (error) {
    if (error.code === "23505") return failure("Could not create the folder", "a folder with that name already exists");
    return failure("Could not create the folder", error.message);
  }

  revalidatePath(DOCUMENTS_PATH);
  return {};
}
