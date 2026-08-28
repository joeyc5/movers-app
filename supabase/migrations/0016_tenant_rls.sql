-- =====================================================================
-- 0016_tenant_rls.sql
--
-- The enforcement half of the tenant boundary. 0015 made cross-company
-- references structurally impossible; this migration makes cross-company
-- READS AND WRITES impossible.
--
-- Two changes, applied together in one transaction because the first is
-- unsafe without the second:
--
--   1. The four permission helpers (current_staff_id, is_active_staff,
--      is_active_writer, has_any_perm) gain a company_id predicate.
--      has_any_perm is the important one: without it, write permission
--      held in one company would silently authorize writes in another
--      the moment a second membership exists.
--
--   2. One identical RESTRICTIVE tenant_isolation policy per tenant
--      table. Tenancy is kept out of 0008_rls_policies.sql on purpose --
--      grafting a company term into 88 hand-written predicates (some of
--      them multi-branch ORs) is 30 chances to be 96% right. A
--      RESTRICTIVE policy is ANDed with every permissive policy by
--      construction, cannot be widened by any future permissive policy,
--      and is verifiable by exact string equality because its body is
--      byte-identical across every table it is applied to.
--
-- `to public`, not `to authenticated`: it cannot be sidestepped by a role
-- nobody anticipated.
--
-- Deliberately NOT `force row level security`: that applies to the table
-- owner, which is `postgres`, which is how migrations and seeds run.
--
-- company_billing_profile is excluded from the table list below, same as
-- 0013 and 0014: it is rebuilt with company_id as its primary key in a
-- later migration, which is where it gets its tenant_isolation policy.
-- =====================================================================

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
-- byte-identical across all 24; a later guard asserts exact string
-- equality.
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
