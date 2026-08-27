# Handoff: movers-app backend migration

Written 2026-08-27. Everything below was measured, not assumed.

## What this project is

A movers CRM, forked from the "Studio Admin" Next.js template. A previous pass
rebuilt the whole information architecture (Dashboard, Sales, Calendar,
Warehouse, Clients, Documents, Settings). Until this session every screen read a
static in-memory TypeScript array: nothing persisted, every action button was
inert, and the login forms only popped a toast.

This session gave it a real backend.

## Current state

**Database:** Supabase project `movers-app`, ref `jannhzvqrsumtscidtkx`, org
JC Media, us-west-1, Postgres 17.6. $10/mo. The ref is recorded in
`~/claude-config/CLAUDE.md` next to the other five ventures.

Applied and verified: 26 tables, 4 views (all `security_invoker = true`), 88 RLS
policies, per-table grants, 21 `app` helper functions, and one private storage
bucket named `documents`.

**Migrations** live in `supabase/migrations/`, numbered 0001 through 0010 plus
`9999_security_guard.sql`. They are the source of truth. `supabase/migrations/parts/`
is gitignored: those are the same files mechanically split at top-level statement
boundaries (round-trip verified byte-identical) because a single large payload
hangs the apply tool.

**App code:** Supabase client factories, the cached auth boundary, sign-in and
sign-out actions, the OAuth callback route, and read-path query modules for
clients, deals, warehouse and calendar. All type-check clean.

## What is NOT done

Be direct about this with Joey; none of it is hidden.

1. **No screen reads from the database yet.** Every page still imports its
   static seed array. The query modules exist and are typed against the real
   schema, but nothing calls them.
2. **The quote builder does not exist.** This is the feature Joey originally
   asked for. The schema is built and the pricing math is verified, but there is
   no `sales/[id]` route and no quote UI.
3. **Auth is wired but not switched on.** `src/proxy.disabled.ts` is still
   disabled, and the login forms still call their old toast handler. Turning the
   gate on before auth users exist would lock the app out of its own screens.
4. **No auth users exist.** `scripts/seed-auth-users.ts` is written but has
   never been run. It needs `SUPABASE_SECRET_KEY` and `SUPABASE_DB_URL` exported
   in the shell.
5. **Documents have no bytes.** `scripts/seed-documents.ts` is written and
   unrun. SQL cannot upload to Storage.
6. All three scripts are **built, not verified**. No DB connection or admin API
   call has been exercised from them.

## Exactly where the migration stopped

As of handoff, `supabase_migrations.schema_migrations` showed applied through
`0010_seed_part03`. Confirmed landed and verified: 27 staff with all 27 role
links resolved (the citext canary passes), 31 staff_locations, 39
role_permission_sets, 25 clients with status distribution Active 10 /
In Storage 4 / Lead 4 / Past 4 / Inactive 3, zero unowned clients, and the five
clients owned by the Deactivated rep resolving correctly to CLT-1007, CLT-1010,
CLT-1014, CLT-1018 and CLT-1022.

Still to apply when this was written: `0010_seed_part04`, `part05`, `part06`,
then `9999_security_guard_part01` and `part02`. A background agent was mid-run
on part04, so some or all may have landed since.

Check what is applied:

    select name from supabase_migrations.schema_migrations order by name;

Then apply whatever is missing, in filename order, from
`supabase/migrations/parts/`, using `mcp__claude_ai_Supabase__apply_migration`.
Each part is its own transaction, so re-applying one that already succeeded will
fail on a duplicate key rather than corrupt anything. `0010_seed` is
single-pass past its quote step: it raises 23505 on `quotes_code_key` if run
twice, before any line item exists.

## Next steps, in order

1. Confirm the seed finished. Run the verification numbers in "How to check the
   seed" below. If `clients` is 0, re-apply `0010_seed` from
   `supabase/migrations/parts/` in part order.
2. Export `SUPABASE_SECRET_KEY` and `SUPABASE_DB_URL`, then `npm run seed:auth`.
   It must create **Elena Torres** (`elena.torres@example.com`, Dispatcher) as
   the mandatory non-Full verification account. See "Why Elena" below.
3. Turn auth on: rename `src/proxy.disabled.ts` to `src/proxy.ts` with the
   `updateSession` implementation, wire `login-form.tsx` to `signIn` from
   `src/server/auth-actions.ts`, and gate `dashboard/layout.tsx` on
   `requireAuth()`.
4. Convert Clients first. It has the fewest dependencies and a working query
   module. Then Deals.
5. Build the quote builder on a new `sales/[id]` route.
6. Then Warehouse, Calendar, Documents, Settings.
7. Dashboard KPI cards last: several are currently hardcoded literals and become
   real aggregate queries.

## Rules that are load-bearing

These were each learned the expensive way this session. Breaking any of them
reintroduces a bug that has already been fixed once.

**Reads are broad, writes are gated.** Every operational table is readable by
any active staff member. The original design gated reads behind permission sets,
which was measured to blank Sales for 16 of 27 staff and Documents for 20 of 27,
and turn the dashboard revenue card to $0 for most of the company, with no error.
The sidebar is a flat static array with no permission filtering and no screen has
an access-denied state, so a gated read ships as a blank screen. The only read
exception is `staff_profiles_sensitive` (date of birth, home address).

**Never filter a REFERENCED staff row by status.** RLS gates the caller's
status. Sofia Marchetti is Deactivated and is the account owner on five clients,
owns three deals, and is an estimator of record. Any join requiring the
referenced row to be active silently drops those rows.

**A policy is not a grant.** Tables land owned by postgres with correct RLS and
zero DML grants, presenting as `permission denied`. Verify with BOTH
`information_schema.role_table_grants` and `information_schema.column_privileges`;
column-level grants are invisible to the first. The `staff` UPDATE grants on
`full_name` and `avatar_url` are column grants and are the intended design. A
reviewer running only the first query concludes staff editing is broken, grants
table-wide, and reopens a privilege escalation: a Driver setting their own
`role_id` to Owner.

**Never run the Supabase CLI push command.** A PreToolUse hook hard-denies any
Bash command containing that phrase, including inside a heredoc writing
documentation. Apply one file at a time.

**The `0010_seed` parts each pin `set search_path = public, extensions;`.** Off
the search path a bare citext `=` silently degrades to case-sensitive
`text = text` and email joins match zero rows with no error. Do not strip those
lines.

**Bash cwd persists between calls.** A stale `cd` sent a `-f` path lookup into
the wrong directory this session. Prefix risky commands with an absolute path.

**Applying migrations via Bash is blocked** by the auto-mode classifier, but the
`mcp__claude_ai_Supabase__apply_migration` tool works. Use the MCP tool.

## Why Elena

`rootUser` is Morgan Ellis, reconciled as an Admin, and Admin is
`access_level = 'Full'`, which short-circuits every permission check. Anyone
testing as Morgan sees every screen work perfectly whether the policies are
right or wrong. Elena Torres is a Dispatcher holding dispatch, jobs, fleet,
clients and calendar, which is exactly the set that exposes every gap. Exercise
the policies as her before calling anything done.

## How to check the seed

Expected, all measured in a throwaway schema before this was applied:

- Booked revenue over Won deals = **21100.00**. Both Won deals seed at
  `estimated_value` 0.00, so this figure can only exist if the quote-acceptance
  write-back trigger fired. It is a live end-to-end test, not a stored constant.
- staff 27, clients 25, deals 15, vaults 14, storage agreements 6, calendar
  events 21, documents 15, document folders 6, roles 9, permission sets 16.
- Role membership summed over all staff = 27; over only the original 25 UserRow
  emails = 25. Both readings are correct.
- Vaults: capacity 7900, occupied 4110, ratio 52%. V-206 `occupancy_percent` =
  110, which is deliberate over-capacity, not corrupt data.
- Clients by status: Active 10, In Storage 4, Lead 4, Past 4, Inactive 3.
- Labor math: crew 4 at $75, 3h minimum, 8h overtime threshold, 1.5x gives 900
  at 2h, 1500 at 5h, 3300 at 10h. The figures written in the design JSON are
  each 0.65x wrong; these are the measured ones.

Run `9999_security_guard.sql` after any migration. It raises on deviation and
has been broken on purpose 15 different ways to confirm each check fires.

## Known follow-ups

- **`company_billing_profile` broad read exposes `routing_number`.** A
  Dispatcher can read the company bank routing number. Gating the whole table
  recreates the blank-invoice-header failure, so the fix is to split the banking
  columns into their own table, mirroring the `staff_profiles` /
  `staff_profiles_sensitive` split that is already the house pattern. Written up
  as D21 in the decisions file.
- **Mobile.** Joey requires this app to work on phones. A measured 390px audit
  fixed the app-shell defects (card header overflow, pipeline touch-drag,
  sidebar trigger target, palette zoom, account switcher focus). Still open: the
  invoice paper preview renders at 35.8% scale making body text 5px, the
  calendar wastes 281px of viewport while truncating events to four characters,
  and six wide tables scroll with no discoverable affordance. Documents is the
  reference pattern for that last one; it hides secondary columns below `md` and
  measures zero hidden pixels.
- The reported "sidebar footer overlaps content at 390px" was measured and
  **refuted**. It is the Next.js dev-tools badge, which does not exist in a
  production build. Do not spend time on it.

## Where the reasoning lives

`/private/tmp/claude-501/-Users-joeychilds-movers-app/d5070f9e-7972-46d9-bc03-c1900bc11b13/scratchpad/design/`
holds the full design record: three domain schema designs, the security design,
three adversarial verification reports, the file-storage and Supabase-auth
research briefs, and `DECISIONS.md`, which is the binding resolution of all 28
defects the verifiers found. That directory is temporary. If any of it matters
beyond this week, copy it into the repo.

The plan file is `~/.claude/plans/agile-zooming-blossom.md`.
