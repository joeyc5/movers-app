-- =====================================================================
-- Fix-forward for 0019_provisioning.sql: create_company() provisioned
-- system roles but not their permission bindings in role_permission_sets,
-- even though the task's own decision named bindings as a required
-- deliverable and the file's own comment says role_permission_sets is
-- only ever written through this function. Caught post-apply via review,
-- before this branch was pushed or the task reported done.
--
-- Owner/Admin are access_level = 'Full' and short-circuit
-- app.has_any_perm() before it reads this table, so this does not change
-- their behaviour. Read-only is NOT Full: app.has_any_perm() for a
-- non-Full role with zero bindings returns false unconditionally, which
-- would silently lock out anyone ever assigned SVM's read-only role.
--
-- supabase/migrations/0019_provisioning.sql in the repo has been updated
-- to include this insert directly inside create_company(), so a fresh
-- apply of that file provisions bindings from the start. This migration
-- reconciles the SVM company that 0019 already created against this
-- project before the fix landed. It cannot re-call create_company() for
-- svm (companies.slug is unique and svm already exists), so it redefines
-- the function (idempotent CREATE OR REPLACE, safe to run again) and
-- backfills the specific rows SVM is missing, mirrored from Demo Movers'
-- three system roles (queried from the live project, not invented).
-- =====================================================================

create or replace function public.create_company(
  p_name text, p_slug text, p_owner_email text, p_owner_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_owner_role uuid; v_loc uuid; v_card uuid;
begin
  insert into public.companies (slug, name, quote_prefix, invoice_prefix)
  values (p_slug, p_name, 'QTE', 'INV') returning id into v_company;

  insert into public.roles (company_id, slug, name, access_level, is_system, status)
  values (v_company,'owner','Owner','Full',true,'Active'),
         (v_company,'admin','Admin','Full',false,'Active'),
         (v_company,'read-only','Read-only','Read only',true,'Active');
  select id into strict v_owner_role from public.roles
   where company_id = v_company and slug = 'owner';

  insert into public.role_permission_sets (company_id, role_id, permission_set_id, position)
  select v_company, r.id, ps.id, x.position
  from (values
    ('owner','users',0),('owner','settings',1),('owner','billing',2),
    ('owner','reports',3),('owner','clients',4),('owner','dispatch',5),
    ('admin','users',0),('admin','settings',1),('admin','reports',2),
    ('admin','billing',3),('admin','clients',4),
    ('read-only','clients',0),('read-only','jobs',1),('read-only','reports',2)
  ) as x(role_slug, perm_slug, position)
  join public.roles r on r.company_id = v_company and r.slug = x.role_slug
  join public.permission_sets ps on ps.slug = x.perm_slug
  on conflict (role_id, permission_set_id) do nothing;

  insert into public.warehouse_locations (company_id, slug, name, sort_order, is_active)
  values (v_company,'main','Main Warehouse',1,true) returning id into v_loc;

  insert into public.rate_cards (company_id, code, name, effective_from, is_default)
  values (v_company,'STD','Standard Rate Card', current_date, true) returning id into v_card;

  insert into public.crew_rates (company_id, rate_card_id, crew_size, hourly_rate_per_mover,
                                 min_hours, ot_threshold_hours, ot_multiplier)
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

  insert into public.staff (company_id, full_name, work_email, role_id, team, status, joined_at)
  values (v_company, p_owner_name, p_owner_email::extensions.citext,
          v_owner_role, 'Leadership', 'Pending invite', now());

  insert into app.code_counters (company_id, scope, period, last_value)
  values (v_company,'quote',  to_char(now() at time zone 'America/Los_Angeles','YYYY'), 0),
         (v_company,'invoice',to_char(now() at time zone 'America/Los_Angeles','YYYY'), 0);

  return v_company;
end $$;

comment on function public.create_company(text, text, text, text) is
  'The one durable path by which a company comes into existence. Provisions system roles and their permission bindings, a default rate card and tax rate, one warehouse location, a billing profile, a Pending-invite Owner staff row, and both code counters. service_role only -- no self-serve signup in this phase.';

revoke all on function public.create_company(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_company(text,text,text,text) to service_role;

-- Backfill: SVM already exists (created before this fix), so give its
-- three system roles the bindings create_company() would have given them
-- if the fix had landed first. ON CONFLICT DO NOTHING makes this
-- statement, and the identical one embedded in create_company() above,
-- safe to run again with no effect once the rows exist.
insert into public.role_permission_sets (company_id, role_id, permission_set_id, position)
select c.id, r.id, ps.id, x.position
from public.companies c
join public.roles r on r.company_id = c.id
cross join lateral (values
  ('owner','users',0),('owner','settings',1),('owner','billing',2),
  ('owner','reports',3),('owner','clients',4),('owner','dispatch',5),
  ('admin','users',0),('admin','settings',1),('admin','reports',2),
  ('admin','billing',3),('admin','clients',4),
  ('read-only','clients',0),('read-only','jobs',1),('read-only','reports',2)
) as x(role_slug, perm_slug, position)
join public.permission_sets ps on ps.slug = x.perm_slug
where c.slug = 'svm' and r.slug = x.role_slug
on conflict (role_id, permission_set_id) do nothing;
