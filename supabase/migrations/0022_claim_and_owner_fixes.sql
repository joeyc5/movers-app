set check_function_bodies = off;

-- =====================================================================
-- 0022_claim_and_owner_fixes.sql
--
-- Two defects found in review of the 0012-0021 range. Neither was
-- caught by 0021_tenancy_guard.sql or 9999_security_guard.sql because
-- both guards check SHAPE (columns, constraints, policies, grants),
-- not the runtime behaviour of a function body.
-- =====================================================================


-- =====================================================================
-- A. claim_staff_for_current_user() accumulates memberships.
--
-- 0017 fixed "claims every matching row" down to "claims at most one
-- row per call", but its `not exists` clause only blocks a REPEAT
-- claim within a company the caller already holds. It does nothing to
-- stop a caller who already holds an active membership in company A
-- from also claiming a freshly-created row in company B on their next
-- sign-in. Concretely: an Owner of ANY company can create a staff row
-- carrying someone else's real email address (full_name and
-- work_email are free-text arguments to admin_create_staff), and that
-- person joins the new company automatically, with zero acceptance
-- step, the next time they sign in anywhere in this app.
--
-- Fix: gate the entire claim on the caller currently holding ZERO
-- active memberships, checked before the update runs at all, not
-- folded into the per-row subquery predicate. This is the only case
-- this phase supports. Multi-company membership itself is not
-- implemented: there is no invite-acceptance flow and no company
-- switcher, both explicitly out of scope for this phase, so even a
-- successfully-claimed second membership could never be selected or
-- used. Do not read the single-membership limit here as an oversight;
-- lifting it requires building the invite-acceptance flow first, not
-- loosening this guard.
--
-- A caller who is Deactivated at company A but holds no OTHER active
-- membership can still claim at company B: current_company_state()
-- already defines "membership" as status = 'Active' staff rows, and a
-- Deactivated row does not count as one. That is consistent with the
-- rest of the system, not a separate hole.
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

  -- The gate: a caller who already holds any active membership claims
  -- nothing further, this call or any future one, until that
  -- membership is gone. Returns NULL, same as "no matching row" --
  -- auth-actions.ts (src/server/auth-actions.ts:41) only checks the
  -- RPC's error, never its return value, so the two NULL cases do not
  -- need to be distinguishable to the caller.
  if exists (
    select 1 from public.staff s3
     where s3.auth_user_id = v_uid and s3.status = 'Active'
  ) then
    return null;
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
      order by s2.created_at, s2.id
      limit 1)
  returning s.id into v_staff_id;

  return v_staff_id;
end
$$;

comment on function public.claim_staff_for_current_user() is
  'Binds the signed-in auth user to their pre-existing staff row by verified email, but only when the caller currently holds ZERO active memberships anywhere -- one person, one company, for as long as this phase has no invite-acceptance flow and no company switcher. Returns NULL both when there is no matching row (the /unauthorized signal) and when the caller already belongs somewhere (a deliberate no-op, not an error): auth-actions.ts never inspects the return value, only the error.';

-- Same signature as 0017/0006; the existing grant to authenticated stands.


-- =====================================================================
-- B. A freshly provisioned tenant cannot administer its own staff.
--
-- create_company() (0019, redefined in 0020) provisions the Owner as
-- status = 'Pending invite' -- correct, since nobody has signed in yet
-- to claim that row. But app.assert_owner_remains(p_company_id)
-- requires status = 'Active', so every call to admin_set_staff_role /
-- admin_set_staff_status in that company raises 23514 at their
-- trailing `perform app.assert_owner_remains(v_company)`
-- (0017_definer_surface.sql:381 and :414) -- REGARDLESS of what staff
-- row the call actually targets, because the check is company-wide,
-- not target-specific. This blocks every admin action in a brand new
-- company until the Owner personally signs in, which is structural in
-- create_company() and not specific to SVM: any company created
-- through this path starts in the same locked state.
--
-- The invariant this function is meant to hold is "this company still
-- has an Owner", not "this company has a SIGNED-IN Owner". Fix:
-- broaden the predicate from status = 'Active' to status <> 'Deactivated',
-- so a 'Pending invite' (or 'Locked' or 'Suspended') Owner still holds
-- the seat -- Deactivated is the only status this repo treats as
-- "gone" (see staff's own table comment: never filter a REFERENCED row
-- by status, but assert_owner_remains is not referencing a row for
-- display, it is asking whether the OWNER SEAT is still occupied by
-- someone who has not been actively removed from it).
-- =====================================================================
create or replace function app.assert_owner_remains(p_company_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.staff s
    join public.roles r on r.id = s.role_id
    where r.slug = 'owner' and s.status <> 'Deactivated' and s.company_id = p_company_id
  ) then
    raise exception 'refusing to leave the company with no active Owner'
      using errcode = '23514';
  end if;
end
$$;

comment on function app.assert_owner_remains(uuid) is
  'Company-scoped: an Owner in a DIFFERENT company must never satisfy this check. Holds "this company still has an Owner", not "this company has a SIGNED-IN Owner" -- a freshly provisioned company''s Owner starts as Pending invite and must still count, or no admin_* call can ever succeed in that company until the Owner personally claims their row. Deactivated is the only status treated as the seat being vacated. Called by admin_set_staff_role / admin_set_staff_status after they mutate a staff row, with the caller''s own current_company_id().';

-- Same signature as 0017; the existing revoke stands (superseded below
-- for clarity, not because it changed).
revoke all on function app.assert_owner_remains(uuid) from public, anon, authenticated;

reset check_function_bodies;
