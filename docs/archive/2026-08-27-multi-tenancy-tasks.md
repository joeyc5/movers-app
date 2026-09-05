# Multi-Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert movers-app from a single-company CRM to multi-tenant SaaS where a company contains its staff and all its data, and cross-tenant access is impossible by construction.

**Architecture:** A `companies` table plus a `company_id` column on 25 public tables and `app.code_counters`. Tenant isolation is enforced by one RESTRICTIVE RLS policy per table with an identical body, ANDed with the existing 88 permission policies which are left untouched. Composite foreign keys make cross-tenant references structurally impossible; a BEFORE UPDATE trigger makes `company_id` immutable even under `service_role`, which bypasses RLS.

**Tech Stack:** Postgres 17.6 on Supabase (`jannhzvqrsumtscidtkx`), Next.js 16 App Router, `@supabase/ssr`, TanStack Table v9, TypeScript.

**Spec:** `docs/MULTI-TENANCY-PLAN.md` (approved design + Step 0 FK spike result)

## Global Constraints

- Migrations are applied with the Supabase MCP `apply_migration`. **Never** `supabase db push` — a PreToolUse hook denies it.
- New migrations start at **0012**. `0011_pin_calc_labor_total_search_path.sql` already exists.
- Every function pins `set search_path = ''` and schema-qualifies everything internally.
- Every policy predicate wraps function calls as `(select fn())`. Measured 506.1ms vs 3.7ms on 20k rows (`0008_rls_policies.sql:54-76`). A bare call is a defect.
- Every policy is `to authenticated`, except the tenant policies which are `to public`.
- `staff.work_email` is `extensions.citext`; its operators do not resolve under `search_path = ''`. Compare via `lower(x::text)`.
- `on conflict` cannot target a partial index. Use real UNIQUE constraints.
- A policy is not a grant. Verify with `information_schema.role_table_grants` AND `column_privileges`.
- Re-run `9999_security_guard.sql` after every migration.
- Never filter a REFERENCED staff row by status. Sofia Marchetti is Deactivated and owns live records.
- Verify as **Elena Torres** (Dispatcher, Scoped), never Morgan Ellis or Grace Chen — `access_level = 'Full'` short-circuits every permission check and proves nothing.
- No em dashes in user-facing copy.

### Canonical table lists (copy verbatim; these drive every DO-block)

**25 public tenant tables** get `company_id`:
`calendar_event_crew, calendar_events, clients, company_billing_profile, crew_rates, deals, document_folders, document_stars, documents, fee_catalog, invoice_line_items, invoices, quote_line_items, quotes, rate_cards, role_permission_sets, roles, staff, staff_locations, staff_profiles, staff_profiles_sensitive, storage_agreements, tax_rates, vaults, warehouse_locations`

Plus `app.code_counters`. Total 26 tables scoped.

**3 exempt tables:** `companies`, `user_active_company` (tenancy infrastructure), `permission_sets` (global slug vocabulary the app references by name).

**15 FK-target parents** needing `unique (company_id, id)`:
`calendar_events, clients, deals, document_folders, documents, fee_catalog, invoices, quote_line_items, quotes, rate_cards, roles, staff, storage_agreements, tax_rates, warehouse_locations`

**7 tables with no `id` column** (never FK targets, no `unique (company_id, id)`):
`calendar_event_crew, company_billing_profile, document_stars, role_permission_sets, staff_locations, staff_profiles, staff_profiles_sensitive`

**2 permanent unique exemptions:** `documents_storage_path_key` (keys a globally namespaced object store), `companies_slug_key` (is the tenant key).

---

## File Structure

**New migrations** (`supabase/migrations/`):
- `0012_companies.sql` — tenant identity, resolver, immutability trigger function
- `0013_company_id_columns.sql` — nullable `company_id` everywhere
- `0014_backfill.sql` — Demo Movers, backfill, NOT NULL, defaults, triggers, indexes
- `0015_constraints.sql` — unique + FK swaps
- `0016_tenant_rls.sql` — helper rewrite + restrictive policies (the atomic lockout window)
- `0017_definer_surface.sql` — code minters, claim, `admin_*`, `assert_owner_remains`
- `0018_storage_grants.sql` — storage repath, `company_billing_profile`, grants
- `0019_provisioning.sql` — `create_company()` + SVM
- `0020_tenancy_guard.sql` — structural assertions

**Modified:** `9999_security_guard.sql` (count 27→29, grant array).

**New scripts:** `scripts/verify-isolation.ts` (partition test), `scripts/seed-svm-owner.ts`.

**New app files:** `src/lib/supabase/database.types.ts` (generated).

**Modified app files:** `src/lib/supabase/auth.ts`, `server.ts`, `client.ts`, `src/app/(main)/dashboard/layout.tsx`, `_components/sidebar/app-sidebar.tsx`, `src/app/(main)/dashboard/clients/[id]/_components/invoice/data.ts`.

---

## Task 0: Spike PostgREST composite-FK embed hints

Gates Task 4. If column-name embed hints break against multi-column FKs, ~5 query call sites must change in the same commit as the constraint swap.

**Files:**
- No files. Live DB spike, cleaned up after.

**Interfaces:**
- Produces: a yes/no on whether `select=child:parent_id(col)` resolves against a composite FK, recorded in `docs/MULTI-TENANCY-PLAN.md`.

- [ ] **Step 1: Create the spike tables**

```sql
create schema if not exists embed_spike;
create table embed_spike.parent (
  company_id uuid not null, id uuid not null default gen_random_uuid(),
  label text not null,
  constraint parent_pkey primary key (id),
  constraint parent_company_id_key unique (company_id, id)
);
create table embed_spike.child (
  company_id uuid not null, id uuid primary key default gen_random_uuid(),
  parent_id uuid,
  constraint child_parent_fkey foreign key (company_id, parent_id)
    references embed_spike.parent (company_id, id) on delete set null (parent_id)
);
```

- [ ] **Step 2: Ask PostgREST to resolve the relationship**

PostgREST only exposes `public`, so test the real question directly against the shipped schema instead. Read how PostgREST currently sees a single-column FK, then compare after Task 4:

```sql
select conname, conrelid::regclass::text as tbl,
       (select array_agg(a.attname order by k.ord)
          from unnest(conkey) with ordinality k(attnum, ord)
          join pg_attribute a on a.attrelid = conrelid and a.attnum = k.attnum) as cols
from pg_constraint
where conrelid = 'public.deals'::regclass and contype = 'f';
```

Expected now: `deals_client_id_fkey` with `{client_id}`. After Task 4 it becomes `{company_id,client_id}`, and `client:client_id ( code )` in `src/server/queries/deals.ts:20` must still resolve.

- [ ] **Step 3: Test the actual embed over HTTP**

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/deals?select=code,client:client_id(code)&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $ELENA_ACCESS_TOKEN"
```

Record the response. This is the baseline; re-run it after Task 4 and compare. A `PGRST200` after Task 4 means switch to constraint-name hints: `client:deals_client_id_fkey ( code )`.

- [ ] **Step 4: Clean up**

```sql
drop schema embed_spike cascade;
```

- [ ] **Step 5: Record the finding and commit**

Append the result to `docs/MULTI-TENANCY-PLAN.md` under a "PostgREST embed hints" heading.

```bash
git add docs/MULTI-TENANCY-PLAN.md
git commit -m "Record the PostgREST composite-FK embed baseline"
```

---

## Task 1: Tenant identity and the resolver (0012)

**Files:**
- Create: `supabase/migrations/0012_companies.sql`

**Interfaces:**
- Produces: `public.companies(id, slug, name, status, timezone, code_prefix, is_seed, created_at, updated_at)`; `public.user_active_company(auth_user_id, company_id, updated_at)`; `app.current_company_id() returns uuid`; `public.current_company_state() returns table(state text, company_id uuid, company_name text)`; `app.tg_company_id_immutable() returns trigger`.
- Consumes: nothing.

`timezone` and `code_prefix` exist from day one because `next_quote_code()` hardcodes `'America/Los_Angeles'` and `'QTE-'`, and both are per-company facts. Retrofitting them after tenants have minted codes is a data migration.

- [ ] **Step 1: Write the assertion that must fail first**

```sql
select to_regclass('public.companies') is not null as companies_exists,
       to_regprocedure('app.current_company_id()') is not null as resolver_exists;
```

- [ ] **Step 2: Run it and confirm both are false**

Expected: `companies_exists = false`, `resolver_exists = false`.

- [ ] **Step 3: Write the migration**

`set check_function_bodies = off` is the existing repo idiom (`0001_baseline.sql:26`) for a function body referencing a column that does not exist yet. `staff.company_id` arrives in 0013.

```sql
set check_function_bodies = off;

create table public.companies (
  id          uuid not null default gen_random_uuid(),
  slug        text not null,
  name        text not null,
  status      text not null default 'Active',
  timezone    text not null default 'America/Los_Angeles',
  code_prefix text not null default '',
  is_seed     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint companies_pkey primary key (id),
  -- Globally unique on purpose: the slug IS the tenant key. Named in the
  -- 0020 guard as a permanent exemption from the company_id rule.
  constraint companies_slug_key unique (slug),
  constraint companies_status_check check (status in ('Active','Suspended','Closed'))
);
alter table public.companies enable row level security;

create table public.user_active_company (
  auth_user_id uuid not null,
  company_id   uuid not null,
  updated_at   timestamptz not null default now(),
  constraint user_active_company_pkey primary key (auth_user_id),
  constraint user_active_company_user_fkey
    foreign key (auth_user_id) references auth.users(id) on delete cascade,
  constraint user_active_company_company_fkey
    foreign key (company_id) references public.companies(id) on delete cascade
);
alter table public.user_active_company enable row level security;

create trigger trg_companies_touch before update on public.companies
  for each row execute function app.tg_set_updated_at();

-- The resolver. Membership is re-validated on every call, so revoking
-- someone takes effect immediately rather than at JWT expiry. That is the
-- reason this is a table lookup and not a JWT claim.
--
-- The two NULL cases are deliberately different:
--   * a selection row that no longer matches an Active membership -> NULL.
--     A revocation must read as a denial, never as a silent tenant switch.
--   * no selection row at all -> oldest Active membership. Every candidate
--     is already authorized, so choosing among them is not an escalation,
--     and this phase ships no switcher to recover from a NULL.
create or replace function app.current_company_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    ( select uac.company_id
        from public.user_active_company uac
        join public.staff s on s.company_id = uac.company_id
                           and s.auth_user_id = uac.auth_user_id
                           and s.status = 'Active'
       where uac.auth_user_id = (select auth.uid()) ),
    ( select s.company_id
        from public.staff s
       where s.auth_user_id = (select auth.uid())
         and s.status = 'Active'
         and not exists ( select 1 from public.user_active_company u
                           where u.auth_user_id = (select auth.uid()) )
       order by s.created_at, s.id
       limit 1 )
  )
$$;

comment on function app.current_company_id() is
  'The caller''s active company, revalidated against Active membership on every call. NULL means deny.';

-- NULL must be legible. is_active_staff() going false renders the whole app
-- blank with no error, which 9999_security_guard.sql names as this system''s
-- hardest symptom. The layout calls this to tell the states apart.
create or replace function public.current_company_state()
returns table (state text, company_id uuid, company_name text)
language sql stable security definer set search_path = '' as $$
  with memberships as (
    select s.company_id from public.staff s
     where s.auth_user_id = (select auth.uid()) and s.status = 'Active'
  )
  select case
           when (select count(*) from memberships) = 0 then 'no-membership'
           when app.current_company_id() is null       then 'revoked-selection'
           else 'ok'
         end,
         app.current_company_id(),
         (select c.name from public.companies c where c.id = app.current_company_id())
$$;

-- service_role has BYPASSRLS, so `with check` does not constrain it.
-- Triggers do. This is the only thing between a service-role script bug and
-- a silently re-tenanted row.
create or replace function app.tg_company_id_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'company_id is immutable on %.% (% -> %)',
      tg_table_schema, tg_table_name, old.company_id, new.company_id
      using errcode = '23514';
  end if;
  return new;
end $$;

create policy companies_select on public.companies
  for select to authenticated
  using ( id = (select app.current_company_id()) );

create policy user_active_company_select on public.user_active_company
  for select to authenticated
  using ( auth_user_id = (select auth.uid()) );

-- No switcher ships this phase, so this table has no legitimate writer.
-- When it does, the predicate is already written:
--   create policy user_active_company_write on public.user_active_company
--     for all to authenticated
--     using      ( auth_user_id = (select auth.uid()) )
--     with check ( exists (select 1 from public.staff s
--                           where s.auth_user_id = (select auth.uid())
--                             and s.company_id = user_active_company.company_id
--                             and s.status = 'Active') );

revoke all on public.companies, public.user_active_company from public, anon, authenticated;
grant select on public.companies            to authenticated;
grant select on public.user_active_company  to authenticated;

revoke all on function app.current_company_id(), app.tg_company_id_immutable()
  from public, anon, authenticated;
grant execute on function app.current_company_id() to authenticated;
revoke all on function public.current_company_state() from public, anon, authenticated;
grant execute on function public.current_company_state() to authenticated;

reset check_function_bodies;
```

- [ ] **Step 4: Apply and re-run the Step 1 assertion**

Expected: both `true`. Also confirm the resolver returns NULL rather than raising:

```sql
select app.current_company_id() is null as resolver_returns_null;
```

- [ ] **Step 5: Confirm the guard now fails, deliberately**

Run `9999_security_guard.sql`. Expected: raises on check 3 (`27` tables, now 29). This is the designed friction. Do not fix it yet; Task 9 owns it.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0012_companies.sql
git commit -m "Add the companies table and the tenant resolver"
```

---

## Task 2: Nullable company_id everywhere (0013)

**Files:**
- Create: `supabase/migrations/0013_company_id_columns.sql`

**Interfaces:**
- Consumes: `public.companies` from Task 1.
- Produces: a nullable `company_id uuid` on all 25 public tenant tables and `app.code_counters`.

Nullable, no default, no constraints. A `not null default app.current_company_id()` in one statement is a trap: the function is STABLE, so Postgres evaluates it **once at DDL time** (NULL, since migrations run as `postgres`), stores that as the missing-value, and the statement fails on its own NOT NULL.

- [ ] **Step 1: Write the assertion that must fail**

```sql
select count(*) as tables_with_company_id
from information_schema.columns
where table_schema = 'public' and column_name = 'company_id';
```

- [ ] **Step 2: Run it**

Expected: `2` (only `companies` via its own `id`? no — expect `1`, `user_active_company`). Record the actual number as the baseline.

- [ ] **Step 3: Write the migration**

`company_billing_profile` is excluded here; Task 7 rebuilds it with `company_id` as its primary key.

```sql
do $$
declare
  t text;
  v_tables text[] := array[
    'calendar_event_crew','calendar_events','clients','crew_rates','deals',
    'document_folders','document_stars','documents','fee_catalog',
    'invoice_line_items','invoices','quote_line_items','quotes','rate_cards',
    'role_permission_sets','roles','staff','staff_locations','staff_profiles',
    'staff_profiles_sensitive','storage_agreements','tax_rates','vaults',
    'warehouse_locations'
  ];
begin
  foreach t in array v_tables loop
    execute format('alter table public.%I add column company_id uuid', t);
  end loop;
end $$;

alter table app.code_counters add column company_id uuid;
```

- [ ] **Step 4: Verify the count**

```sql
select count(*) from information_schema.columns
where table_schema = 'public' and column_name = 'company_id';
```

Expected: `26` (24 added + `user_active_company` + ... ). Confirm against the actual baseline from Step 2 plus 24.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0013_company_id_columns.sql
git commit -m "Add nullable company_id to every tenant table"
```

---

## Task 3: Backfill, NOT NULL, defaults, triggers, indexes (0014)

**Files:**
- Create: `supabase/migrations/0014_backfill.sql`

**Interfaces:**
- Consumes: nullable `company_id` from Task 2.
- Produces: `company_id` NOT NULL and defaulted on every tenant table; the Demo Movers company row; immutability triggers; `(company_id)` indexes.

- [ ] **Step 1: Write the assertion that must fail**

```sql
select count(*) as rows_without_company from public.clients where company_id is null;
```

Expected before: 22 (all of them). After: 0.

- [ ] **Step 2: Write the migration**

```sql
insert into public.companies (slug, name, code_prefix, is_seed)
values ('demo-movers', 'Demo Movers', 'QTE', true)
on conflict (slug) do nothing;

do $$
declare
  t text;
  v_demo uuid;
  v_tables text[] := array[
    'calendar_event_crew','calendar_events','clients','crew_rates','deals',
    'document_folders','document_stars','documents','fee_catalog',
    'invoice_line_items','invoices','quote_line_items','quotes','rate_cards',
    'role_permission_sets','roles','staff','staff_locations','staff_profiles',
    'staff_profiles_sensitive','storage_agreements','tax_rates','vaults',
    'warehouse_locations'
  ];
begin
  select id into strict v_demo from public.companies where slug = 'demo-movers';

  foreach t in array v_tables loop
    execute format('update public.%I set company_id = %L where company_id is null', t, v_demo);
    execute format('alter table public.%I alter column company_id set not null', t);
    execute format('alter table public.%I alter column company_id set default app.current_company_id()', t);
    execute format('alter table public.%I add constraint %I foreign key (company_id) '
                || 'references public.companies(id) on delete restrict', t, t || '_company_id_fkey');
    execute format('create index if not exists %I on public.%I (company_id)', t || '_company_id_idx', t);
    execute format('create trigger trg_%s_company_immutable before update on public.%I '
                || 'for each row execute function app.tg_company_id_immutable()', t, t);
  end loop;

  update app.code_counters set company_id = v_demo where company_id is null;
  alter table app.code_counters alter column company_id set not null;
end $$;
```

- [ ] **Step 3: Apply, then verify no NULLs and no orphans anywhere**

```sql
do $$
declare t text; n bigint;
begin
  for t in select table_name from information_schema.columns
            where table_schema='public' and column_name='company_id'
              and table_name <> 'user_active_company'
  loop
    execute format('select count(*) from public.%I where company_id is null', t) into n;
    if n > 0 then raise exception '% has % null company_id rows', t, n; end if;
  end loop;
  raise notice 'backfill clean';
end $$;
```

Expected: `NOTICE: backfill clean`.

- [ ] **Step 4: Prove the immutability trigger fires**

```sql
do $$
declare v_other uuid := gen_random_uuid();
begin
  begin
    update public.clients set company_id = v_other
     where id = (select id from public.clients limit 1);
    raise exception 'TRIGGER DID NOT FIRE';
  exception when sqlstate '23514' then
    raise notice 'immutability trigger fired correctly';
  end;
end $$;
```

Expected: `NOTICE: immutability trigger fired correctly`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0014_backfill.sql
git commit -m "Backfill every tenant row to Demo Movers and lock company_id down"
```

---

## Task 4: Unique and foreign key swaps (0015)

**Files:**
- Create: `supabase/migrations/0015_constraints.sql`

**Interfaces:**
- Consumes: NOT NULL `company_id` from Task 3.
- Produces: composite uniques, `unique (company_id, id)` on the 15 FK-target parents, 48 composite FKs.

Three things that are easy to get wrong and are each load-bearing:

- **27 FKs are `ON DELETE SET NULL`** and need the PG15+ column-list form. Proven on this database: the plain form nulls `company_id` too and fails with `23502`; `on delete set null (col)` retains `company_id` and nulls only the reference. See `docs/MULTI-TENANCY-PLAN.md`.
- **MATCH SIMPLE is correct.** It skips the check when any column is NULL, which with `company_id NOT NULL` means "no reference". `MATCH FULL` would forbid every optional reference in the schema. It looks stricter and is wrong.
- **The two partial unique indexes are not in `pg_constraint`.** `rate_cards_single_default_idx` and `tax_rates_single_default_idx` are `on (is_default) where is_default`, so SVM cannot have a default rate card at all while Demo holds the one permitted `true`. `src/server/quote-actions.ts:90-91` does `.eq("is_default", true).maybeSingle()` and returns null, killing the quote builder for the second tenant.

- [ ] **Step 1: Write the assertion that must fail**

```sql
select count(*) as global_uniques_remaining
from pg_constraint c
where c.connamespace='public'::regnamespace and c.contype='u'
  and c.conrelid::regclass::text not in ('companies','permission_sets','user_active_company')
  and not exists (select 1 from unnest(c.conkey) k
                  join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k
                  where a.attname='company_id');
```

Expected before: 22-ish. After: 1 (`documents_storage_path_key`, the named exemption).

- [ ] **Step 2: Write the unique swaps**

```sql
-- Codes, slugs and names are per-company namespaces now.
alter table public.clients             drop constraint clients_code_key,
  add constraint clients_company_code_key unique (company_id, code);
alter table public.deals               drop constraint deals_code_key,
  add constraint deals_company_code_key unique (company_id, code);
alter table public.quotes              drop constraint quotes_code_key,
  add constraint quotes_company_code_key unique (company_id, code);
alter table public.invoices            drop constraint invoices_code_key,
  add constraint invoices_company_code_key unique (company_id, code);
alter table public.storage_agreements  drop constraint storage_agreements_code_key,
  add constraint storage_agreements_company_code_key unique (company_id, code);
alter table public.vaults              drop constraint vaults_code_key,
  add constraint vaults_company_code_key unique (company_id, code);
alter table public.calendar_events     drop constraint calendar_events_code_key,
  add constraint calendar_events_company_code_key unique (company_id, code);
alter table public.rate_cards          drop constraint rate_cards_code_key,
  add constraint rate_cards_company_code_key unique (company_id, code);
alter table public.fee_catalog         drop constraint fee_catalog_code_key,
  add constraint fee_catalog_company_code_key unique (company_id, code);
alter table public.tax_rates           drop constraint tax_rates_code_key,
  add constraint tax_rates_company_code_key unique (company_id, code);
alter table public.quote_line_items    drop constraint quote_line_items_external_key_key,
  add constraint quote_line_items_company_external_key_key unique (company_id, external_key);
alter table public.invoice_line_items  drop constraint invoice_line_items_external_key_key,
  add constraint invoice_line_items_company_external_key_key unique (company_id, external_key);
alter table public.documents           drop constraint documents_external_ref_key,
  add constraint documents_company_external_ref_key unique (company_id, external_ref);
alter table public.warehouse_locations drop constraint warehouse_locations_slug_key,
  add constraint warehouse_locations_company_slug_key unique (company_id, slug);
alter table public.warehouse_locations drop constraint warehouse_locations_name_key,
  add constraint warehouse_locations_company_name_key unique (company_id, name);
alter table public.document_folders    drop constraint document_folders_slug_key,
  add constraint document_folders_company_slug_key unique (company_id, slug);
alter table public.document_folders    drop constraint document_folders_name_key,
  add constraint document_folders_company_name_key unique (company_id, name);
alter table public.roles               drop constraint roles_slug_key,
  add constraint roles_company_slug_key unique (company_id, slug);
alter table public.roles               drop constraint roles_name_key,
  add constraint roles_company_name_key unique (company_id, name);
alter table public.staff               drop constraint staff_work_email_key,
  add constraint staff_company_work_email_key unique (company_id, work_email);
alter table public.staff_profiles      drop constraint staff_profiles_employee_ref_key,
  add constraint staff_profiles_company_employee_ref_key unique (company_id, employee_ref);
alter table public.crew_rates          drop constraint crew_rates_card_crew_key,
  add constraint crew_rates_company_card_crew_key unique (company_id, rate_card_id, crew_size);

-- THE multi-membership enabler. Drop-then-add, never add-only: the global
-- unique is a hard block on one auth user holding two staff rows.
alter table public.staff drop constraint staff_auth_user_id_key,
  add constraint staff_company_auth_user_key unique (company_id, auth_user_id);

-- Partial unique indexes: not constraints, invisible to pg_constraint.
drop index public.rate_cards_single_default_idx;
create unique index rate_cards_single_default_idx
  on public.rate_cards (company_id) where is_default;
drop index public.tax_rates_single_default_idx;
create unique index tax_rates_single_default_idx
  on public.tax_rates (company_id) where is_default;

-- DELIBERATELY NOT COMPOSITE. storage_path keys a globally namespaced object
-- store. Per-company uniqueness would let tenant A insert a documents row
-- naming tenant B's real object key; documents_object_select matches on path
-- alone, so A's own (RLS-legal) row would satisfy it and A downloads B's file.
-- Uniqueness scope must match the namespace scope of the thing being keyed.
-- documents_storage_path_key stays global. Named in the 0020 guard.

-- app.code_counters PK. A real UNIQUE, because on_conflict targets it.
alter table app.code_counters drop constraint code_counters_pkey,
  add constraint code_counters_pkey primary key (company_id, scope, period);
```

- [ ] **Step 3: Add the FK-target uniques and swap the FKs**

`not valid` + separate `validate` so a violation names one constraint instead of aborting a 48-statement file on the first failure.

```sql
do $$
declare
  t text;
  v_parents text[] := array[
    'calendar_events','clients','deals','document_folders','documents',
    'fee_catalog','invoices','quote_line_items','quotes','rate_cards',
    'roles','staff','storage_agreements','tax_rates','warehouse_locations'
  ];
begin
  foreach t in array v_parents loop
    -- Required: an FK must reference a unique constraint whose column list
    -- matches exactly. `id` being independently unique does not satisfy that.
    -- Doubles as the leading-column index for the tenant predicate.
    execute format('alter table public.%I add constraint %I unique (company_id, id)',
                   t, t || '_company_id_key');
  end loop;
end $$;
```

Then each FK, dropped and re-added. Representative examples covering all three delete actions:

```sql
-- RESTRICT: action unchanged
alter table public.deals drop constraint deals_client_id_fkey;
alter table public.deals add constraint deals_client_id_fkey
  foreign key (company_id, client_id) references public.clients (company_id, id)
  on delete restrict on update restrict not valid;

-- CASCADE: action unchanged
alter table public.quote_line_items drop constraint quote_line_items_quote_id_fkey;
alter table public.quote_line_items add constraint quote_line_items_quote_id_fkey
  foreign key (company_id, quote_id) references public.quotes (company_id, id)
  on delete cascade on update restrict not valid;

-- SET NULL: column list REQUIRED. Without `(client_id)` this nulls
-- company_id too and every parent delete fails with 23502.
alter table public.quotes drop constraint quotes_client_id_fkey;
alter table public.quotes add constraint quotes_client_id_fkey
  foreign key (company_id, client_id) references public.clients (company_id, id)
  on delete set null (client_id) on update restrict not valid;

-- Self-referencing works identically; the only wrinkle is the column list.
alter table public.staff_profiles drop constraint staff_profiles_manager_staff_id_fkey;
alter table public.staff_profiles add constraint staff_profiles_manager_staff_id_fkey
  foreign key (company_id, manager_staff_id) references public.staff (company_id, id)
  on delete set null (manager_staff_id) on update restrict not valid;
```

Apply this pattern to all 48 composite-eligible FKs, preserving the two deferred-ALTER cycles (`roles`↔`staff` at `0002:240`, `deals`↔`quotes` at `0003:619`).

**Left single-column, deliberately:** `staff.auth_user_id → auth.users(id)` (no tenant, must not be touched) and `role_permission_sets.permission_set_id → permission_sets(id)` (global catalog). Both named in the 0020 guard.

Then validate them all:

```sql
do $$
declare r record;
begin
  for r in select conrelid::regclass::text as tbl, conname
             from pg_constraint
            where connamespace='public'::regnamespace and contype='f' and not convalidated
  loop
    execute format('alter table %s validate constraint %I', r.tbl, r.conname);
  end loop;
end $$;
```

- [ ] **Step 4: Re-run the Step 1 assertion**

Expected: `1`, and querying which one confirms it is `documents_storage_path_key`.

- [ ] **Step 5: Re-run the Task 0 embed baseline**

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/deals?select=code,client:client_id(code)&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $ELENA_ACCESS_TOKEN"
```

If `PGRST200`, change the ~5 embed hints to constraint-name form (`client:deals_client_id_fkey ( code )`) in `src/server/queries/deals.ts:20-21`, `src/lib/supabase/auth.ts:61`, `src/server/queries/quotes.ts:323`, `src/server/queries/clients.ts` **in this same commit**.

- [ ] **Step 6: Prove SET NULL retains company_id in the real schema**

```sql
begin;
  update public.quotes set client_id = (select id from public.clients limit 1)
   where id = (select id from public.quotes limit 1);
  delete from public.clients where id = (select client_id from public.quotes
                                          where client_id is not null limit 1);
  select company_id is not null as company_retained, client_id is null as ref_nulled
    from public.quotes where id = (select id from public.quotes limit 1);
rollback;
```

Expected: `company_retained = true`, `ref_nulled = true`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0015_constraints.sql src/server/queries/ src/lib/supabase/auth.ts
git commit -m "Make every unique and foreign key tenant-aware"
```

---

## Task 5: Helper rewrite and tenant isolation policies (0016)

**Files:**
- Create: `supabase/migrations/0016_tenant_rls.sql`

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: 25 `tenant_isolation` RESTRICTIVE policies; company-scoped `current_staff_id`, `is_active_staff`, `is_active_writer`, `has_any_perm`.

**This is the only lockout window and it is one transaction.** The helpers cannot be rewritten before backfill: `current_staff_id()` gaining a company predicate while `company_id` is NULL returns NULL for everyone, `is_active_staff()` goes false, and the app is dark.

**Tenancy is a separate RESTRICTIVE policy, and `0008_rls_policies.sql` is not edited at all.** Grafting a company term into 88 hand-written predicates means getting the nesting right inside OR-shaped ones like `documents_select` (a four-branch OR inside a two-branch OR) and `staff_profiles_sensitive_select`. Thirty chances to be 96% right. A restrictive policy is ANDed by construction, cannot be widened by any future permissive policy, and is verifiable by exact string equality. It is also consistent with this repo's own philosophy: grants in 0009, permissions in 0008, tenancy in its own file, each separately diagnosable.

`to public`, not `to authenticated`, so it cannot be sidestepped by a role nobody anticipated.

Do **not** use `force row level security`. It applies to the table owner, which is `postgres`, which is how migrations and seeds run.

- [ ] **Step 1: Write the assertion that must fail**

```sql
select count(*) as restrictive_tenant_policies
from pg_policy p join pg_class c on c.oid = p.polrelid
where c.relnamespace='public'::regnamespace
  and p.polname='tenant_isolation' and not p.polpermissive;
```

Expected before: 0. After: 25.

- [ ] **Step 2: Write the migration**

```sql
-- Every helper now resolves within the caller's company. has_any_perm is the
-- important one: without the company predicate, write permission held in one
-- company silently authorizes writes in another the moment a second
-- membership exists.
create or replace function app.current_staff_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select s.id from public.staff s
  where s.auth_user_id = (select auth.uid())
    and s.status = 'Active'
    and s.company_id = (select app.current_company_id())
$$;

create or replace function app.is_active_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.auth_user_id = (select auth.uid())
      and s.status = 'Active'
      and s.company_id = (select app.current_company_id())
  )
$$;

create or replace function app.is_active_writer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    join public.roles r on r.id = s.role_id
    where s.auth_user_id = (select auth.uid())
      and s.status = 'Active'
      and s.company_id = (select app.current_company_id())
      and r.access_level <> 'Read only'
  )
$$;

create or replace function app.has_any_perm(p_sets text[], p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_unknown text;
begin
  select string_agg(x, ', ') into v_unknown
  from unnest(p_sets) x
  where not exists (select 1 from public.permission_sets ps where ps.slug = x);

  if v_unknown is not null then
    raise exception 'app.has_any_perm: unknown permission set(s): %', v_unknown
      using errcode = '22023';
  end if;

  return exists (
    select 1
    from public.staff s
    join public.roles r on r.id = s.role_id
    where s.auth_user_id = (select auth.uid())
      and s.status = 'Active'
      and s.company_id = (select app.current_company_id())
      and (not p_write or r.access_level <> 'Read only')
      and ( r.access_level = 'Full'
            or exists ( select 1
                          from public.role_permission_sets rp
                          join public.permission_sets ps on ps.id = rp.permission_set_id
                         where rp.role_id = r.id and ps.slug = any(p_sets) ) )
  );
end $$;

-- One identical restrictive policy per tenant table. Body must stay
-- byte-identical across all 25; the 0020 guard asserts exact string equality.
do $$
declare
  t text;
  v_tables text[] := array[
    'calendar_event_crew','calendar_events','clients','crew_rates','deals',
    'document_folders','document_stars','documents','fee_catalog',
    'invoice_line_items','invoices','quote_line_items','quotes','rate_cards',
    'role_permission_sets','roles','staff','staff_locations','staff_profiles',
    'staff_profiles_sensitive','storage_agreements','tax_rates','vaults',
    'warehouse_locations'
  ];
begin
  foreach t in array v_tables loop
    execute format(
      'create policy tenant_isolation on public.%I as restrictive for all to public '
      'using (company_id = (select app.current_company_id())) '
      'with check (company_id = (select app.current_company_id()))', t);
  end loop;
end $$;
```

`company_billing_profile` gets its policy in Task 7, where it is rebuilt.

- [ ] **Step 3: Apply and verify the count**

Expected: `24` from Step 1's query (25th arrives in Task 7).

- [ ] **Step 4: Verify Elena can still see her own company's data**

Sign in as Elena Torres and load `/dashboard/clients`. Expected: the same 22 clients as before. A blank screen means the resolver returned NULL; check `select public.current_company_state()`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0016_tenant_rls.sql
git commit -m "Scope every permission helper and add restrictive tenant isolation"
```

---

## Task 6: The SECURITY DEFINER surface (0017)

**Files:**
- Create: `supabase/migrations/0017_definer_surface.sql`

**Interfaces:**
- Consumes: Task 5's scoped helpers.
- Produces: company-scoped `next_quote_code`, `next_invoice_code`, `claim_staff_for_current_user`, `assert_owner_remains(uuid)`, five `admin_*` RPCs, `dev_seed.reseed_calendar(date, text, uuid)`.

SECURITY DEFINER bypasses RLS by definition, so the restrictive policies from Task 5 do **not** protect any of these. Each needs its own predicate.

**The five `admin_*` RPCs are live cross-tenant write primitives right now** — `0006_functions.sql:928-950` grants execute to `authenticated`, and each does `update public.staff ... where s.id = p_staff_id` with no company predicate. Any signed-in user of any tenant can POST a foreign staff uuid and deactivate another company's Owner.

- [ ] **Step 1: Write the failing test**

```sql
-- As a Demo-company session, target an SVM staff uuid. Must not succeed.
select public.admin_set_staff_status('<svm-staff-uuid>', 'Deactivated');
```

- [ ] **Step 2: Run it and confirm the vulnerability**

Expected before the fix: succeeds, returns void, and the SVM staff row is now Deactivated. Undo it.

- [ ] **Step 3: Write the migration**

```sql
-- Codes are per-company. The permission array must stay byte-identical to
-- quotes_insert in 0008 (warned at 0008:443) or a rep passes the policy and
-- then takes a hard 42501 from the minter halfway through a create.
create or replace function public.next_quote_code()
returns text language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_period text; v_value bigint; v_prefix text; v_tz text;
begin
  if not app.has_any_perm(array['proposals','pipeline'], true) then
    raise exception 'insufficient privilege to mint a quote number' using errcode = '42501';
  end if;

  v_company := app.current_company_id();
  if v_company is null then
    raise exception 'no active company for this session' using errcode = '42501';
  end if;

  select c.timezone, nullif(c.code_prefix,'') into v_tz, v_prefix
    from public.companies c where c.id = v_company;

  v_period := to_char(now() at time zone coalesce(v_tz,'America/Los_Angeles'), 'YYYY');

  insert into app.code_counters (company_id, scope, period, last_value)
  values (v_company, 'quote', v_period, 1)
  on conflict (company_id, scope, period)
    do update set last_value = app.code_counters.last_value + 1
  returning last_value into v_value;

  return coalesce(v_prefix,'QTE') || '-' || v_period || '-' || lpad(v_value::text, 4, '0');
end $$;
```

Apply the same shape to `next_invoice_code()` with `array['invoices','billing']` and an `INV` prefix.

```sql
-- Auto-claim runs on EVERY sign-in (src/server/auth-actions.ts:41) and
-- matched on verified email alone with no LIMIT, so it wrote every matching
-- row. Under multi-tenancy that means anyone who can create a staff row with
-- your work email in THEIR company grants themselves a membership link to
-- you. Claim at most one row, and never a second membership in a company the
-- caller already belongs to.
create or replace function public.claim_staff_for_current_user()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_email text; v_staff_id uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  select lower(u.email) into v_email
    from auth.users u where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then raise exception 'email not verified' using errcode = '28000'; end if;

  update public.staff s
     set auth_user_id = v_uid,
         status = case when s.status = 'Pending invite' then 'Active' else s.status end
   where s.id = (
     select s2.id from public.staff s2
      where lower(s2.work_email::text) = v_email
        and s2.auth_user_id is null
        and s2.status in ('Active','Pending invite')
        and not exists (select 1 from public.staff s3
                         where s3.auth_user_id = v_uid and s3.company_id = s2.company_id)
      order by s2.created_at, s2.id
      limit 1)
  returning s.id into v_staff_id;

  return v_staff_id;
end $$;

-- Was company-blind: company A could strand itself with zero Owners as long
-- as any other company had one.
create or replace function app.assert_owner_remains(p_company_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.staff s join public.roles r on r.id = s.role_id
     where r.slug = 'owner' and s.status = 'Active' and s.company_id = p_company_id
  ) then
    raise exception 'refusing to leave the company with no active Owner'
      using errcode = '23514';
  end if;
end $$;
```

For each of the five `admin_*` RPCs, scope the target lookup and the role lookup:

```sql
-- Pattern for every admin_* RPC. Two changes per function:
--
-- 1. The target must be resolved within the caller's company, and a foreign
--    uuid must answer "no such staff member", NOT "insufficient privilege".
--    The second answer is an existence oracle across the tenant wall.
--
-- 2. `select r.id into v_role_id from public.roles where r.slug = p_role_slug`
--    (0006_functions.sql:793 and :885) becomes multi-row once roles are
--    per-company. Without STRICT it silently takes an arbitrary row, so it
--    could assign another company's role id.
update public.staff s
   set status = p_status
 where s.id = p_staff_id
   and s.company_id = app.current_company_id();
if not found then
  raise exception 'no such staff member: %', p_staff_id using errcode = '22023';
end if;

select r.id into strict v_role_id
  from public.roles r
 where r.slug = p_role_slug
   and r.company_id = app.current_company_id();
```

Also scope `dev_seed.reseed_calendar` with a `p_company_id uuid` parameter; it currently updates `where is_seed` across every tenant.

- [ ] **Step 4: Re-run the Step 1 test**

Expected: `ERROR: no such staff member: <uuid>` with SQLSTATE `22023`. Confirm the SVM row is untouched.

- [ ] **Step 5: Verify quote minting still works end to end**

As Morgan in Demo, create a quote on DEAL-3001. Expected: a `QTE-2026-NNNN` code, no 42501.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0017_definer_surface.sql
git commit -m "Close the cross-tenant holes in every SECURITY DEFINER RPC"
```

---

## Task 7: Storage, billing profile, grants (0018)

**Files:**
- Create: `supabase/migrations/0018_storage_grants.sql`
- Modify: `scripts/seed-documents.ts`

**Interfaces:**
- Consumes: Task 5's helpers.
- Produces: company-prefixed storage paths; three rewritten `storage.objects` policies; `company_billing_profile` keyed on `company_id`; re-issued grants.

Storage paths carry no tenant segment today (`clients/{id}/…`, `company/shared/…`), so every tenant writes into the same `company/shared/` folder.

- [ ] **Step 1: Write the failing test**

```sql
-- As a Demo session, try to write bytes under an SVM path prefix.
insert into storage.objects (bucket_id, name, owner)
values ('documents', '<svm-company-uuid>/clients/x/y.pdf', auth.uid());
```

Expected before: succeeds. After: denied by policy.

- [ ] **Step 2: Write the migration**

```sql
-- company_billing_profile: the PK IS the company. That preserves the
-- singleton semantics structurally, which is what `check (id = 1)` bought,
-- without an extra surrogate column and one more way to get it wrong.
alter table public.company_billing_profile drop constraint company_billing_profile_singleton;
alter table public.company_billing_profile drop constraint company_billing_profile_pkey;
alter table public.company_billing_profile add column company_id uuid;
update public.company_billing_profile
   set company_id = (select id from public.companies where slug = 'demo-movers')
 where company_id is null;
alter table public.company_billing_profile alter column company_id set not null;
alter table public.company_billing_profile drop column id;
alter table public.company_billing_profile
  add constraint company_billing_profile_pkey primary key (company_id),
  add constraint company_billing_profile_company_fkey
    foreign key (company_id) references public.companies(id) on delete cascade;
alter table public.company_billing_profile
  alter column company_id set default app.current_company_id();

create policy tenant_isolation on public.company_billing_profile
  as restrictive for all to public
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

-- Storage: add the tenant segment to all three policies. The clients/deals
-- branches already resolve their uuid against public.clients / public.deals,
-- which runs AS THE CALLER with RLS applied, so those became tenant-safe for
-- free the moment those tables were scoped. The staff branch validates
-- nothing about its uuid, so it gets the same treatment.
drop policy documents_object_insert on storage.objects;
create policy documents_object_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select app.current_company_id())::text
    and (select app.is_active_writer())
  );
```

Rewrite `documents_object_select` and `documents_object_update` the same way, keeping their existing `exists (... public.documents ...)` joins and adding the prefix check.

Then re-issue grants, including the four views — `0009`'s `revoke all on all tables in schema public` includes views, a trap already documented at `0009_grants.sql:190`.

- [ ] **Step 3: Repath the seed and re-run it**

Change the path convention in `scripts/seed-documents.ts` to `{company_id}/{scope}/{id}/{document_id}-{slug}.{ext}`. Pre-production, re-running the seed is the whole data migration.

```bash
SUPABASE_SECRET_KEY=... SUPABASE_DB_URL=... npm run seed:documents
```

- [ ] **Step 4: Re-run the Step 1 test**

Expected: policy denies the cross-prefix insert.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0018_storage_grants.sql scripts/seed-documents.ts
git commit -m "Give storage paths a tenant segment and rekey the billing profile"
```

---

## Task 8: Company provisioning and SVM (0019)

**Files:**
- Create: `supabase/migrations/0019_provisioning.sql`

**Interfaces:**
- Consumes: everything prior.
- Produces: `public.create_company(p_name text, p_slug text, p_owner_email text, p_owner_name text) returns uuid`; the SVM company row.

**`create_company()` cannot use "the caller".** It is granted to `service_role`, where `auth.uid()` is NULL. It takes an explicit owner email and creates a `Pending invite` staff row that `claim_staff_for_current_user()` binds on first sign-in.

**It must provision reference data, not just roles.** A company with zero `warehouse_locations`, no default `rate_cards` and no default `tax_rates` breaks immediately: `quote-actions.ts:90-91` needs both defaults, and `vaults_expanded` **inner** joins `warehouse_locations`.

- [ ] **Step 1: Write the failing test**

```sql
select public.create_company('Test Co','test-co','owner@test.invalid','Test Owner');
```

Expected before: `ERROR: function public.create_company(...) does not exist`.

- [ ] **Step 2: Write the migration**

```sql
create or replace function public.create_company(
  p_name text, p_slug text, p_owner_email text, p_owner_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_owner_role uuid; v_loc uuid; v_card uuid;
begin
  insert into public.companies (slug, name) values (p_slug, p_name) returning id into v_company;

  -- System roles, per company. roles/role_permission_sets have SELECT-only
  -- policies by design (0008:158-168), so this is the only path that creates them.
  insert into public.roles (company_id, slug, name, access_level, is_system, status, group_label)
  values (v_company,'owner','Owner','Full',true,'Active','System'),
         (v_company,'admin','Admin','Full',false,'Active','System'),
         (v_company,'read-only','Read-only','Read only',true,'Active','System');
  select id into strict v_owner_role from public.roles
   where company_id = v_company and slug = 'owner';

  -- Reference data. Without these the app is broken on first load.
  insert into public.warehouse_locations (company_id, slug, name, sort_order, is_active)
  values (v_company,'main','Main Warehouse',1,true) returning id into v_loc;

  insert into public.rate_cards (company_id, code, name, is_default)
  values (v_company,'STD','Standard Rate Card',true) returning id into v_card;

  insert into public.crew_rates (company_id, rate_card_id, crew_size, hourly_rate,
                                 min_hours, ot_threshold, ot_multiplier)
  values (v_company, v_card, 2, 150.00, 3, 8, 1.5),
         (v_company, v_card, 3, 210.00, 3, 8, 1.5),
         (v_company, v_card, 4, 270.00, 3, 8, 1.5);

  insert into public.tax_rates (company_id, code, name, rate_percent, is_default)
  values (v_company,'NONE','No Tax',0.00,true);

  insert into public.document_folders (company_id, slug, name)
  values (v_company,'general','General');

  insert into public.company_billing_profile (company_id, name, email, phone, website,
    address_line1, address_line2, tax_id, payment_account_name, routing_number)
  values (v_company, p_name, '', '', '', '', '', '', '', '');

  -- Pending invite: claim_staff_for_current_user() binds it on first sign-in.
  insert into public.staff (company_id, full_name, work_email, role_id, team, status)
  values (v_company, p_owner_name, p_owner_email::extensions.citext,
          v_owner_role, 'Leadership', 'Pending invite');

  -- Prime counters so the first mint is 0001.
  insert into app.code_counters (company_id, scope, period, last_value)
  values (v_company,'quote',  to_char(now() at time zone 'America/Los_Angeles','YYYY'), 0),
         (v_company,'invoice',to_char(now() at time zone 'America/Los_Angeles','YYYY'), 0);

  return v_company;
end $$;

revoke all on function public.create_company(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_company(text,text,text,text) to service_role;

-- Demo's counter must start from the existing high-water mark or it re-mints
-- QTE-2026-0001, which exists and now collides with the per-company unique.
update app.code_counters cc
   set last_value = greatest(cc.last_value, coalesce((
     select max(substring(q.code from '(\d+)$')::bigint)
       from public.quotes q where q.company_id = cc.company_id), 0))
 where cc.scope = 'quote';

select public.create_company(
  'Silicon Valley Moving & Storage', 'svm',
  'joey@siliconvalleymoving.com', 'Joey Childs');
```

- [ ] **Step 3: Apply and verify SVM provisioned completely**

```sql
select c.name,
  (select count(*) from public.roles r where r.company_id=c.id) as roles,
  (select count(*) from public.staff s where s.company_id=c.id) as staff,
  (select count(*) from public.rate_cards rc where rc.company_id=c.id and rc.is_default) as default_card,
  (select count(*) from public.tax_rates t where t.company_id=c.id and t.is_default) as default_tax,
  (select count(*) from public.warehouse_locations w where w.company_id=c.id) as locations
from public.companies c where c.slug='svm';
```

Expected: `roles=3, staff=1, default_card=1, default_tax=1, locations=1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0019_provisioning.sql
git commit -m "Add company provisioning and create the SVM tenant"
```

---

## Task 9: The tenancy guard (0020) and 9999 updates

**Files:**
- Create: `supabase/migrations/0020_tenancy_guard.sql`
- Modify: `supabase/migrations/9999_security_guard.sql`

**Interfaces:**
- Produces: five structural assertions, in the same `do $$` style as 9999.

These prove the **shape**. Task 10 proves the **semantics**. Neither alone is trustworthy.

- [ ] **Step 1: Update 9999 first**

Change check 3's `v_n <> 27` to `29`. Add `companies|SELECT` and `user_active_company|SELECT` to check 7's `v_expected` array.

- [ ] **Step 2: Run 9999 and confirm it passes again**

Expected: `NOTICE: security guard: all 12 checks passed.`

- [ ] **Step 3: Write 0020**

```sql
do $$
declare
  v_bad text;
  v_exempt_tables text[] := array['companies','permission_sets','user_active_company'];
  v_exempt_uniques text[] := array['documents_storage_path_key','companies_slug_key'];
  v_canonical text := '(company_id = ( SELECT app.current_company_id() AS current_company_id))';
begin
  -- 1. Every non-exempt public table has company_id NOT NULL.
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'
    and not (c.relname = any(v_exempt_tables))
    and not exists (select 1 from pg_attribute a
                     where a.attrelid=c.oid and a.attname='company_id'
                       and a.attnotnull and not a.attisdropped);
  if v_bad is not null then
    raise exception 'tenancy check 1: tables lacking NOT NULL company_id: %', v_bad;
  end if;

  -- 2. Every public->public FK includes company_id.
  select string_agg(c.conname, ', ') into v_bad
  from pg_constraint c
  join pg_class rel on rel.oid=c.conrelid
  join pg_class frel on frel.oid=c.confrelid
  where c.contype='f' and rel.relnamespace='public'::regnamespace
    and frel.relnamespace='public'::regnamespace
    and frel.relname not in ('companies','permission_sets')
    and not exists (select 1 from unnest(c.conkey) k
                    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k
                    where a.attname='company_id');
  if v_bad is not null then
    raise exception 'tenancy check 2: FKs missing company_id: %', v_bad;
  end if;

  -- 3. Every unique INDEX on a tenant table includes company_id.
  --    Reads pg_index, not pg_constraint: the two partial default indexes
  --    are not constraints and were missed by a pg_constraint-only sweep.
  select string_agg(ic.relname, ', ') into v_bad
  from pg_index i
  join pg_class tc on tc.oid=i.indrelid
  join pg_class ic on ic.oid=i.indexrelid
  where i.indisunique and tc.relnamespace='public'::regnamespace
    and not (tc.relname = any(v_exempt_tables))
    and not (ic.relname = any(v_exempt_uniques))
    and not i.indisprimary
    and not exists (select 1 from unnest(i.indkey::int[]) k
                    join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k
                    where a.attname='company_id');
  if v_bad is not null then
    raise exception 'tenancy check 3: unique indexes missing company_id: %', v_bad;
  end if;

  -- 4. Exactly one RESTRICTIVE tenant_isolation policy with the canonical
  --    body, plus at least one permissive policy. Restrictive alone denies
  --    everything, so both halves matter.
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'
    and not (c.relname = any(v_exempt_tables))
    and not exists (select 1 from pg_policy p
                     where p.polrelid=c.oid and not p.polpermissive
                       and p.polname='tenant_isolation'
                       and pg_get_expr(p.polqual, p.polrelid) = v_canonical);
  if v_bad is not null then
    raise exception 'tenancy check 4: missing canonical tenant policy: %', v_bad;
  end if;

  -- 5. Every tenant table has the company_id immutability trigger.
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'
    and not (c.relname = any(v_exempt_tables))
    and not exists (select 1 from pg_trigger tg
                     where tg.tgrelid=c.oid and not tg.tgisinternal
                       and tg.tgfoid='app.tg_company_id_immutable()'::regprocedure);
  if v_bad is not null then
    raise exception 'tenancy check 5: missing immutability trigger: %', v_bad;
  end if;

  raise notice 'tenancy guard: all 5 checks passed.';
end $$;
```

- [ ] **Step 4: Run it**

Expected: `NOTICE: tenancy guard: all 5 checks passed.`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0020_tenancy_guard.sql supabase/migrations/9999_security_guard.sql
git commit -m "Add structural tenancy assertions and update the security guard"
```

---

## Task 10: The partition test

**Files:**
- Create: `scripts/verify-isolation.ts`

**Interfaces:**
- Consumes: a populated Demo, a populated SVM, and a third company C with one member.

The invariant is stronger than "A cannot see B's rows":

> For every tenant table, the row sets visible to each persona **partition** the table. `count(A) + count(B) + count(C) = count(service_role)` **and** every pairwise intersection is empty.

The sum condition is what a one-directional leak test misses: it catches **orphans**, rows whose `company_id` resolves to nobody, which present as the silent-zero-rows symptom this repo names as its hardest. The third company exists so a bug of the form `using (company_id is not null)` cannot pass by coincidence of equal counts.

- [ ] **Step 1: Seed a third company with one member**

```sql
select public.create_company('Third Co','third-co','third@test.invalid','Third Owner');
```

- [ ] **Step 2: Write the impersonation harness**

`SET ROLE` is essential — `postgres` owns the tables and bypasses RLS.

```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<auth_user_uuid>","role":"authenticated"}';
  -- loop pg_class via dynamic SQL, collect count(*) and array_agg(id) per table
rollback;
```

- [ ] **Step 3: Write the assertions**

Iterate `pg_class` rather than a hardcoded list, so a table added later is covered automatically. Assert per table: pairwise intersections empty, counts sum to the service-role total. Plus:

- Cross-tenant UPDATE affects zero rows.
- Setting `company_id` to another tenant raises `23514` (the trigger).
- Creating an SVM deal pointing at a Demo client raises `23503` (the composite FK, not the policy).
- A user with write permission in Demo and read-only in SVM cannot write in SVM.
- `current_company_state()` returns `'no-membership'` for a zero-membership user.

- [ ] **Step 4: Run it**

```bash
npx ts-node -P tsconfig.scripts.json scripts/verify-isolation.ts
```

Expected: every table partitions cleanly.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-isolation.ts
git commit -m "Add the cross-tenant partition test"
```

---

## Task 11: Break every guard on purpose

**Files:**
- Modify: `supabase/migrations/0020_tenancy_guard.sql` (append the break list to its footer, matching 9999's own convention)

A guard that has never failed is not a guard. Run each, watch it fire, undo it, watch the suite pass.

- [ ] **Step 1: Break the tenant policy**

`drop policy tenant_isolation on public.deals;` → must fire tenancy check 4 **and** the partition sum. Restore.

- [ ] **Step 2: Break immutability**

As service_role, `update public.deals set company_id = '<C>' where id = ...` → must raise `23514`. If it succeeds, the trigger is missing.

- [ ] **Step 3: Create an orphan**

Disable the trigger, set a `company_id` to a random uuid, re-enable → partition **sum comes up short**. This is the case a leak-only test cannot see. Restore.

- [ ] **Step 4: Break the composite FK**

Insert a `quote_line_items` row whose `company_id` differs from its quote's, as service_role → must raise `23503`.

- [ ] **Step 5: Break the admin RPC scoping**

As a Demo session, `select public.admin_set_staff_status('<svm staff uuid>','Deactivated')` → must raise `no such staff member`. Anything else means Task 6 is not fixed.

- [ ] **Step 6: Break a unique**

`alter table public.clients drop constraint clients_company_code_key, add constraint clients_code_key unique (code);` → must fire tenancy check 3. Restore.

- [ ] **Step 7: Record which check caught what, and commit**

```bash
git add supabase/migrations/0020_tenancy_guard.sql
git commit -m "Record the break-on-purpose list for the tenancy guard"
```

---

## Task 12: Generate types

**Files:**
- Create: `src/lib/supabase/database.types.ts`
- Modify: `package.json`, `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`

Every query module hand-writes row shapes with `as any` and `as unknown as X[]`, so a 26-table change gets zero compile-time help. This does not catch a forgotten filter (RLS does that) but it catches every column-name and shape error.

- [ ] **Step 1: Add the script**

```json
"gen:types": "supabase gen types typescript --project-id jannhzvqrsumtscidtkx > src/lib/supabase/database.types.ts"
```

- [ ] **Step 2: Generate**

```bash
npm run gen:types
```

- [ ] **Step 3: Thread `Database` through both factories**

`createServerClient<Database>(...)` in `server.ts`, `createBrowserClient<Database>(...)` in `client.ts`.

- [ ] **Step 4: Build**

```bash
npm run build
```

Fix any surfaced shape errors. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add package.json src/lib/supabase/
git commit -m "Generate and wire Supabase types"
```

---

## Task 13: Application layer

**Files:**
- Modify: `src/lib/supabase/auth.ts`, `src/app/(main)/dashboard/layout.tsx`, `src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx`, `src/app/(main)/dashboard/clients/[id]/_components/invoice/data.ts`

**Interfaces:**
- Consumes: `public.current_company_state()` from Task 1.
- Produces: `getCurrentCompany()` in `auth.ts`.

Query modules need **no** `.eq("company_id", ...)`. RLS is the enforcement; duplicating it in ~15 call sites is drift waiting to happen.

Preserve the `.eq("code", code).maybeSingle()` calls in `clients.ts:113`, `deals.ts:92`, `quotes.ts:176` deliberately. Now that `code` is unique per company rather than globally, they are live cross-tenant assertions: if isolation ever breaks they throw `PGRST116` instead of quietly rendering another tenant's client. Do not "fix" them to `.limit(1)`.

- [ ] **Step 1: Add `getCurrentCompany()` to `auth.ts`**

```ts
export const getCurrentCompany = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_company_state").single();
  if (error || !data) return null;
  return data as { state: string; company_id: string | null; company_name: string | null };
});
```

- [ ] **Step 2: Add `company_id` to `getCurrentStaff()`'s select list**

- [ ] **Step 3: Branch the layout on the state**

`'no-membership'` and `'revoked-selection'` route to `/unauthorized` with distinct copy. A blank dashboard is the failure mode this whole design is trying to avoid.

- [ ] **Step 4: Read the company name in the sidebar**

Replace `{APP_CONFIG.name}` in `app-sidebar.tsx` with the company name threaded from the layout. `APP_CONFIG` stays for page metadata.

- [ ] **Step 5: Read the invoice From block from the database**

Replace the hardcoded `movingCompanyFromDetails` literal with a `company_billing_profile` read.

- [ ] **Step 6: Build and verify as Elena**

```bash
npm run build
```

Then sign in as Elena Torres and confirm the sidebar shows "Demo Movers" and clients still load.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "Resolve the company from the session and show it in the shell"
```

---

## Task 14: The SVM owner account

**Files:**
- Create: `scripts/seed-svm-owner.ts`

Modelled on `scripts/seed-auth-users.ts`. The password comes from the environment and is never committed, hardcoded, or written to a tracked file.

The password shared in chat should be rotated after first login, since it now exists in a conversation transcript.

- [ ] **Step 1: Write the script**

`auth.admin.createUser({ email, password, email_confirm: true })` reading `SVM_OWNER_PASSWORD`, minimum 12 characters, throwing if absent. `email_confirm: true` is required — `claim_staff_for_current_user()` rejects an unverified email.

- [ ] **Step 2: Run it**

```bash
SVM_OWNER_PASSWORD='...' SUPABASE_SECRET_KEY=... SUPABASE_DB_URL=... npx ts-node -P tsconfig.scripts.json scripts/seed-svm-owner.ts
```

- [ ] **Step 3: Sign in as joey@siliconvalleymoving.com**

Expected: the claim binds the Pending invite staff row, status flips to Active, sidebar reads "Silicon Valley Moving & Storage", and every list is empty because SVM is a clean tenant.

- [ ] **Step 4: Re-run the partition test with SVM populated by real use**

- [ ] **Step 5: Final verification sweep**

```bash
npm run build
```

Run `9999_security_guard.sql`, `0020_tenancy_guard.sql`, `verify-isolation.ts`, and `get_advisors` for security and performance.

- [ ] **Step 6: Update the handoff and commit**

```bash
git add scripts/seed-svm-owner.ts docs/HANDOFF.md docs/MULTI-TENANCY-PLAN.md
git commit -m "Create the SVM owner account and record the multi-tenancy state"
```

---

## Self-Review

**Spec coverage.** Every section of `docs/MULTI-TENANCY-PLAN.md` maps to a task: tenant identity and resolver → Task 1; company scoping → Tasks 2-3; insert safety → Task 3 (defaults + trigger); composite FKs and the proven SET NULL form → Task 4; policy shape → Task 5 (revised to restrictive); helper functions → Task 5; provisioning → Task 8; guard updates → Task 9; verification → Tasks 10-11; types → Task 12; app layer → Task 13; SVM account → Task 14.

**Four design changes from the approved spec,** each because review found a defect:
1. Tenancy is a separate RESTRICTIVE policy; `0008` is not edited. Avoids 30 hand-edits into OR-shaped predicates.
2. `documents_storage_path_key` stays **global**. The spec had it going composite, which opens a byte-level cross-tenant file read.
3. Added the `company_id` immutability trigger. `service_role` bypasses RLS; `with check` alone does not constrain it.
4. `create_company()` provisions reference data. Roles alone produces a tenant whose quote builder is dead on arrival.

**Deferred, not dropped:** splitting `routing_number` out of `company_billing_profile` (D21). Task 7 rebuilds that table, so it is cheap to fold in, but it is a separate concern and is not in scope.

**Type consistency check.** `app.current_company_id()` returns `uuid` and is called identically in Tasks 1, 3, 5, 6, 7, 8. `public.current_company_state()` returns `table(state text, company_id uuid, company_name text)` in Task 1 and is consumed with those exact field names in Task 13. `app.assert_owner_remains(p_company_id uuid)` gains its parameter in Task 6 and has no other callers. `app.tg_company_id_immutable()` is defined in Task 1, attached in Task 3, and asserted by name in Task 9.

**Known gap the executor must handle:** `0010_seed.sql` has ~12 `on conflict` targets that go stale in Task 4 (`(code)`, `(slug)`, `(work_email)`, `(storage_path)`, `(rate_card_id, crew_size)`, `(scope, period)`). This plan backfills rather than re-running the seed, so it is not a blocker, and step 13 of that file was already not rerunnable. After Task 4, reseeding from scratch means dropping and recreating the database.
