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
 * It also creates the bucket. The DDL migrations deliberately left the
 * storage.buckets row out, because the bucket's RLS policies belong with the
 * public.documents policies (the object SELECT policy mirrors the row one), and
 * neither is written yet. The bucket itself is not a policy, so it lands here.
 *
 *   npm run seed:documents
 *
 * Re-runnable: the bucket creation tolerates "already exists", the uploads are
 * upserts, and the metadata write targets documents_storage_path_key.
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

import { databaseUrl, projectUrl, secretKey } from "./seed-env";

const BUCKET = "documents";

/** D18: 50 MB. The largest seeded fixture is a scanned bill of lading. */
const FILE_SIZE_LIMIT = 52_428_800;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/csv",
];

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
  const storage = createClient(projectUrl(), secretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const db = new Client({ connectionString: databaseUrl() });
  await db.connect();

  try {
    // 1. The bucket. PRIVATE: these are bills of lading and HR records, and a
    //    public bucket would serve every one of them to an unauthenticated URL.
    const { error: bucketError } = await storage.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: FILE_SIZE_LIMIT,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
    if (bucketError && !/already exists/i.test(bucketError.message)) {
      throw new Error(`createBucket(${BUCKET}) failed: ${bucketError.message}`);
    }
    console.log(bucketError ? `· bucket "${BUCKET}" already exists` : `+ bucket "${BUCKET}" created (private)`);

    // 2. The rows. The DATABASE owns storage_path, not this script: the path
    //    embeds the client / staff / deal uuid that only the migration knows,
    //    so reading it back is the only way the two can agree.
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

    // 3. The bytes.
    let uploaded = 0;
    for (const row of rows) {
      if (row.storage_bucket !== BUCKET) {
        console.warn(`! ${row.name} — bucket "${row.storage_bucket}" is not "${BUCKET}", skipped`);
        continue;
      }

      const { error } = await storage.storage.from(row.storage_bucket).upload(row.storage_path, placeholderFor(row), {
        contentType: row.mime_type,
        upsert: true,
      });

      if (error) throw new Error(`upload(${row.storage_path}) failed: ${error.message}`);
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
    console.log("Downloads will now return bytes. Storage RLS policies are still to come.");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
