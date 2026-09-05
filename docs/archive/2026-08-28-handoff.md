# Handoff: movers-app

Updated 2026-08-28, end of the multi-tenancy retrofit. Everything in the
"Multi-tenancy," "Three tenants," "Verifying tenancy," "SVM owner account,"
and advisor sections below was measured against the live database (project
`jannhzvqrsumtscidtkx`) via the Supabase MCP this session, not assumed. The
"DONE and verified in a browser" section is carried forward from the prior
(single-tenant) session and was not re-exercised in a browser this session;
it is included because it is still expected to be true, not because it was
re-checked. The previous handoff described a single-company app; that
description is gone. This one is multi-tenant SaaS, and stays that way from
here on.

## What this project is

A movers CRM, forked from the "Studio Admin" Next.js template, backed by
Supabase project `movers-app`, ref `jannhzvqrsumtscidtkx` (org JC Media,
us-west-1, Postgres 17.6). All data in the app is filler except Silicon
Valley Moving & Storage's account, which is real and empty.

## Multi-tenancy: what is guaranteed and how it is enforced

A company (`public.companies`) is the top-level container. Every business
table carries a `company_id`, and cross-company access is impossible by
construction, not by convention. This was built across migrations
`0012` through `0023` plus `9999_security_guard.sql`. Concretely, 25 of those 26
tables (the 25 in `public`) have all five of the following. `app.code_counters`
has the first four but not the fifth: it has no RLS policies at all, by
design, because `authenticated` holds zero grants on it and it is written
only by the SECURITY DEFINER code minters. Both layers deny, which is
stronger than a RESTRICTIVE policy:

- **`NOT NULL company_id`**, with a foreign key pinning it to a real row in
  `public.companies`.
- **Composite foreign keys** to every sibling scoped table it references
  (for example `deals(company_id, client_id) references clients(company_id,
  id)`), so a row can never attach to a parent it does not share a tenant
  with, even from a buggy `service_role` script.
- **A company-scoped unique constraint or primary key** (`(company_id,
  code)`, `(company_id, slug)`, and so on), so two tenants can reuse the same
  human-facing code without colliding.
- **Exactly one RESTRICTIVE `tenant_isolation` policy**, `using (company_id =
  (select app.current_company_id()))`, layered underneath the existing
  permissive policies rather than folded into them. RESTRICTIVE means both
  this policy AND the older permissive one must allow a row; the older
  policies were never hand-edited.
- **An immutability trigger** (`app.tg_company_id_immutable()`) that blocks
  any `UPDATE` from moving a row to a different company. This is the one
  piece of enforcement that does not rely on RLS: `service_role` bypasses
  RLS entirely but cannot dodge a trigger, which is exactly why a row's
  tenant can never be reassigned by any code path, including a script
  running with the secret key.

Two tables are exempt from the `company_id` shape entirely, by design, not
oversight: `public.companies` (the tenant root) and `public.permission_sets`
(a global catalog shared by every company, read-only, identical for all).
`public.user_active_company` carries `company_id` but is a user's own
selection row, not company-owned data, so it is exempt from the composite-FK
and immutability checks and gets its own narrower policy instead.
`documents_storage_path_key` is deliberately kept globally unique rather than
per-company: a per-company unique would let one tenant insert a `documents`
row naming another tenant's real object-storage key.

**Company provisioning.** `public.create_company(name, slug, owner_email,
owner_name)` is the only way a new tenant comes into existence. It creates
the company row, the Owner/Admin/Read-only roles with their permission
bindings, a default warehouse location, rate card, tax rate, document
folder, and billing profile row, and a single staff row for the Owner with
status `'Pending invite'`. Without this provisioning step a new tenant's
quote builder and permission system are dead on arrival.

**Claiming an account.** A staff row pre-dates the auth user who will claim
it. `public.claim_staff_for_current_user()` runs on every sign-in
(`src/server/auth-actions.ts:41`) and binds the signed-in auth user to their
matching, unclaimed staff row by verified email, flipping `'Pending invite'`
to `'Active'`. Two defects were found and fixed in `0022`, both live:

- A caller who already holds one active membership can no longer pick up a
  second one in another company on a later sign-in. Before the fix, anyone
  who could create a staff row with someone else's email (any Owner or Admin,
  via `admin_create_staff`) could silently enroll that person into a second
  company with zero acceptance step.
- `app.assert_owner_remains()` now counts any non-`Deactivated` Owner, not
  only an `Active` one. Before the fix, a freshly provisioned company's
  Owner started `'Pending invite'` and that alone blocked every
  `admin_set_staff_role` / `admin_set_staff_status` call in that company,
  regardless of which staff row the call targeted, until the Owner
  personally signed in.

Both fixes were proven live in this session against two disposable
companies created and rolled back inside one transaction (never touching
Silicon Valley Moving & Storage's real Owner row): a fresh claim binds the
correct row and flips it Active, `admin_set_staff_status` then works for
that tenant, and a second claim attempt by the same identity does not cross
into the second company's unclaimed row. See "Verifying tenancy" below for
how to re-run this class of proof.

## Three tenants exist

| Company | Slug | State |
|---|---|---|
| Demo Movers | `demo-movers` | Populated with the original filler dataset (25 clients, 15 deals, 21 calendar events, and so on). Existing demo sign-ins (Elena Torres, Morgan Ellis, Grace Chen) live here. |
| Silicon Valley Moving & Storage | `svm` | Real tenant, real business. The Owner (Joey Childs, `joey@siliconvalleymoving.com`) has signed in and claimed the staff row; every other list reads empty because no business data has been entered yet. |
| Third Co | `third-co` | A thin, permanent fixture company (one Owner, reference data only) that exists so the isolation suite has a third, independent tenant. With only two companies, a leak from one into the other can still balance a row-count check by coincidence; a third makes that arithmetically impossible to hide. Keep it. |

## Verifying tenancy

**Both guards, after every migration, no exceptions.**

- `supabase/migrations/9999_security_guard.sql`: 12 checks on the general
  access-control shape (RLS enabled everywhere, `anon` holds nothing,
  `authenticated` holds exactly the expected grant set per table, no
  privilege-escalation columns, storage bucket privacy, and so on).
- `supabase/migrations/0021_tenancy_guard.sql`: 8 checks on the
  tenancy-specific shape described above (`NOT NULL company_id`, the FK to
  `companies`, composite FKs, company-scoped uniqueness, the canonical
  RESTRICTIVE policy, the immutability trigger, and that `service_role`
  cannot defeat the trigger by another route).

Both are re-runnable `do $$ ... $$` blocks that raise one exception naming
every failing check, or pass silently. Run them through the Supabase MCP
`execute_sql` tool (project `jannhzvqrsumtscidtkx`). **`raise notice` does
not come back through that tool**: wrap the block's body in a `pg_temp`
function that `return`s the pass message instead of relying on the notice,
so a passing run is visible and not just "no error." Both guards check
SHAPE, not semantics: a policy that reads `using (true)` would pass every
check in either file. Verify semantics as **Elena Torres**
(`elena.torres@example.com`, Dispatcher, Scoped access), never Morgan Ellis
or Grace Chen: Admin and Owner are `access_level = 'Full'` and short-circuit
`app.has_any_perm` before it ever reads `role_permission_sets`, so every
screen renders perfectly for them whether the policies are right or not.

**The partition test.** `supabase/tests/verify-isolation.sql` proves the
semantics: for every scoped table, the rows visible to three real personas
(Demo, SVM, Third Co) partition the table exactly: each persona's own count
equals the ground-truth count of rows that actually belong to it, and the
three counts sum to the total. That is a stronger claim than "A cannot see
B's rows": it also catches an orphaned row whose `company_id` resolves to
nobody, which a one-directional leak test cannot see. It also builds a
zero-membership tester, a dual-membership tester (write in Demo, read-only
in SVM, constructed by direct DML since `0022` closed the product path to a
real second membership), and runs five further assertions (cross-tenant
`UPDATE` affects zero rows, re-parenting `company_id` raises `23514`,
a cross-tenant foreign key raises `23503`, a read-only membership cannot
write, and `current_company_state()` reads `'no-membership'` for a
zero-membership caller).

Run it by pasting the entire file into **one** Supabase MCP `execute_sql`
call (or one `psql` session). It must be one call: it uses `SET LOCAL ROLE`
and `pg_temp` objects, both session- and transaction-scoped, and a second,
separate `execute_sql` call is a new connection that cannot see either.
The file opens with `begin` and ends with `rollback`: nothing it creates
persists, including its one temporary, real claim of SVM's actual Owner row
(claimed for the duration of the transaction only, to get a real
impersonable SVM identity, then rolled back to `'Pending invite'` /
unclaimed exactly as found). Last run: **39 of 39 checks green** (5 harness,
24 partition PASS, 2 partition VACUOUS (no invoice data exists anywhere yet,
correctly reported as vacuous rather than a false PASS), 3 excluded-table,
5 assertions, zero FAIL).

## The SVM owner account

The auth credential for `joey@siliconvalleymoving.com` was created through
the Supabase Auth dashboard (not `scripts/seed-svm-owner.ts`). The first
sign-in ran `claim_staff_for_current_user()`, which bound the auth user to
the pre-existing staff row and flipped it from `'Pending invite'` to
`'Active'`. The Owner is now live.

`scripts/seed-svm-owner.ts` still exists as a reference for creating
additional auth credentials the same way. It reads `SVM_OWNER_PASSWORD` from
the environment, needs `SUPABASE_SECRET_KEY` and `SUPABASE_DB_URL`, and has
not been run.

**Rotate the password.** It was shared in a chat transcript during the
multi-tenancy build and should be treated as compromised.

## What remains unverified

**No document bytes exist anywhere.** `npm run seed:documents` has never
run: it needs `SUPABASE_SECRET_KEY` and `SUPABASE_DB_URL`, neither of
which is available in this environment, and CLI retrieval of the secret key
is blocked. The metadata side of the multi-tenancy retrofit was still
proven: `0018` repathed all 15 existing `documents.storage_path` values to
carry their `company_id` prefix as a data migration, not deferred to a
script, and the storage object policies (`documents_object_insert` and
friends, which read the company id out of `storage.foldername(name)`) were
proven correct by evaluating their `WITH CHECK` / `USING` expressions
directly as Elena Torres against all 15 real, already-repathed paths (7
succeed, 8 correctly denied for a Scoped user with no document-management
permission) rather than by an actual upload or download. Until
`seed:documents` runs, every Download button in Documents still 404s.

Everything else carried forward from the previous handoff as still true:
Warehouse, Calendar, Documents, and Settings read static arrays, not the
database. Several chrome buttons across the app remain inert template
markers. Pipeline drag does not persist. See "Next steps" below.

## Security and performance advisor state

Checked this session via `get_advisors`. Findings are split from what this
retrofit introduced versus what predates it.

**Security, pre-existing, unchanged:**
- `app.code_counters` RLS-enabled-no-policy, INFO: intentional, both layers
  deny; it is written only by the SECURITY DEFINER code minters.
- Eight SECURITY DEFINER RPCs callable by `authenticated`, WARN:
  `admin_create_staff`, `admin_invite_staff`, `admin_set_staff_role`,
  `admin_set_staff_status`, `admin_update_staff`,
  `claim_staff_for_current_user`, `next_invoice_code`, `next_quote_code`.
  The caller-facing API; each gates internally. Expected cost of the design.
- Leaked-password protection disabled, WARN: enable in Auth settings before
  the app carries anything real.

**Security, new, introduced by this retrofit:**
- `public.current_company_state()`, added in `0012` and revised in `0023`,
  is also SECURITY DEFINER and callable by `authenticated`. Same shape and
  same accepted cost as the eight above (it is the tenant-state resolver the
  dashboard layout calls on every page load, and needs to read across the
  RLS boundary to tell "no membership" apart from "revoked selection" apart
  from "ok"), just not counted in the "eight" the previous handoff named
  because the function did not exist yet.

**Performance, all INFO, all real, none urgent.** Unlike security, this
handoff never recorded a pre-retrofit performance-advisor baseline, so "new"
here is not a diff against a prior handoff entry the way it is for security.
It is inferred from schema archaeology: each finding was traced to a specific
migration (or its absence) below, and confirmed against `pg_constraint` /
`pg_indexes`, not merely asserted.
- **51 pre-existing `unused_index` findings**, unrelated to tenancy, on
  indexes that predate this retrofit.
- **21 new `unused_index` findings**, one `*_company_id_idx` per scoped
  table, added by `0014_backfill.sql` to support the RLS predicate. Unused
  only because this is a small, low-traffic project; not a defect.
- **1 new `unindexed_foreign_keys` finding** on `user_active_company`'s FK
  to `companies`, a brand-new table from `0012`.
- **47 new `unindexed_foreign_keys` findings**, a genuine gap worth a
  follow-up task. `0015_constraints.sql` converted 48 single-column foreign
  keys to composite `(company_id, X)` foreign keys (its own stated scope was
  "constraints only"); 47 of those 48 have no composite covering index, only
  whatever single-column index existed before, which no longer covers a
  two-column FK. (The 48th, `crew_rates_rate_card_id_fkey`, is already
  covered by `crew_rates_company_card_crew_key`.) At this project's current
  size this costs nothing measurable, but every parent-row `UPDATE` or
  `DELETE` on one of these 47 tables will do a sequential scan of the child
  table to check the FK once there is real data. Add a covering index per
  FK (`create index ... on <table> (company_id, <fk_column>)`) as a
  dedicated follow-up; not done here because it is a schema change outside
  this task's scope.
- **1 pre-existing `unindexed_foreign_keys` finding** on
  `staff_auth_user_id_fkey` (`staff.auth_user_id -> auth.users.id`),
  untouched by the retrofit since `auth.users` carries no `company_id`.
- **1 pre-existing `auth_db_connections_absolute` finding**: the Auth
  server's connection allocation is absolute rather than percentage-based.
  Platform configuration, unrelated to this schema.

## What is DONE and verified in a browser (carried forward, still true)

**Auth is on.** Password login, `claim_staff_for_current_user`, sign-out,
the `/auth/v1/login` redirect for signed-in users, and the unauthorized
page's sign-out exit were all exercised. Demo credentials are in
`.env.local` (gitignored).

- `src/proxy.ts` refreshes tokens; it is NOT the gate. `requireAuth()` in
  `dashboard/layout.tsx` is, with RLS beneath it.
- The dashboard shell shows the real signed-in staff member (name, role,
  avatar) in the header menu and sidebar footer, and now also the current
  company name via `current_company_state()`.

**Converted to live reads:** Dashboard metric cards, Recent Client
Activity, Clients list, Client detail, Sales KPI cards, Pipeline board,
Leads table.

**The quote builder exists and works end to end** for Demo Movers data,
per the prior session's browser verification. This session did not
re-exercise the UI, but it did verify the one thing prior work had flagged as
a live regression: `0015_constraints.sql` re-keyed `app.code_counters` to
`(company_id, scope, period)` and left `next_quote_code()` /
`next_invoice_code()` still saying `on conflict (scope, period)`, which
`0017_definer_surface.sql` was supposed to fix. Confirmed this session, both
statically (`pg_get_functiondef` shows both minters now targeting
`(company_id, scope, period)`) and live: called both functions as an
impersonated Demo Movers identity inside a rolled-back transaction and got
back `QTE-2026-0006` and `INV-2026-0001`, no error. Quote and invoice code
minting works today, post-retrofit, not just "the SQL text looks right."

`/dashboard/sales/[id]` (deal code) with `?quote=` selecting among the
deal's quotes. The DB computes every dollar; the builder writes inputs only.
Read-only callers (verified as Elena) get the record view with no write
affordances.

**Mobile pass at a real emulated 390px.** Every table that overflowed
measures zero hidden pixels.

## Landmines fixed, do not reintroduce

- `overflow-x-hidden` on the dashboard layout's content wrapper silently
  killed `position:sticky` for every descendant. It is now `overflow-x-clip`.
- TanStack v9's row-level `getVisibleCells()`/`getIsVisible()` caches do not
  track a visibility change made after the row model is built. Filter cells
  against `table.getVisibleLeafColumns()` instead.
- `on_conflict` cannot resolve a PARTIAL unique index; use a real UNIQUE
  constraint.
- **`0010_seed.sql` has 15 `on conflict` targets that no longer name a real
  constraint**, all a direct consequence of `0015_constraints.sql` making
  the underlying uniqueness composite (or, for one table, dropping the
  column outright). This file is not re-run: Task 4 backfilled `company_id`
  onto the existing seeded rows instead, so none of these have fired since,
  but re-seeding from scratch now means dropping and recreating the
  database, not re-running this file. The 14 that go stale purely because
  their uniqueness became `(company_id, ...)`:
  - `(code)`: `clients`, `deals`, `rate_cards`, `fee_catalog`, `tax_rates`,
    `storage_agreements`, `vaults`, `calendar_events` (8)
  - `(slug)`: `warehouse_locations`, `roles`, `document_folders` (3)
  - `(work_email)`: `staff` (1)
  - `(rate_card_id, crew_size)`: `crew_rates` (1)
  - `(scope, period)`: `app.code_counters` (1)

  A 15th is broken for a sharper reason: `company_billing_profile`'s
  `on conflict (id)` targets a column that `0018` dropped outright when it
  rekeyed the table onto `company_id` as its own primary key: that
  statement would fail immediately with "column id does not exist," not
  merely fail to match a constraint.

  **Not stale, despite looking like it should be:** `on conflict
  (storage_path)` on `documents`: `documents_storage_path_key` was
  deliberately kept globally unique (see "Multi-tenancy" above), so this
  target is still exactly correct. The eight junction/1:1 tables whose PKs
  were left untouched by `0015` (`staff_locations`, `role_permission_sets`,
  `calendar_event_crew`, `document_stars`, `staff_profiles`,
  `staff_profiles_sensitive`) and `permission_sets` (a root, global-catalog
  table) are likewise unaffected.

## Rules that are load-bearing

- **Run both guards after any migration.** `9999_security_guard.sql` and
  `0021_tenancy_guard.sql`. Neither is optional; each catches a different
  class of regression the other cannot see.
- Reads are broad, writes are gated. Never filter a REFERENCED staff row by
  status (Sofia Marchetti is Deactivated and owns clients/deals).
- A policy is not a grant; check `role_table_grants` AND `column_privileges`.
- Never run the Supabase CLI push command; a PreToolUse hook denies it. Use
  the Supabase MCP `execute_sql` tool for ad-hoc SQL against this project.
- **MCP `execute_sql` has no nested transactions.** A bare, permanent
  statement followed later in the *same call* by an explicit
  `begin; ...; rollback;` block does not isolate the two: the trailing
  `rollback` undoes the earlier bare statement too, silently. Keep every
  permanent DDL/DML statement in its own `execute_sql` call, separate from
  any `begin; ...; rollback;` probe.
- **Deleting from `storage.objects` needs `storage.allow_delete_query`.**
  Supabase's `storage.protect_delete()` trigger blocks a plain `DELETE` on
  that table even as `postgres`; set the GUC first if a hard delete is ever
  genuinely required (bill-of-lading retention means this should be rare on
  purpose; see `9999_security_guard.sql` check 12d).
- `raise notice` does not return through MCP `execute_sql`. Wrap a
  verification block in a `pg_temp` function that returns a value instead.
- The `0010_seed` parts pin `set search_path = public, extensions;` for
  `citext`. Do not strip.
- The Next dev-tools badge at 390px is not a layout bug; it does not exist
  in production builds.

## Next steps, in order

1. **Run `npm run seed:documents`** once `SUPABASE_SECRET_KEY` and
   `SUPABASE_DB_URL` are available, then convert the Documents screen.
2. Add a covering `(company_id, <fk_column>)` index for each of the 47
   composite foreign keys named in the performance advisor section above.
3. Convert Warehouse (both tabs as one unit), Calendar (uniform
   `CalendarEvent[]`, ISO strings), and Settings (users/roles from `staff` +
   `roles_expanded`, wiring the `admin_*` RPCs that already exist) to live
   reads, each re-verified as Elena.
4. Make or remove the inert chrome buttons per screen as each converts.
5. Known follow-up carried forward: `company_billing_profile`'s broad read
   still exposes `routing_number`; split the banking columns into their own
   narrower-grant table (D21).
