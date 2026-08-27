/**
 * scripts/seed-dev.ts — D19. The caller for dev_seed.reseed_calendar().
 *
 * WHY THIS EXISTS. events-data.ts computes every calendar date at MODULE EVAL
 * from startOfMonth(new Date()), so the Calendar has always rendered against
 * whatever month you happen to open it in. 0010_seed.sql anchors the 21 seeded
 * events to the Pacific month it was applied in — correct on the day, and
 * empty a month later. dev_seed.reseed_calendar() shifts them forward; this is
 * the thing that runs it. A reseed function with nothing invoking it is exactly
 * the hand-wave the design was written to avoid, so it ships in the same change.
 *
 * WHY A DIRECT DATABASE CONNECTION AND NOT supabase.rpc(). Two reasons, both of
 * them the security design working:
 *   1. PostgREST only exposes functions in `public`. reseed_calendar lives in
 *      dev_seed on purpose.
 *   2. 0001 revokes ALL on schema dev_seed from public, anon and authenticated,
 *      and never grants it to anyone else. There is no API-reachable path to it.
 * So its only possible caller is a session that connects to Postgres directly.
 *
 * RE-ANCHORING POLICY, chosen explicitly. Whole calendar months, preserving
 * day-of-month and local wall-clock time. Postgres CLAMPS at the end of a short
 * month, so a row on the 30th lands on Feb 28 rather than rolling into March 2
 * the way the JS setDate() it replaces would. A stand-up should not jump into
 * the next month.
 *
 *   npm run seed:dev
 *   npm run seed:dev -- 2026-12-01     # re-anchor to a specific month
 *
 * Scoped on is_seed, never on a code prefix: real app-created events mint codes
 * in the same JOB-4xxx namespace, so a real JOB-4007 sits squarely inside it.
 */

import { Client } from "pg";

import { databaseUrl } from "./seed-env";

async function main() {
  const anchor = process.argv[2];
  if (anchor && !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    throw new Error(`Anchor must be YYYY-MM-DD (any day in the target month). Got: ${anchor}`);
  }

  const db = new Client({ connectionString: databaseUrl() });
  await db.connect();

  try {
    const before = await db.query<{ month: string; n: string }>(
      `select to_char(date_trunc('month', starts_at at time zone 'America/Los_Angeles'), 'YYYY-MM') as month,
              count(*)::text as n
         from public.calendar_events
        where is_seed
        group by 1 order by 1`,
    );
    if (before.rowCount === 0) {
      throw new Error(
        "No seeded calendar events found. Apply supabase/migrations/0010_seed.sql before running this script.",
      );
    }
    console.log(`Seeded events currently sit in: ${before.rows.map((r) => `${r.month} (${r.n})`).join(", ")}`);

    const { rows } = await db.query<{ moved: number }>(`select dev_seed.reseed_calendar($1::date) as moved`, [
      anchor ?? null,
    ]);
    const moved = rows[0].moved;

    const after = await db.query<{ month: string; n: string }>(
      `select to_char(date_trunc('month', starts_at at time zone 'America/Los_Angeles'), 'YYYY-MM') as month,
              count(*)::text as n
         from public.calendar_events
        where is_seed
        group by 1 order by 1`,
    );

    // Real rows are the point of the is_seed scope, so report them separately:
    // if this number ever drops, the reseed has reached something it must not.
    const real = await db.query<{ n: string }>(
      `select count(*)::text as n from public.calendar_events where not is_seed`,
    );

    console.log(
      moved === 0 ? "Already anchored to the target month; nothing moved." : `Re-anchored ${moved} seeded event(s).`,
    );
    console.log(`Now in: ${after.rows.map((r) => `${r.month} (${r.n})`).join(", ")}`);
    console.log(`${real.rows[0].n} non-seed event(s) untouched.`);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
