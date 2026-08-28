set check_function_bodies = off;

-- =====================================================================
-- 0023_current_company_state_single_eval.sql
--
-- public.current_company_state() (0012) called app.current_company_id()
-- three separate times per invocation: once in the CASE branch, once
-- in the second output column, once inside the correlated subquery for
-- the third. The dashboard layout calls this function on every page
-- load, so that is three SECURITY DEFINER function calls, each running
-- its own two-table join against user_active_company and staff, where
-- one would do.
--
-- Fix: bind the resolved company id once, in a `with ... as materialized`
-- CTE, and read it three times instead of recomputing it three times.
-- `materialized` is explicit rather than relying on the planner's
-- default: a non-recursive CTE referenced more than once is usually
-- inlined or materialized at the planner's discretion, and inlining
-- would just re-substitute the function call at each reference site,
-- silently undoing the fix. `materialized` forces exactly one
-- evaluation regardless of how the planner would otherwise choose.
--
-- The three returned states and their semantics are unchanged:
--   'no-membership'     -- caller holds zero Active staff rows anywhere.
--   'revoked-selection' -- the caller's selection no longer resolves to
--                          an Active membership; must never fall through
--                          to some other tenant.
--   'ok'                -- resolves cleanly, company_id/company_name set.
-- =====================================================================
create or replace function public.current_company_state()
returns table (state text, company_id uuid, company_name text)
language sql stable security definer set search_path = '' as $$
  with memberships as (
    select s.company_id from public.staff s
     where s.auth_user_id = (select auth.uid()) and s.status = 'Active'
  ),
  resolved as materialized (
    select app.current_company_id() as company_id
  )
  select case
           when (select count(*) from memberships) = 0 then 'no-membership'
           when resolved.company_id is null             then 'revoked-selection'
           else 'ok'
         end,
         resolved.company_id,
         (select c.name from public.companies c where c.id = resolved.company_id)
    from resolved
$$;

comment on function public.current_company_state() is
  'NULL must be legible. is_active_staff() going false renders the whole app blank with no error, which 9999_security_guard.sql names as this system''s hardest symptom. The layout calls this to tell the states apart. app.current_company_id() is evaluated exactly once per call via the materialized `resolved` CTE (0023); do not inline it back into the three read sites.';

-- Same signature as 0012; the existing revoke/grant to authenticated stand.

reset check_function_bodies;
