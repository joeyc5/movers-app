# Tenancy

What the database guarantees about tenant isolation, how to re-prove it, and
what is still open. Carried forward from the multi-tenancy retrofit; anything
that was only true on 2026-08-28 has been dropped rather than re-dated.

Operational rules and command-line landmines live in `CLAUDE.md`. Code
structure and screen conventions live in `AGENTS.md`.

## What is guaranteed

A company (`public.companies`) is the top-level container. Every business
table carries a `company_id`, and cross-company access is impossible by
construction, not by convention. Built across migrations `0012` through
`0023` plus `9999_security_guard.sql`.

Twenty-five of the twenty-six scoped tables have all five of the following.
`app.code_counters` has the first four and no RLS policies at all, by design:
`authenticated` holds zero grants on it and it is written only by the
SECURITY DEFINER code minters, so both layers deny, which is stronger than a
RESTRICTIVE policy.

- **`NOT NULL company_id`**, with a foreign key pinning it to a real row in
  `public.companies`.
- **Composite foreign keys** to every sibling scoped table it references, for
  example `deals(company_id, client_id) references clients(company_id, id)`,
  so a row can never attach to a parent it does not share a tenant with, even
  from a buggy `service_role` script.
- **A company-scoped unique constraint or primary key** (`(company_id, code)`,
  `(company_id, slug)`), so two tenants can reuse the same human-facing code
  without colliding.
- **Exactly one RESTRICTIVE `tenant_isolation` policy**, `using (company_id =
  (select app.current_company_id()))`, layered underneath the existing
  permissive policies rather than folded into them. Both must allow a row;
  the older policies were never hand-edited.
- **An immutability trigger** (`app.tg_company_id_immutable()`) blocking any
  `UPDATE` that would move a row to another company. This is the one piece of
  enforcement that does not rely on RLS. `service_role` bypasses RLS entirely
  but cannot dodge a trigger, which is why a row's tenant can never be
  reassigned by any code path, including a script holding the secret key.

Three tables sit outside that shape deliberately. `public.companies` is the
tenant root. `public.permission_sets` is a global catalog, read-only and
identical for every company. `public.user_active_company` carries
`company_id` but is a user's own selection row rather than company-owned
data, so it is exempt from the composite-FK and immutability checks and has
its own narrower policy.

`documents_storage_path_key` is kept globally unique on purpose. A
per-company unique would let one tenant insert a `documents` row naming
another tenant's real object-storage key.

## Provisioning and claiming

`public.create_company(name, slug, owner_email, owner_name)` is the only way
a tenant comes into existence. It creates the company row, the Owner, Admin,
and Read-only roles with their permission bindings, a default warehouse
location, rate card, tax rate, document folder, and billing profile row, and
one staff row for the Owner at status `'Pending invite'`. Skip it and the new
tenant's quote builder and permission system are dead on arrival.

A staff row pre-dates the auth user who claims it.
`public.claim_staff_for_current_user()` runs on every sign-in
(`src/server/auth-actions.ts:41`) and binds the signed-in user to their
matching unclaimed staff row by verified email, flipping `'Pending invite'`
to `'Active'`.

Two defects were fixed in `0022` and both fixes are live. A caller holding an
active membership can no longer pick up a second one in another company on a
later sign-in; before the fix, anyone able to create a staff row with someone
else's email could silently enroll that person into a second company with no
acceptance step. And `app.assert_owner_remains()` now counts any
non-`Deactivated` Owner rather than only an `Active` one; before the fix, a
freshly provisioned company's `'Pending invite'` Owner blocked every
`admin_set_staff_role` and `admin_set_staff_status` call in that company
until the Owner personally signed in.

## The three tenants

| Company | Slug | State |
|---|---|---|
| Demo Movers | `demo-movers` | The filler dataset: 25 clients, 15 deals, 21 calendar events. The demo sign-ins (Elena Torres, Morgan Ellis, Grace Chen) live here. |
| Silicon Valley Moving & Storage | `svm` | Real tenant, real business. The Owner has claimed their staff row; every list reads empty because no business data has been entered. |
| Third Co | `third-co` | A thin permanent fixture, one Owner and reference data only, so the isolation suite has a third independent tenant. With two companies a leak can balance a row-count check by coincidence; a third makes that arithmetically impossible to hide. Keep it. |

## Proving it

Run both guards after every migration, no exceptions.

- `supabase/migrations/9999_security_guard.sql` — 12 checks on access-control
  shape: RLS enabled everywhere, `anon` holds nothing, `authenticated` holds
  exactly the expected grants per table, no privilege-escalation columns,
  storage bucket privacy.
- `supabase/migrations/0021_tenancy_guard.sql` — 8 checks on the tenancy shape
  above, including that `service_role` cannot defeat the immutability trigger
  by another route.

Both are re-runnable `do $$ ... $$` blocks that raise one exception naming
every failing check, or pass silently.

**Both guards check shape, not semantics.** A policy reading `using (true)`
passes every check in either file. Verify semantics as **Elena Torres**
(`elena.torres@example.com`, Dispatcher, Scoped), never Morgan Ellis or Grace
Chen: Admin and Owner are `access_level = 'Full'` and short-circuit
`app.has_any_perm` before it reads `role_permission_sets`, so every screen
renders perfectly for them whether the policies are right or not.

`supabase/tests/verify-isolation.sql` proves the semantics. For every scoped
table, the rows visible to the three personas partition the table exactly:
each persona's count equals the ground-truth count of rows belonging to it,
and the three sum to the total. That is stronger than "A cannot see B's
rows" — it also catches an orphaned row whose `company_id` resolves to
nobody, which a one-directional leak test cannot see. It builds a
zero-membership tester and a dual-membership tester, and asserts that a
cross-tenant `UPDATE` affects zero rows, re-parenting `company_id` raises
`23514`, a cross-tenant foreign key raises `23503`, a read-only membership
cannot write, and `current_company_state()` reads `'no-membership'` for a
caller with none.

Run it as **one** call. It uses `SET LOCAL ROLE` and `pg_temp` objects, both
session-scoped, so a second call is a new connection that sees neither. The
file opens with `begin` and ends with `rollback`, including its one temporary
claim of SVM's real Owner row, which is restored exactly as found. Last run:
39 of 39 green, with 2 partition checks correctly reported vacuous rather
than a false pass because no invoice data exists yet.

`supabase/tests/verify-minters.sql` does the same for the code minters and
`signup_create_company`, including the two calls that must be refused.

## Open items

- **D21, unresolved.** `company_billing_profile`'s read policy is broad enough
  to expose `routing_number`. The fix is splitting the banking columns into
  their own narrower-grant table. The Settings UI only shows those fields to
  a Full-access caller, but that is a UI gate, not a database one.
- **47 missing covering indexes.** `0015_constraints.sql` converted 48
  single-column foreign keys to composite `(company_id, X)` keys; 47 have no
  composite covering index, only whatever single-column index predated them,
  which no longer covers a two-column FK. The 48th,
  `crew_rates_rate_card_id_fkey`, is covered by `crew_rates_company_card_crew_key`.
  Costs nothing measurable at current size, but every parent-row `UPDATE` or
  `DELETE` will sequentially scan the child table once real data exists. Add
  `create index ... on <table> (company_id, <fk_column>)` per FK.
- **Leaked-password protection is disabled.** Enable it in Auth settings
  before the app carries anything real.
- **No document bytes exist.** `npm run seed:documents` has never run; it
  needs `SUPABASE_SECRET_KEY` and `SUPABASE_DB_URL`. The metadata side was
  proven: `0018` repathed all 15 `documents.storage_path` values to carry
  their `company_id` prefix, and the storage object policies were verified by
  evaluating their `WITH CHECK` and `USING` expressions as Elena against all
  15 real paths. Until the seed runs, every Download button 404s.
- **Rotate the SVM owner password.** It was shared in a chat transcript during
  the retrofit and should be treated as compromised.
- **Nine SECURITY DEFINER RPCs are callable by `authenticated`**, each gating
  internally: the five `admin_*` staff calls, `claim_staff_for_current_user`,
  `next_invoice_code`, `next_quote_code`, and `current_company_state`. This is
  the caller-facing API and the accepted cost of the design, not a finding to
  chase.

## Schema landmines

- **`0010_seed.sql` has 15 `on conflict` targets that no longer name a real
  constraint**, because `0015_constraints.sql` made the underlying uniqueness
  composite or dropped the column. The file is not re-run — `company_id` was
  backfilled onto the seeded rows instead — so none have fired, but reseeding
  from scratch now means dropping and recreating the database. Fourteen went
  stale purely from `(code)`, `(slug)`, `(work_email)`, `(rate_card_id,
  crew_size)`, or `(scope, period)` becoming company-scoped. The fifteenth is
  worse: `company_billing_profile`'s `on conflict (id)` targets a column
  `0018` dropped outright, so it fails with "column id does not exist."
- **`on conflict (storage_path)` on `documents` is still correct**, despite
  looking like it should be stale, because that key is deliberately global.
- **`on_conflict` cannot resolve a PARTIAL unique index.** Use a real UNIQUE
  constraint.
- **The `0010_seed` parts pin `set search_path = public, extensions;`** for
  `citext`. Do not strip it.
- **Reads are broad, writes are gated.** Never filter a referenced staff row
  by status: Sofia Marchetti is Deactivated and owns clients and deals.
