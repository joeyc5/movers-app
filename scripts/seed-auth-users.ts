/**
 * scripts/seed-auth-users.ts — D15 / D16.
 *
 * WHY THIS EXISTS AT ALL. Every one of the 27 seeded work emails is
 * @example.com, which RFC 2606 reserves and which no mail server will ever
 * accept. inviteUserByEmail therefore cannot work: the invite is generated,
 * the mail bounces into a black hole, email_confirmed_at is never set, and
 * public.claim_staff_for_current_user() rejects the claim with 'email not
 * verified'. The only path that produces a usable account is
 * auth.admin.createUser({ email_confirm: true }), which marks the address
 * confirmed without sending anything.
 *
 * D16 — WHO YOU MUST TEST AS. rootUser is Morgan Ellis, reconciled as Admin,
 * and Admin is access_level = 'Full', which short-circuits every permission
 * check in app.has_any_perm. Anyone verifying the app as Morgan sees every
 * screen work perfectly whether the policies are right or not. That is why
 * ELENA TORRES is the mandatory verification account: Dispatcher, Active,
 * Scoped, holding dispatch / jobs / fleet / clients / calendar and nothing
 * else. If a screen is broken for a Scoped role, Elena is who finds it.
 *
 * Grace Chen is here as the Owner-level counterpart, so a permission
 * difference can be observed rather than inferred from one account.
 *
 * Linking is done over a DIRECT database connection, not PostgREST. staff has
 * RLS enabled and the per-table grants land in a later migration; writing
 * auth_user_id through the REST API would depend on grants that do not exist
 * yet, and would fail in a way that reads like a policy bug.
 *
 *   npm run seed:auth
 *
 * Re-runnable: an account that already exists is looked up and re-linked
 * rather than recreated.
 */

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import { databaseUrl, projectUrl, required, secretKey } from "./seed-env";

/**
 * The three accounts, and why each one is on the list.
 *
 * Deliberately NOT all 27: an auth user is a credential, and minting 27 live
 * logins for a demo dataset creates 27 things to revoke. These three cover
 * Scoped, Full, and the rootUser identity the app currently assumes.
 */
const ACCOUNTS = [
  {
    email: "elena.torres@example.com",
    fullName: "Elena Torres",
    note: "MANDATORY verification account (D16): Dispatcher, Scoped access. Test here first.",
  },
  {
    email: "morgan.ellis@example.com",
    fullName: "Morgan Ellis",
    note: "rootUser today. Admin, access_level Full, so this account cannot detect a broken policy.",
  },
  {
    email: "grace.chen@example.com",
    fullName: "Grace Chen",
    note: "Owner. The Full-access comparison point for Elena.",
  },
] as const;

async function main() {
  const url = projectUrl();
  const key = secretKey();

  // Never defaulted. A seed script that invents a password writes a known
  // credential into a database that may later hold something real.
  const password = required("SEED_USER_PASSWORD");
  if (password.length < 12) {
    throw new Error("SEED_USER_PASSWORD must be at least 12 characters.");
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const db = new Client({ connectionString: databaseUrl() });
  await db.connect();

  try {
    // Read the staff rows first. If a target email has no staff row the seed
    // migration has not been applied, and creating an auth user that can never
    // claim anything is worse than stopping.
    const { rows: staffRows } = await db.query<{ work_email: string; full_name: string; status: string }>(
      `select work_email::text as work_email, full_name, status
         from public.staff
        where lower(work_email::text) = any($1::text[])`,
      [ACCOUNTS.map((a) => a.email)],
    );

    const known = new Map(staffRows.map((r) => [r.work_email.toLowerCase(), r]));
    const missing = ACCOUNTS.filter((a) => !known.has(a.email));
    if (missing.length > 0) {
      throw new Error(
        `No staff row for ${missing.map((m) => m.email).join(", ")}. ` +
          `Apply supabase/migrations/0010_seed.sql before running this script.`,
      );
    }

    // One page is ample for a 27-person company and keeps the lookup honest:
    // createUser returns email_exists rather than the existing id, so a
    // re-run has to find the account some other way.
    const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const byEmail = new Map((existing?.users ?? []).map((u) => [(u.email ?? "").toLowerCase(), u]));

    for (const account of ACCOUNTS) {
      let userId = byEmail.get(account.email)?.id;

      if (userId) {
        console.log(`· ${account.email} — auth user already exists (${userId})`);
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: account.email,
          password,
          // THE line that makes this work at all. Without it,
          // claim_staff_for_current_user() raises 'email not verified' and no
          // amount of retrying will help, because the address cannot receive.
          email_confirm: true,
          user_metadata: { full_name: account.fullName, seeded: true },
        });
        if (error) throw new Error(`createUser(${account.email}) failed: ${error.message}`);
        userId = data.user.id;
        console.log(`+ ${account.email} — auth user created (${userId})`);
      }

      // The link. Mirrors claim_staff_for_current_user(): match on the verified
      // email, refuse to bind a Deactivated / Locked / Suspended row, and never
      // steal a staff row that is already claimed by a different auth user.
      const { rowCount } = await db.query(
        `update public.staff s
            set auth_user_id = $1,
                status = case when s.status = 'Pending invite' then 'Active' else s.status end
          where lower(s.work_email::text) = $2
            and (s.auth_user_id is null or s.auth_user_id = $1)
            and s.status in ('Active','Pending invite')`,
        [userId, account.email],
      );

      if (rowCount === 0) {
        console.warn(
          `! ${account.email} — staff row not linked. It is either already bound to a different ` +
            `auth user, or its status is not Active/Pending invite.`,
        );
      } else {
        console.log(`  linked to staff "${known.get(account.email)?.full_name}"`);
      }
      console.log(`  ${account.note}`);
    }

    const { rows: linked } = await db.query<{ n: string }>(
      `select count(*)::text as n from public.staff where auth_user_id is not null`,
    );
    console.log(`\n${linked[0].n} staff row(s) now carry an auth_user_id.`);
    console.log("Verify as elena.torres@example.com FIRST. Morgan Ellis is Full access and proves nothing.");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
