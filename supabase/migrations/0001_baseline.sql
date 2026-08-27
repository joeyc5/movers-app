-- =====================================================================
-- 0001_baseline.sql
-- Schemas, extensions, default-privilege lockdown, predicate helpers,
-- and the shared updated_at trigger function.
--
-- Applies before any table exists. Everything here is infrastructure.
--
-- SCOPE NOTE: this file closes the DEFAULT-OPEN door measured on this
-- project (pg_default_acl grants anon/authenticated arwdDxtm on every
-- new public table). It does NOT contain the per-table grants or the
-- RLS policies; those land in the policy migration. Tables created in
-- 0002..0005 enable RLS in their own file (D12), so between this file
-- and the policy migration every table is deny-by-default rather than
-- world-readable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Function bodies are not validated at CREATE time in this file.
--
-- D2 puts the four predicate helpers in `app` here in 0001, but they
-- read public.staff / public.roles / public.permission_sets, which are
-- created in 0002. A `language sql` body is name-resolved at creation
-- unless this GUC is off. Nothing calls the helpers until the policy
-- migration, by which point the tables exist.
-- ---------------------------------------------------------------------
set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- Schemas
-- ---------------------------------------------------------------------

-- Predicate helpers and internal machinery. Deliberately NOT exposed to
-- PostgREST: nothing in `app` is ever a callable RPC. Caller-facing RPCs
-- live in `public` (D2).
create schema if not exists app;

-- Demo/seed helpers. Gets no grants at all, so it is unreachable from
-- the API no matter what policies exist. Droppable wholesale at launch.
create schema if not exists dev_seed;

comment on schema app is
  'Internal predicate helpers and trigger functions. Not exposed to PostgREST. Caller-facing RPCs live in public (D2).';
comment on schema dev_seed is
  'Development seed helpers. No grants to anon or authenticated; callable only with the secret key or as postgres.';

-- ---------------------------------------------------------------------
-- Extensions
--
-- Both install WITH SCHEMA extensions. Every reference to a type or
-- operator class from either one is schema-qualified at the point of
-- use (`extensions.citext`, `extensions.gin_trgm_ops`) because the
-- search_path in effect while a migration is applied is not pinned (D14).
-- ---------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext  with schema extensions;

-- ---------------------------------------------------------------------
-- Default-privilege lockdown
--
-- MEASURED on this project: pg_default_acl for (defaclrole=postgres,
-- nsp=public, objtype=r) grants anon AND authenticated arwdDxtm, and
-- migrations run as postgres. A table created and left alone is readable
-- by the publishable key that ships in the browser bundle.
--
-- ALTER DEFAULT PRIVILEGES affects FUTURE objects only, so existing
-- objects get their own REVOKE below.
--
-- KNOWN GAP, for the security guard to catch rather than prevent: a
-- second pg_default_acl row exists for defaclrole = supabase_admin on
-- schema public. A postgres-issued ALTER DEFAULT PRIVILEGES does not
-- touch it, and ALTER DEFAULT PRIVILEGES reports success even when it
-- silently no-ops against a different defaclrole. The guard migration
-- must assert pg_default_acl holds no anon/authenticated entry in
-- public, as its FIRST check (D13).
-- ---------------------------------------------------------------------
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

alter default privileges in schema app revoke all on tables    from anon, authenticated;
alter default privileges in schema app revoke all on sequences from anon, authenticated;
alter default privileges in schema app revoke all on functions from anon, authenticated;

alter default privileges in schema dev_seed revoke all on tables    from anon, authenticated;
alter default privileges in schema dev_seed revoke all on sequences from anon, authenticated;
alter default privileges in schema dev_seed revoke all on functions from anon, authenticated;

-- Existing objects. public is empty today; this is belt and braces.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- ---------------------------------------------------------------------
-- Schema usage
--
-- There is no unauthenticated surface in this app. Sign-in is GoTrue
-- (/auth/v1/*), not PostgREST, so anon needs nothing in public.
--
-- REVOKING FROM `anon` ALONE IS INERT, AND IT REPORTS SUCCESS.
--
-- Measured on this project. The schema ACL is
--   {pg_database_owner=UC/pg_database_owner,
--    =U/pg_database_owner,          <-- the grant to the PUBLIC pseudo-role
--    postgres=U, anon=U, authenticated=U, service_role=U}
-- so `revoke usage on schema public from anon` removes the `anon=U`
-- entry and anon KEEPS USAGE through `=U`, which every role inherits.
-- Measured on a throwaway schema with the identical ACL shape:
--   revoke from anon   -> has_schema_privilege('anon', ..., 'USAGE') = true
--   revoke from public -> false
--
-- Nothing is exposed by this today, because RLS with zero policies
-- denies and no table carries a grant. It is fixed anyway: the day
-- someone adds a table and forgets `enable row level security`, this is
-- the layer that decides whether the publishable key in the browser
-- bundle can read it. postgres IS a member of pg_database_owner, so the
-- revoke below is permitted. 9999_security_guard.sql asserts the
-- OUTCOME (`anon does not hold USAGE`) rather than the presence of these
-- lines, because these lines are exactly the shape that lies.
--
-- THE GRANT-BACK IS NOT OPTIONAL. Only six principals hold USAGE
-- explicitly (pg_database_owner, postgres, anon, authenticated,
-- service_role, and PUBLIC itself). Every other platform role holds it
-- ONLY through `=U`, and revoking from PUBLIC takes it from all of them
-- at once. `authenticator` matters most: it is the role PostgREST
-- connects as before `SET ROLE authenticated`, it is NOINHERIT so
-- membership in `authenticated` does not give it back, and it is what
-- introspects the schema to build the API cache. `dashboard_user` is the
-- Supabase SQL editor and table editor. Fixing the anon hole by
-- decapitating PostgREST is not a fix.
--
-- Guarded by a pg_roles lookup so a project missing one of these roles
-- gets a skipped grant rather than an aborted migration.
-- ---------------------------------------------------------------------
revoke usage on schema public from anon;
revoke usage on schema public from public;
grant  usage on schema public to   authenticated;

do $$
declare
  v_role text;
begin
  foreach v_role in array array[
    'authenticator',              -- PostgREST connection + schema cache
    'dashboard_user',             -- Supabase SQL editor / table editor
    'supabase_auth_admin',
    'supabase_storage_admin',
    'supabase_realtime_admin',
    'supabase_replication_admin',
    'supabase_read_only_user',
    'pgbouncer'
  ]
  loop
    if exists (select 1 from pg_roles where rolname = v_role) then
      execute format('grant usage on schema public to %I', v_role);
    end if;
  end loop;
end
$$;

revoke all   on schema app from public, anon, authenticated;
grant  usage on schema app to   authenticated;

revoke all on schema dev_seed from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Predicate helpers (D2)
--
-- These four stay in `app`. They gate mostly WRITES: under D1 every
-- operational table is readable by any ACTIVE staff member, because a
-- permission-gated READ presents as an empty screen with no error and
-- the app has no route gating and no "you do not have access" state.
-- Read stays genuinely restricted only for PII, money, and per-row
-- document visibility.
--
-- SECURITY DEFINER is load-bearing twice: it bypasses RLS, which is what
-- stops a policy ON staff that reads staff from recursing, and it lets
-- one function serve every table.
--
-- `set search_path = ''` means every reference inside must be schema-
-- qualified, including citext comparisons (the citext operators live in
-- `extensions` and will not resolve bare).
--
-- PERFORMANCE CONTRACT for whoever writes the policies: every call to
-- these from a policy predicate must be wrapped as `(select app.foo())`
-- so it plans as an InitPlan instead of a per-row Filter. Measured on
-- 20,000 rows: 506 ms unwrapped, 3.7 ms wrapped. The rule applies to
-- every function in a predicate, not just auth.uid().
-- ---------------------------------------------------------------------

create or replace function app.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.staff s
  where s.auth_user_id = (select auth.uid())
    and s.status = 'Active'
$$;

comment on function app.current_staff_id() is
  'The staff row for the current session, or NULL. Gates on status = Active: staff.status is an APPLICATION status independent of auth, so a Deactivated person with a live session still authenticates.';

create or replace function app.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    where s.auth_user_id = (select auth.uid())
      and s.status = 'Active'
  )
$$;

comment on function app.is_active_staff() is
  'True when the caller is an active staff member. Under D1 this is the SELECT predicate for every operational table.';

-- Raises on an unknown slug rather than returning false. A typo'd set
-- name would otherwise mean "zero rows, no error", which is the hardest
-- symptom in this system to diagnose.
create or replace function app.has_any_perm(p_sets text[], p_write boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_unknown text;
begin
  select string_agg(x, ', ') into v_unknown
  from unnest(p_sets) x
  where not exists (
    select 1 from public.permission_sets ps where ps.slug = x
  );

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
      -- access_level 'Read only' can never write, whatever sets it holds.
      and (not p_write or r.access_level <> 'Read only')
      and ( r.access_level = 'Full'
            or exists (
              select 1
              from public.role_permission_sets rp
              join public.permission_sets ps on ps.id = rp.permission_set_id
              where rp.role_id = r.id
                and ps.slug = any(p_sets)
            )
          )
  );
end
$$;

comment on function app.has_any_perm(text[], boolean) is
  'True when the caller holds ANY of the named permission set slugs (or access_level Full). p_write additionally excludes Read only roles. Raises 22023 on an unknown slug rather than silently returning false.';

create or replace function app.has_perm(p_set text, p_write boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_any_perm(array[p_set], p_write)
$$;

comment on function app.has_perm(text, boolean) is
  'Single-slug convenience wrapper over app.has_any_perm.';

-- Explicit grants only. The ALTER DEFAULT PRIVILEGES above does not
-- remove EXECUTE from the PUBLIC pseudo-role, and PUBLIC EXECUTE on a
-- SECURITY DEFINER function is the classic escalation vector.
revoke all on function
    app.current_staff_id(),
    app.is_active_staff(),
    app.has_any_perm(text[], boolean),
    app.has_perm(text, boolean)
  from public, anon, authenticated;

grant execute on function
    app.current_staff_id(),
    app.is_active_staff(),
    app.has_any_perm(text[], boolean),
    app.has_perm(text, boolean)
  to authenticated;

-- ---------------------------------------------------------------------
-- Shared updated_at trigger
--
-- Postgres has no auto-update for this column. Attached as
-- `trg_<table>_touch BEFORE UPDATE` on every table carrying updated_at.
-- ---------------------------------------------------------------------
create or replace function app.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

comment on function app.tg_set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at. Attach as trg_<table>_touch on every table with an updated_at column.';

-- ---------------------------------------------------------------------
-- Conventions the rest of the migrations rely on, stated once
--
-- MONEY: numeric(12,2) on every currency column, everywhere. No float,
--   no integer cents. Arithmetic happens in Postgres.
--
-- UNIONS: text + CHECK, never a Postgres enum, and the CHECK literals
--   are the EXACT display strings from the TS source. Two reasons that
--   matter here: a CHECK is DROP/ADD CONSTRAINT inside one ordinary
--   migration where ALTER TYPE ... ADD VALUE cannot be used in the same
--   transaction that references the new value; and eleven UI sites
--   bare-index a style map then immediately read a property, so a
--   snake_case label is a TypeError at render, not a missing badge.
--
-- IDS: uuid PK default gen_random_uuid(), plus `code`/`slug` text with a
--   REAL UNIQUE CONSTRAINT (never a partial index) so it is a legal
--   on_conflict target and /dashboard/clients/CLT-1001 still resolves.
--
-- DATES: `date` for calendar days, `timestamptz` for instants. No column
--   anywhere stores a pre-formatted display string.
--
-- is_seed (D11): every table the seed populates carries
--   `is_seed boolean not null default false`. Reseed and demo-reset
--   helpers scope their DELETE/UPDATE on this flag, never on a code
--   prefix -- app-created rows mint codes in the same namespace, so a
--   real JOB-4007 sits inside `code LIKE 'JOB-4%'`. This flag cannot be
--   backfilled once real rows exist, which is why it lands now on every
--   seeded table rather than only on the two the calendar reseeder
--   touches today.
-- ---------------------------------------------------------------------

reset check_function_bodies;
