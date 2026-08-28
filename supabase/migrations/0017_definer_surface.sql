set check_function_bodies = off;

-- =====================================================================
-- 0017_definer_surface.sql
--
-- SECURITY DEFINER bypasses RLS by definition: these functions run as
-- their owner (postgres), and postgres owns every table in this
-- database, so the RESTRICTIVE tenant_isolation policies from 0016
-- never fire for them regardless of company_id or FORCE ROW LEVEL
-- SECURITY. Every function touched below carries its own explicit
-- company predicate as a result. Where one is not needed, the reason
-- is written down, not left implicit -- see the summary at the foot of
-- this file.
--
-- Two classes of change:
--
--   A. Five `admin_*` RPCs (0006_functions.sql:928-950) are live
--      cross-tenant write primitives RIGHT NOW: each resolves its
--      target with `where s.id = p_staff_id`, no company_id term.
--      `authenticated` holds EXECUTE. Verified against this project
--      before writing this migration (task-6-report.md has the
--      transcript): a Demo Movers Admin called
--      `admin_set_staff_status` against a staff id in a second,
--      unrelated company and it succeeded, no error, target
--      deactivated.
--
--   B. `app.code_counters`'s primary key became (company_id, scope,
--      period) in 0015, which no longer matches the `on conflict
--      (scope, period)` inside `next_quote_code()` /
--      `next_invoice_code()`. Both currently fail 42P10 -- also
--      reproduced before writing this migration. The rewrite mints
--      against the caller's own company and the new three-column key.
--
-- A third, narrower fix: `claim_staff_for_current_user()` matches on
-- verified email with no LIMIT, so one address invited at two
-- companies would claim both rows in the same statement. And
-- `app.assert_owner_remains()` asked whether an active Owner exists
-- ANYWHERE, so company A's Owner would satisfy company B's check.
-- =====================================================================


-- =====================================================================
-- A. CODE MINTING, rewritten against the three-column key.
--
-- The permission array in each minter must stay byte-identical to the
-- matching RLS policy (quotes_insert / invoices_insert, 0008:443 and
-- :517): if the two ever diverge, a caller passes the policy, gets a
-- row started, and then takes a 42501 from the minter halfway through
-- a create. Copied by hand from 0008, not retyped independently.
-- =====================================================================
create or replace function public.next_quote_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_period  text;
  v_value   bigint;
  v_prefix  text;
  v_tz      text;
begin
  if not app.has_any_perm(array['proposals','pipeline'], true) then
    raise exception 'insufficient privilege to mint a quote number'
      using errcode = '42501';
  end if;

  v_company := app.current_company_id();
  if v_company is null then
    raise exception 'no active company for this session' using errcode = '42501';
  end if;

  select c.timezone, nullif(c.code_prefix, '') into v_tz, v_prefix
    from public.companies c where c.id = v_company;

  v_period := to_char(now() at time zone coalesce(v_tz, 'America/Los_Angeles'), 'YYYY');

  insert into app.code_counters (company_id, scope, period, last_value)
  values (v_company, 'quote', v_period, 1)
  on conflict (company_id, scope, period)
    do update set last_value = app.code_counters.last_value + 1
  returning last_value into v_value;

  return coalesce(v_prefix, 'QTE') || '-' || v_period || '-' || lpad(v_value::text, 4, '0');
end
$$;

comment on function public.next_quote_code() is
  'Mints <prefix>-YYYY-NNNN per company (prefix from companies.code_prefix, default QTE). Call inside the same transaction as the quote insert: an abandoned transaction releases the number. The permission array here must stay byte-identical to quotes_insert in 0008.';

create or replace function public.next_invoice_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_period  text;
  v_value   bigint;
  v_prefix  text;
  v_tz      text;
begin
  if not app.has_any_perm(array['invoices','billing'], true) then
    raise exception 'insufficient privilege to mint an invoice number'
      using errcode = '42501';
  end if;

  v_company := app.current_company_id();
  if v_company is null then
    raise exception 'no active company for this session' using errcode = '42501';
  end if;

  select c.timezone, nullif(c.code_prefix, '') into v_tz, v_prefix
    from public.companies c where c.id = v_company;

  v_period := to_char(now() at time zone coalesce(v_tz, 'America/Los_Angeles'), 'YYYY');

  insert into app.code_counters (company_id, scope, period, last_value)
  values (v_company, 'invoice', v_period, 1)
  on conflict (company_id, scope, period)
    do update set last_value = app.code_counters.last_value + 1
  returning last_value into v_value;

  return coalesce(v_prefix, 'INV') || '-' || v_period || '-' || lpad(v_value::text, 4, '0');
end
$$;

comment on function public.next_invoice_code() is
  'Mints <prefix>-YYYY-NNNN per company (prefix from companies.code_prefix, default INV). The permission array here must stay byte-identical to invoices_insert in 0008.';

-- Same signatures as 0006, so CREATE OR REPLACE preserves the existing
-- grants (revoke all ... / grant execute ... to authenticated). No
-- grant statement is needed here; verified after apply that the ACL is
-- unchanged.


-- =====================================================================
-- B. claim_staff_for_current_user(): claim at most one row, and never
--    a second membership in a company the caller already belongs to.
--
-- Runs on every sign-in (src/server/auth-actions.ts:41) and previously
-- matched on verified email with no LIMIT: one address invited at two
-- companies would have both rows claimed in the same UPDATE. The
-- subquery below picks exactly one candidate, ordered by (created_at,
-- id) so a tie can never leave the choice to physical row order, and
-- excludes any company where the caller already holds a claimed row.
-- =====================================================================
create or replace function public.claim_staff_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid;
  v_email    text;
  v_staff_id uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;

  if v_email is null then
    raise exception 'email not verified' using errcode = '28000';
  end if;

  -- work_email is citext, whose operators live in `extensions` and do
  -- NOT resolve under search_path = ''. Compare via lower(...::text).
  update public.staff s
     set auth_user_id = v_uid,
         status = case when s.status = 'Pending invite' then 'Active' else s.status end
   where s.id = (
     select s2.id from public.staff s2
      where lower(s2.work_email::text) = v_email
        and s2.auth_user_id is null
        and s2.status in ('Active','Pending invite')   -- never Deactivated/Locked/Suspended
        and not exists (select 1 from public.staff s3
                         where s3.auth_user_id = v_uid and s3.company_id = s2.company_id)
      order by s2.created_at, s2.id
      limit 1)
  returning s.id into v_staff_id;

  return v_staff_id;
end
$$;

comment on function public.claim_staff_for_current_user() is
  'Binds the signed-in auth user to their pre-existing staff row by verified email. Claims exactly one row per call, ordered deterministically, and never a second row in a company the caller already belongs to. Returns NULL when there is no matching row, which is the signal to route to /unauthorized.';

-- Same signature as 0006; the existing grant to authenticated stands.


-- =====================================================================
-- app.assert_owner_remains(): was company-blind. It asked whether an
-- active Owner exists ANYWHERE, so company A's Owner would satisfy
-- company B's check and let B remove its last Owner. New signature
-- takes the company explicitly; the 0-arg version is dropped rather
-- than left as a dead, differently-shaped overload.
-- =====================================================================
drop function if exists app.assert_owner_remains();

create or replace function app.assert_owner_remains(p_company_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.staff s
    join public.roles r on r.id = s.role_id
    where r.slug = 'owner' and s.status = 'Active' and s.company_id = p_company_id
  ) then
    raise exception 'refusing to leave the company with no active Owner'
      using errcode = '23514';
  end if;
end
$$;

comment on function app.assert_owner_remains(uuid) is
  'Company-scoped: an Owner in a DIFFERENT company must never satisfy this check. Called by admin_set_staff_role / admin_set_staff_status after they mutate a staff row, with the caller''s own current_company_id().';

revoke all on function app.assert_owner_remains(uuid) from public, anon, authenticated;


-- =====================================================================
-- C. The five admin_* RPCs. Two changes, applied where each applies:
--
--   1. The target staff row must be resolved WITHIN THE CALLER'S
--      COMPANY, and a foreign uuid must answer "no such staff member",
--      NOT "insufficient privilege" or a bare row-not-found from a
--      differently-shaped query. A privilege-flavoured answer would be
--      an existence oracle across the tenant wall: try a uuid, read
--      the error, learn whether it exists in SOME other company.
--
--   2. `select r.id into v_role_id from public.roles where r.slug =
--      p_role_slug` (0006_functions.sql:793 and :885) is multi-row now
--      that roles.slug is unique only per company (0015). Without
--      STRICT it silently takes an arbitrary match, which the
--      composite FK staff_role_id_fkey (company_id, role_id) ->
--      roles(company_id, id) added in 0015 would then reject as a
--      foreign-key violation if the arbitrary match belonged to
--      another company -- correct outcome, wrong, confusing error.
--      STRICT plus a company predicate makes the lookup exact and the
--      failure mode a plain "no rows", instead of a nondeterministic
--      23503 that depends on physical row order.
--
-- v_company is resolved once per call and reused for both the target
-- predicate and assert_owner_remains(), rather than calling
-- current_company_id() twice: it is STABLE so the two calls cannot
-- diverge today, but capturing it once removes the possibility by
-- construction instead of by the function's current implementation.
-- =====================================================================

create or replace function public.admin_create_staff(
  p_full_name  text,
  p_work_email text,
  p_role_slug  text,
  p_team       text,
  p_status     text        default 'Pending invite',
  p_avatar_url text        default null,
  p_joined_at  timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company  uuid;
  v_role_id  uuid;
  v_staff_id uuid;
begin
  perform app.assert_can_manage_users();
  v_company := app.current_company_id();

  if coalesce(btrim(p_full_name), '') = '' then
    raise exception 'full_name is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_work_email), '') = '' then
    raise exception 'work_email is required' using errcode = '22023';
  end if;

  select r.id into strict v_role_id
    from public.roles r
   where r.slug = p_role_slug
     and r.company_id = v_company;

  insert into public.staff (
    full_name, work_email, role_id, team, status, avatar_url, joined_at, company_id)
  values (
    btrim(p_full_name), btrim(p_work_email)::extensions.citext, v_role_id,
    p_team, p_status, p_avatar_url, p_joined_at, v_company)
  returning id into v_staff_id;

  return v_staff_id;
end
$$;

comment on function public.admin_create_staff(text, text, text, text, text, text, timestamptz) is
  'Creates a staff row in the caller''s own company. p_role_slug is resolved with STRICT and a company predicate: roles.slug is unique only per company (0015), so an unscoped lookup would be multi-row. The staff_team_check and staff_status_check constraints validate team/status.';

create or replace function public.admin_update_staff(
  p_staff_id   uuid,
  p_full_name  text default null,
  p_work_email text default null,
  p_team       text default null,
  p_avatar_url text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  perform app.assert_can_manage_users();
  v_company := app.current_company_id();

  -- NULL means "leave unchanged". avatar_url therefore cannot be cleared
  -- through this function; clearing it is the self-service path, which
  -- is a column grant on staff(full_name, avatar_url).
  update public.staff s
     set full_name  = coalesce(btrim(p_full_name), s.full_name),
         work_email = coalesce(btrim(p_work_email)::extensions.citext, s.work_email),
         team       = coalesce(p_team, s.team),
         avatar_url = coalesce(p_avatar_url, s.avatar_url)
   where s.id = p_staff_id
     and s.company_id = v_company;

  if not found then
    raise exception 'no such staff member: %', p_staff_id using errcode = '22023';
  end if;
end
$$;

comment on function public.admin_update_staff(uuid, text, text, text, text) is
  'Updates a staff row. The target is resolved within the caller''s own company; a foreign-company uuid answers "no such staff member" (22023), not a permission error, so the target lookup cannot be used as a cross-tenant existence oracle.';

-- admin_invite_staff (0006:842) is a thin wrapper that only calls
-- admin_create_staff and takes no staff id, so it needs no change of
-- its own: it inherits the role-lookup fix above by delegation.

create or replace function public.admin_set_staff_role(p_staff_id uuid, p_role_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid;
  v_company uuid;
  v_role_id uuid;
begin
  v_actor := app.assert_can_manage_users();
  v_company := app.current_company_id();

  if p_staff_id = v_actor then
    raise exception 'you cannot change your own role' using errcode = '42501';
  end if;

  select r.id into strict v_role_id
    from public.roles r
   where r.slug = p_role_slug
     and r.company_id = v_company;

  update public.staff s
     set role_id = v_role_id
   where s.id = p_staff_id
     and s.company_id = v_company;

  if not found then
    raise exception 'no such staff member: %', p_staff_id using errcode = '22023';
  end if;

  perform app.assert_owner_remains(v_company);
end
$$;

comment on function public.admin_set_staff_role(uuid, text) is
  'Reassigns a staff member''s role, both resolved within the caller''s own company. p_role_slug uses STRICT (see the file header); p_staff_id answers "no such staff member" (22023) rather than leaking existence across the tenant wall.';

create or replace function public.admin_set_staff_status(p_staff_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid;
  v_company uuid;
begin
  v_actor := app.assert_can_manage_users();
  v_company := app.current_company_id();

  if p_staff_id = v_actor then
    raise exception 'you cannot change your own status' using errcode = '42501';
  end if;

  update public.staff s
     set status = p_status
   where s.id = p_staff_id
     and s.company_id = v_company;

  if not found then
    raise exception 'no such staff member: %', p_staff_id using errcode = '22023';
  end if;

  perform app.assert_owner_remains(v_company);
end
$$;

comment on function public.admin_set_staff_status(uuid, text) is
  'Sets a staff member''s status, resolved within the caller''s own company. This is the function proven exploitable across tenants before this migration (task-6-report.md): a foreign uuid now answers "no such staff member" (22023) instead of succeeding.';

-- All five keep their 0006 signatures, so CREATE OR REPLACE preserves
-- the existing grants to authenticated. No grant statement is needed
-- here; verified after apply that the ACL is unchanged.


-- =====================================================================
-- D. dev_seed.reseed_calendar(): was scoped only on `is_seed`, so it
--    moved every tenant's seeded calendar rows in one call. The
--    3-argument version replaces the 2-argument one outright rather
--    than existing alongside it as a second, tenant-blind overload.
--
-- p_company_id has a default of NULL, not because NULL is ever a valid
-- value, but because Postgres requires trailing parameters to have
-- defaults once one parameter does (p_tz already did). The runtime
-- check below is what actually makes the argument mandatory.
-- =====================================================================
drop function if exists dev_seed.reseed_calendar(date, text);

create or replace function dev_seed.reseed_calendar(
  p_anchor     date default null,
  p_tz         text default 'America/Los_Angeles',
  p_company_id uuid default null
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target  date;
  v_current date;
  v_months  integer;
  v_moved   integer := 0;
begin
  if p_company_id is null then
    raise exception 'p_company_id is required' using errcode = '22023';
  end if;

  v_target := date_trunc('month', coalesce(p_anchor, (now() at time zone p_tz)::date))::date;

  select date_trunc('month', min(e.starts_at at time zone p_tz))::date
    into v_current
  from public.calendar_events e
  where e.is_seed and e.company_id = p_company_id;

  if v_current is null then
    -- Nothing seeded yet for this company. The rows themselves come
    -- from the seed migration; this function only moves them.
    return 0;
  end if;

  v_months := (extract(year  from v_target)::integer - extract(year  from v_current)::integer) * 12
            + (extract(month from v_target)::integer - extract(month from v_current)::integer);

  if v_months = 0 then
    return 0;
  end if;

  -- Convert to local wall-clock, add whole months, convert back. Doing
  -- the arithmetic in UTC would land the 7:30 AM stand-up at 12:30 AM
  -- Pacific across a DST boundary.
  update public.calendar_events e
     set starts_at = ((e.starts_at at time zone p_tz) + make_interval(months => v_months)) at time zone p_tz,
         ends_at   = case
                       when e.ends_at is null then null
                       else ((e.ends_at at time zone p_tz) + make_interval(months => v_months)) at time zone p_tz
                     end
   where e.is_seed and e.company_id = p_company_id;

  get diagnostics v_moved = row_count;
  return v_moved;
end
$$;

comment on function dev_seed.reseed_calendar(date, text, uuid) is
  'Re-anchors ONE company''s seeded calendar rows to the given month (default: the current Pacific month). Scoped on is_seed AND company_id, never on a code prefix. p_company_id is mandatory (see the NULL-default comment above). No grants: reachable only with the secret key or as postgres.';

-- No grants, deliberately, matching 0006: `authenticated` has no USAGE
-- on dev_seed, so absent grants make this unreachable from the API.
-- The 3-argument signature starts with the Postgres default of PUBLIC
-- EXECUTE and needs this revoke restated; it is not inherited from the
-- dropped 2-argument function.
revoke all on function dev_seed.reseed_calendar(date, text, uuid)
  from public, anon, authenticated;

reset check_function_bodies;

-- =====================================================================
-- SELF-REVIEW: every SECURITY DEFINER routine, and where its company
-- predicate comes from. The full catalog enumeration (including the
-- helpers this migration does not touch) is in task-6-report.md.
--
--   next_quote_code / next_invoice_code   -- own predicate (this file)
--   claim_staff_for_current_user          -- no predicate needed: it
--     matches by verified email across ALL companies by design (an
--     invite can exist in more than one company for the same person)
--     and the fix constrains it to one claim per call and per company,
--     not to a single company.
--   assert_owner_remains(uuid)            -- own predicate (this file)
--   admin_create_staff / admin_update_staff /
--   admin_set_staff_role / admin_set_staff_status
--                                          -- own predicate (this file)
--   admin_invite_staff                    -- no predicate of its own:
--     delegates entirely to admin_create_staff, which has one.
--   dev_seed.reseed_calendar              -- own predicate (this file)
-- =====================================================================
