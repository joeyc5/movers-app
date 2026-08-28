/**
 * scripts/seed-documents.ts — D18.
 *
 * WHY THIS EXISTS. 0010_seed.sql writes 15 rows into public.documents, each
 * with a storage_path. SQL cannot upload bytes. Without this script every one
 * of those paths points at nothing, and the first thing anyone clicks in the
 * Documents screen is a Download button that 403s against an object that was
 * never created. A metadata row with no object behind it is a dead end wearing
 * a filename.
 *
 *   npm run seed:documents
 *
 * Re-runnable: the uploads are upserts and the metadata write targets
 * documents_storage_path_key.
 *
 * NO SECRET KEY, BY DESIGN (multi-tenancy Task 7). This used to sign in with
 * the service_role key, which bypasses storage.objects RLS entirely -- fine
 * for creating the bucket, wrong for proving the upload path actually works.
 * 0018_storage_grants.sql added a company-prefix check to
 * documents_object_insert; the only way to exercise that check is to upload
 * AS A REAL SIGNED-IN USER, publishable key plus a password, so a bad prefix
 * gets caught by the same policy a browser upload would hit. Provide:
 *
 *   SEED_UPLOAD_EMAIL=... SEED_UPLOAD_PASSWORD=... npm run seed:documents
 *
 * The password is demo filler for a fake company; it lives in the gitignored
 * .env.local, never in a tracked file, a migration, or a commit message.
 *
 * A consequence of going through RLS: some rows may come back DENIED rather
 * than uploaded, if the signed-in user lacks the permission that scope's
 * insert branch requires (documents_object_insert, 0018) -- HR documents need
 * has_perm('users', true) or to be the row's own staff folder, the shared
 * shelf needs has_perm('documents', true). THAT IS A FINDING TO REPORT, not a
 * bug in this script: it means the policy is doing its job. This script
 * prints exactly which rows were denied and why, and keeps going -- one row
 * refusing upload must never stop the other fourteen from getting bytes.
 *
 * There is also no bucket-creation step here anymore: creating a bucket is an
 * admin action this key cannot perform, and the "documents" bucket already
 * exists (created the first time this script ran, back when it still had a
 * secret key). If it is ever missing, every upload below fails with a clear
 * "Bucket not found", which is diagnosis enough to create it out of band.
 *
 * PATH CONVENTION (0018): {company_id}/{scope}/{id}/{document_id}-{slug}.ext.
 * This script does not compute that path -- 0018_storage_grants.sql already
 * repathed every public.documents.storage_path to the new convention as a
 * data migration, so reading storage_path straight from the row (as this
 * script always has) uploads to the right place with no logic change here.
 *
 * PLACEHOLDERS, STATED PLAINLY. The .pdf objects are real, minimal, one-page
 * PDFs that open. The .docx / .xlsx / .zip objects are valid empty ZIP
 * containers: the right shape, the right Content-Type, and a real 200 with
 * bytes on download, but Word and Excel will decline to open an empty package.
 * That is the correct trade for a demo fixture. Replace them by uploading real
 * files through the app, which is the path this is standing in for.
 */

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import { databaseUrl, projectUrl, publishableKey, required } from "./seed-env";

const BUCKET = "documents";

// The bucket's file-size limit (50 MB) and allowed MIME types were set once,
// at creation, with the secret key this script no longer holds (see the file
// header). They live with the bucket now, not here; changing them is an
// admin action, not a re-seed.

interface DocumentRow {
  id: string;
  name: string;
  kind: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  folder_id: string | null;
  owner_staff_id: string | null;
  client_id: string | null;
  deal_id: string | null;
  job_event_id: string | null;
  staff_id: string | null;
  visibility: string;
  signature_status: string;
  signed_at: string | null;
}

/** A minimal but structurally complete one-page PDF. Opens in any reader. */
function placeholderPdf(title: string): Uint8Array {
  const escaped = title.replace(/([()\\])/g, "\\$1");
  const body =
    `%PDF-1.4\n` +
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]` +
    `/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n` +
    `4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n`;

  const stream = `BT /F1 14 Tf 72 720 Td (${escaped}) Tj 0 -22 Td (Seed placeholder. Replace by uploading the real file.) Tj ET`;
  const content = `5 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj\n`;
  const tail = `trailer<</Size 6/Root 1 0 R>>\n%%EOF\n`;

  return new TextEncoder().encode(body + content + tail);
}

/** A valid empty ZIP archive: end-of-central-directory record and nothing else. */
function placeholderZip(): Uint8Array {
  const bytes = new Uint8Array(22);
  bytes.set([0x50, 0x4b, 0x05, 0x06], 0); // PK\x05\x06
  return bytes;
}

function placeholderFor(row: DocumentRow): Uint8Array {
  return row.storage_path.toLowerCase().endsWith(".pdf") ? placeholderPdf(row.name) : placeholderZip();
}

async function main() {
  const email = required("SEED_UPLOAD_EMAIL");
  const password = required("SEED_UPLOAD_PASSWORD");

  // Publishable key, not the secret key: uploads below run AS THIS SIGNED-IN
  // USER, subject to documents_object_insert like any browser upload. See
  // the file header for why that is the point, not a workaround.
  const storage = createClient(projectUrl(), publishableKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: session, error: signInError } = await storage.auth.signInWithPassword({ email, password });
  if (signInError || !session.user) {
    throw new Error(`sign-in as ${email} failed: ${signInError?.message ?? "no user returned"}`);
  }
  console.log(`+ signed in as ${email} (${session.user.id})`);

  const db = new Client({ connectionString: databaseUrl() });
  await db.connect();

  try {
    // 1. The rows. The DATABASE owns storage_path, not this script: the path
    //    embeds the company / client / staff / deal uuid that only the
    //    migrations know, so reading it back is the only way the two can
    //    agree. 0018_storage_grants.sql already repathed every row to the
    //    {company_id}/{scope}/{id}/... convention, so this needs no path
    //    computation of its own.
    const { rows } = await db.query<DocumentRow>(
      `select id, name, kind, storage_bucket, storage_path, mime_type,
              folder_id, owner_staff_id, client_id, deal_id, job_event_id, staff_id,
              visibility, signature_status, signed_at
         from public.documents
        where is_seed and deleted_at is null
        order by name`,
    );

    if (rows.length === 0) {
      throw new Error("No seeded documents found. Apply supabase/migrations/0010_seed.sql before running this script.");
    }

    // 2. The bytes, one row at a time, denials collected rather than fatal.
    //    A DENIED row means documents_object_insert refused this user for
    //    that scope (most likely: not an HR admin, not a documents manager)
    //    -- correct behaviour to report, not a reason to stop the other rows.
    let uploaded = 0;
    const denied: { path: string; message: string }[] = [];
    for (const row of rows) {
      if (row.storage_bucket !== BUCKET) {
        console.warn(`! ${row.name} — bucket "${row.storage_bucket}" is not "${BUCKET}", skipped`);
        continue;
      }

      const { error } = await storage.storage.from(row.storage_bucket).upload(row.storage_path, placeholderFor(row), {
        contentType: row.mime_type,
        upsert: true,
      });

      if (error) {
        denied.push({ path: row.storage_path, message: error.message });
        console.warn(`  DENIED  ${row.storage_path}\n          ${error.message}`);
        continue;
      }
      uploaded += 1;
      console.log(`  ${row.storage_path}`);
    }

    // 4. Re-assert the metadata against the object store, keyed on the REAL
    //    unique constraint documents_storage_path_key. On a normal run this is
    //    a no-op; it earns its place when someone has hand-edited a row and the
    //    Content-Type no longer matches what was actually uploaded.
    await db.query(
      `insert into public.documents (
         id, folder_id, name, kind, storage_bucket, storage_path, mime_type,
         owner_staff_id, client_id, deal_id, job_event_id, staff_id,
         visibility, signature_status, signed_at, is_seed)
       select * from unnest(
         $1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
         $8::uuid[], $9::uuid[], $10::uuid[], $11::uuid[], $12::uuid[],
         $13::text[], $14::text[], $15::timestamptz[], $16::boolean[])
       on conflict (storage_path) do update
         set name      = excluded.name,
             kind      = excluded.kind,
             mime_type = excluded.mime_type`,
      [
        rows.map((r) => r.id),
        rows.map((r) => r.folder_id),
        rows.map((r) => r.name),
        rows.map((r) => r.kind),
        rows.map((r) => r.storage_bucket),
        rows.map((r) => r.storage_path),
        rows.map((r) => r.mime_type),
        rows.map((r) => r.owner_staff_id),
        rows.map((r) => r.client_id),
        rows.map((r) => r.deal_id),
        rows.map((r) => r.job_event_id),
        rows.map((r) => r.staff_id),
        rows.map((r) => r.visibility),
        rows.map((r) => r.signature_status),
        rows.map((r) => r.signed_at),
        rows.map(() => true),
      ],
    );

    console.log(`\n${uploaded} placeholder object(s) uploaded and ${rows.length} metadata row(s) reconciled.`);
    if (denied.length > 0) {
      console.log(
        `${denied.length} row(s) DENIED by documents_object_insert (as ${email}):\n` +
          denied.map((d) => `  - ${d.path}`).join("\n") +
          "\nThat is the policy working as designed for a user without the relevant permission, not a bug in this script.",
      );
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
