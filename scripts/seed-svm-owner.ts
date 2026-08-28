/**
 * scripts/seed-svm-owner.ts, Task 14.
 *
 * Creates ONE real auth user: joey@siliconvalleymoving.com, the Owner of
 * Silicon Valley Moving & Storage. Modelled on scripts/seed-auth-users.ts
 * (same env handling, same createUser call, same re-run safety), but
 * deliberately narrower in what it does after that call.
 *
 * WHAT THIS SCRIPT DOES NOT DO, ON PURPOSE. seed-auth-users.ts links its
 * demo accounts to their staff rows itself, with a direct SQL UPDATE,
 * because those accounts (Elena/Morgan/Grace) need to be usable without
 * a UI flow. This script does not touch public.staff at all. The SVM
 * staff row for this email already exists (status = 'Pending invite',
 * auth_user_id = null, seeded by create_company()), and
 * src/server/auth-actions.ts:41 calls claim_staff_for_current_user() on
 * every real sign-in. Binding the two together is what THAT call does;
 * this script's only job is to make a real credential exist for
 * supabase.auth.signInWithPassword() to accept.
 *
 * THE PASSWORD. Read from SVM_OWNER_PASSWORD, never defaulted, never
 * hardcoded, never written anywhere durable. This script does not know
 * or choose the password; whoever runs it supplies it in the shell for
 * that one invocation. See docs/HANDOFF.md for the note on rotating it
 * after first sign-in.
 *
 *   SVM_OWNER_PASSWORD='...' SUPABASE_SECRET_KEY=... SUPABASE_DB_URL=... \
 *     npx ts-node -P tsconfig.scripts.json scripts/seed-svm-owner.ts
 *
 * Re-runnable: an auth user that already exists is looked up and left
 * alone rather than recreated (createUser returns email_exists, not the
 * existing id, so a re-run has to find the account some other way).
 */

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import { databaseUrl, projectUrl, required, secretKey } from "./seed-env";

const OWNER_EMAIL = "joey@siliconvalleymoving.com";
const COMPANY_SLUG = "svm";

async function main() {
  const url = projectUrl();
  const key = secretKey();

  // Never defaulted. Inventing a password here would mean writing a known
  // credential for a real person's account into wherever this script's
  // output ends up.
  const password = required("SVM_OWNER_PASSWORD");
  if (password.length < 12) {
    throw new Error("SVM_OWNER_PASSWORD must be at least 12 characters.");
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const db = new Client({ connectionString: databaseUrl() });
  await db.connect();

  try {
    // Confirm the staff row this account is meant to claim actually
    // exists before minting a credential for it. If it doesn't, either
    // 0010/create_company hasn't provisioned SVM yet, or the row was
    // already claimed by someone else. Either way, stop rather than
    // create an auth user with nothing to bind to.
    const { rows: staffRows } = await db.query<{
      id: string;
      status: string;
      auth_user_id: string | null;
    }>(
      `select s.id::text as id, s.status, s.auth_user_id::text as auth_user_id
         from public.staff s
         join public.companies c on c.id = s.company_id
        where c.slug = $1
          and lower(s.work_email::text) = lower($2)`,
      [COMPANY_SLUG, OWNER_EMAIL],
    );

    if (staffRows.length === 0) {
      throw new Error(
        `No staff row for ${OWNER_EMAIL} in company '${COMPANY_SLUG}'. ` +
          `Run public.create_company(...) for Silicon Valley Moving & Storage before this script.`,
      );
    }

    const staff = staffRows[0];
    if (staff.auth_user_id) {
      console.log(
        `· ${OWNER_EMAIL}: staff row already claimed (auth_user_id ${staff.auth_user_id}, status ${staff.status}). ` +
          `Nothing to do; this script never re-links a claimed row.`,
      );
      return;
    }
    if (staff.status !== "Pending invite") {
      console.warn(
        `! staff row status is '${staff.status}', not 'Pending invite'. claim_staff_for_current_user() ` +
          `only binds Active or Pending invite rows with no auth_user_id; proceeding, since this row ` +
          `qualifies, but this is not the state a fresh provisioning run would leave it in.`,
      );
    }

    const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const found = (existing?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === OWNER_EMAIL.toLowerCase());

    if (found) {
      console.log(`· ${OWNER_EMAIL}: auth user already exists (${found.id}). Password left as set; not overwritten.`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: OWNER_EMAIL,
        password,
        // Required: claim_staff_for_current_user() raises 'email not
        // verified' for an unconfirmed address, and this account is a
        // real mailbox that would otherwise sit unconfirmed until
        // someone clicks a link that was never sent.
        email_confirm: true,
        user_metadata: { full_name: "Joey Childs" },
      });
      if (error) throw new Error(`createUser(${OWNER_EMAIL}) failed: ${error.message}`);
      console.log(`+ ${OWNER_EMAIL}: auth user created (${data.user.id})`);
    }

    console.log(
      `\nDone. The staff row is unchanged (status ${staff.status}, auth_user_id null); ` +
        `signing in as ${OWNER_EMAIL} will claim it automatically (src/server/auth-actions.ts:41).`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
