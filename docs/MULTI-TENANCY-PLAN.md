# Multi-tenancy retrofit: movers-app

Approved 2026-08-27. This is the working plan of record for converting movers-app
from a single-company CRM to proper multi-tenant SaaS.

## Status

- [x] **Step 0 — FK behaviour spike. PROVEN, see "ON DELETE SET NULL" below.**
- [x] **Step 0 — PostgREST embed-hint baseline. RECORDED, see "PostgREST embed hints" below.**
- [ ] `0012_companies.sql`
- [ ] `0013_company_id_columns.sql`
- [ ] `0014_backfill.sql`
- [ ] `0015_constraints.sql`
- [ ] `0016_helpers_and_rls.sql`
- [ ] `0017_rpcs.sql`
- [ ] `0018_views_grants.sql`
- [ ] `0019_provisioning.sql`
- [ ] `9999_security_guard.sql` updated
- [ ] Generated types + app layer
- [ ] `scripts/verify-isolation.ts` passing, and broken on purpose once

---

## Context

movers-app was built as a single-company internal CRM. `0008_rls_policies.sql:70`
literally says "the correct semantic for a single-company internal CRM." That was
wrong: the app was always meant to be multi-tenant SaaS, where a company contains
its staff and all of its data, and nothing crosses between companies.

Nothing in the schema knows what a company is. There is no `companies` table and
no `company_id`, `tenant_id`, or `org_id` column anywhere in 26 tables. Every one
of the 88 RLS policies resolves the caller through `auth.uid()` alone, and
`staff.auth_user_id` is globally UNIQUE, so one login is structurally one company.

The outcome: a company is the top-level container. Staff belong to it, all
business data belongs to it, and cross-company access is impossible by
construction rather than by convention. Silicon Valley Moving & Storage becomes
the first real tenant; the existing filler data becomes a Demo Movers tenant that
exists mainly so isolation can be proven against a populated neighbour.

### Decisions already taken

- **Multi-company membership**, schema-complete from day one:
  `UNIQUE(company_id, auth_user_id)`. No switcher UI in this phase. Resolution
  falls back to the caller's oldest membership; the selection table exists and is
  honoured when set, so a switcher later is pure UI with no migration.
- **Demo Movers** receives all existing seed rows. **SVM** is created clean.
- **No platform super-admin.** No cross-tenant bypass predicate exists anywhere.
  Support access happens out of band via the service-role key.

### The performance constraint this design has to respect

`0008_rls_policies.sql:68-76` records a measured 506.1ms vs 3.7ms on 20,000 rows
and instructs that policies must not become per-row. That rule is honoured here.
`company_id = (select app.current_company_id())` keeps the function in an
InitPlan evaluated once per statement, and adds an indexed column comparison, not
a per-row function call. With `company_id` indexed this scans *fewer* rows than
today's all-rows-or-none seq scan. Any policy written without the `(select ...)`
wrapper is a defect.

---

## Design

### Tenant identity

```sql
create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null,
  name       text not null,
  status     text not null default 'Active'
             check (status in ('Active','Suspended','Closed')),
  is_seed    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_slug_key unique (slug)   -- globally unique: it IS the tenant key
);
```

### Active-company resolution

```sql
create table public.user_active_company (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  updated_at   timestamptz not null default now()
);
```

`app.current_company_id()` — STABLE, SECURITY DEFINER, `set search_path = ''`:

1. Return the selected company **only if** the caller still has an `Active` staff
   row in it. Membership is re-checked on every call, so revoking someone takes
   effect immediately rather than when their JWT expires. This is the reason for
   preferring a table lookup over a JWT claim.
2. Otherwise fall back to the caller's **oldest** `Active` membership, ordered by
   `staff.created_at` then `staff.id` as a tiebreak.
3. Return NULL only when there are **zero** active memberships.

**Deterministic fallback, not NULL, for the ambiguous case.** An earlier draft
returned NULL whenever a caller held two memberships and had no selection, on a
"deny rather than guess" instinct. That instinct is right for *unauthorized* and
wrong here: every candidate company is one the caller is already entitled to, and
since this phase ships no switcher and no way to write `user_active_company`, NULL
would brick the first legitimate two-company user with no recovery path. Picking
the oldest membership deterministically is not an escalation, it is choosing among
things already granted.

**NULL still denies, everywhere.** `company_id = null` is `null`, which RLS treats
as false, so a caller with no membership reads zero rows. The danger is the insert
default (see below) and any `is not distinct from` phrasing. Never write a policy
that could read as "no company means all companies."

`user_active_company` is written **only** by a SECURITY DEFINER
`set_active_company(p_company_id)` that validates membership first. `authenticated`
gets SELECT on it and nothing else, so the switcher later has a table waiting
without widening the grant surface now.

### Company scoping

Every tenant table gains `company_id uuid not null references public.companies(id)
on delete restrict`, indexed.

- **`permission_sets` stays global.** It is a vocabulary of slugs the application
  code references by name (`'proposals'`, `'vaults'`); it is not customer data.
- **`roles` becomes per-company.** Each company gets its own Owner / Admin /
  Read-only, seeded at provisioning time.
- **`app.code_counters`** gains `company_id`; PK becomes
  `(company_id, scope, period)` as a real UNIQUE constraint, because
  `on conflict` cannot resolve a partial index.

### Insert safety

```sql
alter table public.clients alter column company_id set default app.current_company_id();
```

Combined with `with check (company_id = (select app.current_company_id()))`, an
insert that forgets the tenant gets the right one and an insert that names the
wrong one is rejected. Two caveats to handle explicitly:

- Under service-role and inside migrations `auth.uid()` is NULL, so the default
  evaluates to NULL and hits the NOT NULL constraint. That is the desired
  behaviour: seed and provisioning code must name the company. Do not paper over
  it with a coalesce to some "default company."
- The default does not make the column safe to expose to UPDATE. The
  `with check` is what prevents moving a row between tenants. The isolation
  suite must include an attempted tenant-move UPDATE.

### Cross-tenant structural integrity

Give every parent table `unique (company_id, id)` and rewrite child FKs as
composite:

```sql
alter table public.deals drop constraint deals_client_id_fkey;
alter table public.deals add constraint deals_client_id_fkey
  foreign key (company_id, client_id)
  references public.clients (company_id, id) on delete restrict;
```

This makes attaching company A's client to company B's deal impossible even if a
policy is misconfigured or a service-role script has a bug. Applies to the 48
composite-eligible FKs. Excluded: `staff.auth_user_id → auth.users(id)` and
`role_permission_sets.permission_set_id → permission_sets(id)`, which point at
non-tenant tables.

#### `ON DELETE SET NULL` must use the column-list form — PROVEN

Measured against the live schema: of 50 FKs, **28 are `ON DELETE SET NULL`**, 11
CASCADE, 11 RESTRICT. 27 of the SET NULL ones are composite-eligible (the 28th is
`staff.auth_user_id`, which stays single-column).

A plain composite `ON DELETE SET NULL` nulls **every** referencing column. Run as
a spike against this database on Postgres 17.6, with a NOT NULL `company_id` and a
nullable `parent_id`:

| Form | Parent delete | `company_id` | `parent_id` |
|---|---|---|---|
| `on delete set null` | **fails, 23502** | would be nulled | would be nulled |
| `on delete set null (parent_id)` | **succeeds** | retained | nulled |

The plain form's failure, verbatim from Postgres:

```
UPDATE ONLY "fk_spike"."child_plain" SET "company_id" = NULL, "parent_id" = NULL
ERROR: 23502: null value in column "company_id" violates not-null constraint
```

So all 27 use the PG15+ column-list form:

```sql
... foreign key (company_id, client_id)
    references public.clients (company_id, id)
    on delete set null (client_id);
```

CASCADE and RESTRICT need no change. The spike schema was dropped after the run.

Two DDL cycles are closed by deferred `ALTER TABLE ADD CONSTRAINT`
(`roles`↔`staff` at `0002:240`, `deals`↔`quotes` at `0003:619`). The rewrite must
preserve that ordering.

*Note: the `unique (company_id, id)` indexes are redundant for lookup, since `id`
is already a PK. They exist solely as FK targets. That is an accepted cost.*

### PostgREST embed hints — BASELINE RECORDED, re-run after Task 4

Gates Task 4: if column-name embed hints (`client:client_id ( code )`) stop
resolving once `deals_client_id_fkey` becomes a composite FK, roughly 5 query
call sites (starting with `src/server/queries/deals.ts:20`) must change to
constraint-name hints (`client:deals_client_id_fkey ( code )`) in the same
commit as the constraint swap.

PostgREST only exposes `public`, so the spike schema (`embed_spike.parent` /
`embed_spike.child`, same shape as the FK spike above, dropped after the run)
could not be used to test the embed question directly. It was created anyway
to re-prove the `on delete set null (parent_id)` column-list DDL compiles on
this server, which is the form all 27 SET NULL composite FKs will use in
Task 4. That compiled cleanly, matching the result above.

The embed question itself was tested against the real, currently-single-column
`deals_client_id_fkey`, to capture the pre-Task-4 baseline for comparison.

Current shape of the constraint, from `pg_constraint`:

```
conname                | tbl   | cols
------------------------+-------+---------------
deals_accepted_quote_id_fkey | deals | {accepted_quote_id}
deals_client_id_fkey         | deals | {client_id}
deals_owner_staff_id_fkey    | deals | {owner_staff_id}
```

`deals_client_id_fkey` is single-column: `{client_id}`. After Task 4 it becomes
`{company_id,client_id}`.

HTTP request, as Elena Torres (Dispatcher, Scoped):

```
GET /rest/v1/deals?select=code,client:client_id(code)&limit=1
```

Response: `200 OK`

```json
[{"code":"DEAL-3015","client":{"code": "CLT-1014"}}]
```

This is the baseline. Re-run both queries after Task 4. If the embed request
comes back `PGRST200` instead of `200`, switch `client:client_id ( code )` to
the constraint-name form `client:deals_client_id_fkey ( code )` in
`src/server/queries/deals.ts:20` and the ~4 other call sites with the same
pattern, in the same commit as the constraint swap.

#### Re-run after Task 4 -- CONFIRMED BROKEN for composite FKs, fixed

`deals_client_id_fkey` is composite now: `{company_id,client_id}`. Re-ran the
identical request as Elena Torres (Dispatcher, Scoped), plus the column-name
and constraint-name forms side by side per site, so a stale PostgREST schema
cache couldn't be mistaken for "no change needed" (a single 200 doesn't prove
that; both forms returning 200 would have meant "retest after a cache
reload," not "nothing to do").

```
GET /rest/v1/deals?select=code,client:client_id(code)&limit=1
-> 400 PGRST200 "Could not find a relationship between 'deals' and
   'client_id' in the schema cache"

GET /rest/v1/deals?select=code,client:deals_client_id_fkey(code)&limit=1
-> 200 [{"code":"DEAL-3015","client":{"code":"CLT-1014"}}]
```

Column-name form broke, constraint-name form resolved cleanly on the first
try (no cache-reload retest needed). Checked all 5 candidate call sites the
same way, both forms, not just the one baseline query:

| Site | FK touched by 0015? | column-name | constraint-name | Action |
|---|---|---|---|---|
| `deals.ts:20` `client:client_id` | yes, composite | 400 PGRST200 | 200 | changed to `client:deals_client_id_fkey` |
| `deals.ts:21` `owner:owner_staff_id` | yes, composite | 400 PGRST200 | 200 | changed to `owner:deals_owner_staff_id_fkey` |
| `clients.ts:25` `account_owner:account_owner_staff_id` | yes, composite | 400 PGRST200 | 200 | changed to `account_owner:clients_account_owner_staff_id_fkey` |
| `auth.ts:62` `role:role_id` | yes, composite | 400 PGRST200 | 200 | changed to `role:staff_role_id_fkey` |
| `quotes.ts:323` `permission_set:permission_set_id!inner` | **no** -- `role_permission_sets.permission_set_id -> permission_sets(id)` is the deliberate global-catalog exemption, left single-column | 200 | 200 | **left unchanged** |

4 of the "roughly 5" sites needed the fix; the 5th didn't, and testing it
directly (rather than changing it on the assumption that "roughly 5" meant
"all 5") confirmed why: its FK was never touched. Changing it anyway would
have been safe (constraint-name hints work for single-column FKs too) but
would have asserted a reason that doesn't exist, on the query that also
gates write affordances for every Scoped user (`canWriteQuotes`) -- exactly
the kind of change that should be evidence-led, not pattern-completed.

`auth.ts:62` (`getCurrentStaff()`) is the highest-stakes of the four: it
does `if (error || !data) return null`, so a broken `role:role_id` hint
would have made every authenticated caller read as having no staff row at
all -- indistinguishable from the "zero rows, no error" failure mode
9999's own footer names as the hardest symptom in this system. Verified
fixed, as Elena Torres: `role:staff_role_id_fkey ( name, access_level )`
returns `{"name":"Dispatcher","access_level":"Scoped"}` for her row.

All three fixed application call sites were re-verified against their full,
real `SELECT` shape (not just the isolated embed clause) over HTTP as Elena
Torres, and separately behind a green `npm run build`.

### Policy shape

```sql
create policy clients_select on public.clients
  for select to authenticated
  using ( company_id = (select app.current_company_id())
          and (select app.is_active_staff()) );

create policy clients_insert on public.clients
  for insert to authenticated
  with check ( company_id = (select app.current_company_id())
               and (select app.has_perm('clients', true)) );
```

All 88 policies get the company predicate prepended. House style is preserved:
`<table>_<command>` naming, `to authenticated` always, every function call wrapped
in `(select ...)`.

Four policies already compare a row column against a scalar and need care rather
than mechanical edit: `staff_update`, `staff_profiles_sensitive_select`,
`document_stars_all`, and the branching `documents_select`.

### Helper functions

`app.current_staff_id()`, `is_active_staff()`, `is_active_writer()`,
`has_any_perm()`, `has_perm()` all gain
`and s.company_id = (select app.current_company_id())`.

`app.assert_owner_remains()` is currently company-blind — it asks whether *an*
active Owner exists anywhere, so company A's Owner would satisfy company B's
check. It must take a company argument.

`public.claim_staff_for_current_user()` is the hardest one. Its UPDATE matches on
verified email with no LIMIT, so one address invited to two companies would claim
both rows in a single statement. Rewrite to claim exactly one row, deterministically.

`next_quote_code()` / `next_invoice_code()` resolve the caller's company and mint
against `(company_id, scope, period)`. The permission array inside the minter must
stay byte-identical to the matching policy predicate, per the warning at `0008:443`.

### Provisioning

`public.create_company(p_name, p_slug, p_owner_email)` — SECURITY DEFINER,
granted to `service_role` only, never to `authenticated`, because there is no
self-serve signup. It creates the company, seeds its system roles and permission
bindings, creates the Owner staff row, and primes the code counters. This is the
one durable path by which any company comes into existence, including SVM.

---

## Migration sequence

`0011_pin_calc_labor_total_search_path.sql` already exists, so new work starts at
**0012**. Each file is one transaction and is verified before the next.

Applied via the Supabase MCP `apply_migration`, never `supabase db push` — a
PreToolUse hook denies that command.

| File | Contents |
|---|---|
| `0012_companies.sql` | `companies`, `user_active_company`, `app.current_company_id()` stub, their RLS + grants, indexes |
| `0013_company_id_columns.sql` | Add `company_id` **nullable** to all tenant tables + `app.code_counters` |
| `0014_backfill.sql` | Create Demo Movers, backfill every row, `set not null`, add indexes |
| `0015_constraints.sql` | 24 uniques → composite; 2 partial default-indexes → composite; 48 FKs → composite (27 using the `set null (col)` form); drop `company_billing_profile_singleton` |
| `0016_helpers_and_rls.sql` | Real `current_company_id()`; rewrite 5 helpers + `assert_owner_remains`; **set the column defaults**; rewrite all 88 policies |
| `0017_rpcs.sql` | Code minters, `claim_staff_for_current_user`, the five `admin_*` RPCs |
| `0018_views_grants.sql` | Views project `company_id`; re-issue grants |
| `0019_provisioning.sql` | `create_company()` + SVM tenant |
| `9999_security_guard.sql` | **Edit in place**: table count 27 → 29, extend the grant array, add multi-tenancy checks |

**Ordering constraint:** helpers in 0016 reference `staff.company_id`, which does
not exist until 0013 and is not populated until 0014. Policies must not be
rewritten before the column is NOT NULL, or every authenticated caller is locked
out mid-sequence. 0012's `current_company_id()` ships as a stub returning NULL and
is replaced in 0016 — RLS does not reference it until then. Column defaults are
set in 0016 alongside the real function, not in 0014, so a default can never
resolve against the stub.

### The two new tables need designed access, not just a count bump

Guard check 3 requires RLS on every table, check 4 requires at least one policy on
every `public` table, and check 7 compares the grant array **as a set in both
directions**, so an unexpected grant fails just as loudly as a missing one.

- **`companies`**: RLS `using (id = (select app.current_company_id()))`.
  `grant select` only. No write path for `authenticated` at all; companies are
  created by `create_company()` under service role.
- **`user_active_company`**: RLS `using (auth_user_id = (select auth.uid()))`.
  `grant select` only. Writes go exclusively through `set_active_company()`.

Table count 27 → 29.

**The guard will fail on first run after 0012.** That is intended friction, stated
in the file itself. Update it deliberately; do not loosen it.

### `0010_seed.sql` becomes un-rerunnable

Roughly 12 `on conflict` targets in the seed go stale once those constraints
become composite: `(code)`, `(slug)`, `(work_email)`, `(storage_path)`,
`(rate_card_id, crew_size)`, `(scope, period)`. This sequence backfills existing
rows rather than re-running 0010, so it is not a blocker, and step 13 was already
not rerunnable (the two quote INSERTs carry no `on conflict`). Noting it so it is
not discovered later: after this migration, reseeding from scratch means dropping
and recreating the database.

---

## Application layer

`src/lib/supabase/auth.ts` is the root of the retrofit. `getCurrentStaff()`
(line 54) is the only place a company can be resolved from the session.

- `getCurrentStaff()` selects and returns `company_id`.
- Add `getCurrentCompany()`, `cache()`-wrapped like its neighbours.
- `dashboard/layout.tsx` redirects to `/unauthorized` when the company resolves
  NULL, which is the zero-membership case.
- Sidebar wordmark reads the company name instead of `APP_CONFIG.name`
  (`app-sidebar.tsx`). `APP_CONFIG` stays for page metadata.
- Invoice `from` block reads `company_billing_profile` instead of the hardcoded
  `movingCompanyFromDetails` literal in
  `clients/[id]/_components/invoice/data.ts`.
- Storage paths gain a company prefix: `{company_id}/clients/{client_id}/...`.
  The `documents_object_insert` storage policy keys on path only, because the
  metadata row does not exist at upload time, so it must validate the prefix
  against the caller's company or a user can write into another tenant's prefix.

**Queries themselves need no `.eq("company_id", ...)`.** RLS is the enforcement,
and duplicating it in ~15 call sites is drift waiting to happen. The exception is
anything reached by service role.

### Generate types first

There is no `database.types.ts`. Every query module hand-writes row shapes with
`as any` and `as unknown as X[]`, so adding `company_id` gets zero compile-time
help. Add `supabase gen types` as an npm script and thread `Database` through
both client factories before touching query modules. This does not catch a
forgotten filter — RLS does that — but it catches every column-name and shape
error in a 26-table change, and there is no reason to do this migration blind.

---

## Verification

A green build proves nothing here. The deliverable is a real isolation suite,
`scripts/verify-isolation.ts`, run against two populated tenants:

1. For **each of the 26 tables**: sign in as a Demo user and an SVM user, assert
   each sees only their own rows and exactly zero of the other's. Table-driven,
   so a table added later without a company predicate fails automatically.
2. For **each of the 4 views**: same assertion. `security_invoker = true` views
   inherit RLS, but CLAUDE.md records that they can silently return zero rows, so
   assert both isolation *and* non-emptiness.
3. Attempt a cross-tenant **write**: update a Demo row while signed in as SVM
   (expect zero rows affected), and attempt to move a row between tenants by
   setting `company_id` (expect rejection).
4. Attempt cross-tenant **reference**: create a deal in SVM pointing at a Demo
   client (expect FK violation, proving the composite FK, not just the policy).
5. Assert permission bleed is gone: a user with write permission in Demo and
   read-only in SVM cannot write in SVM. This is the bug that exists the moment a
   second membership appears without company-scoped `has_any_perm`, so it is the
   single most important assertion in the suite.
6. Assert the two-membership case resolves rather than bricks: a user with staff
   rows in both companies and no selection lands on the oldest membership, sees a
   full non-empty dataset for it, and zero rows from the other.
7. Assert a user with **zero** active memberships reads zero rows everywhere, and
   that `current_company_id()` is NULL for them.
8. Assert `on delete set null (col)` behaves in the real schema: delete a parent
   that these FKs point at and confirm the child's `company_id` survives while the
   reference is nulled.

**Then break it on purpose.** Per CLAUDE.md, a guard that has never failed is not
a guard. Drop the company predicate from one policy, watch the suite fail, restore
it. Record which check caught it.

Also: re-run `9999_security_guard.sql`; run `get_advisors` for new RLS/perf
findings; `npm run build`; and exercise the app as Elena Torres (Dispatcher,
Scoped) rather than an Owner, since Full access short-circuits every permission
check and proves nothing.

### SVM account

Create via a script reading `SVM_OWNER_PASSWORD` from the environment, matching
the existing `scripts/seed-auth-users.ts` pattern. The password must not be
committed, hardcoded, or written to a tracked file.

The password shared in chat should be rotated after first login, since it now
exists in a conversation transcript.

---

## Out of scope

Deliberately not in this phase, to keep the isolation surface reviewable:

- Company switcher UI, login company-chooser, invite tokens
- Self-serve signup (`create_company` stays service-role only)
- Converting Warehouse / Calendar / Documents / Settings to live reads. Their
  screens stay static; this migration only makes the data underneath tenant-safe
- The inert chrome buttons, pipeline drag persistence, synthetic charts
- Splitting `routing_number` out of the broad `company_billing_profile` read
  (carried-forward D21), though the table is being rebuilt here so it may be
  cheap to fold in
