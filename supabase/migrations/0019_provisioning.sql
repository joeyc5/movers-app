set check_function_bodies = off;

-- =====================================================================
-- 0019_provisioning.sql
--
-- public.create_company() -- the one durable path by which any company
-- comes into existence -- and the SVM tenant created through it.
--
-- =====================================================================
-- A. FIX A REAL BUG FIRST: one column cannot serve two document types.
-- =====================================================================
--
-- next_quote_code() and next_invoice_code() (0017) both read
-- companies.code_prefix: quotes do coalesce(v_prefix, 'QTE'), invoices do
-- coalesce(v_prefix, 'INV'). Demo Movers has code_prefix = 'QTE', which is
-- non-empty, so nullif(c.code_prefix, '') never falls through to either
-- default -- BOTH minters resolve v_prefix to 'QTE'. An invoice therefore
-- mints as QTE-2026-NNNN off the invoice counter while a quote mints
-- QTE-2026-MMMM off a separate one, and the two can land on the identical
-- string. quotes and invoices are different tables with different unique
-- constraints, so nothing in the database rejects that; it is a
-- human-facing collision in a CRM where these codes are how people refer
-- to documents on the phone.
--
-- Split into two columns, one per document type, each with its OWN
-- sensible default. Existing rows keep their value under the new name:
-- Demo Movers' code_prefix = 'QTE' becomes quote_prefix = 'QTE' via the
-- rename (no data touched), and the new invoice_prefix column back-fills
-- every existing row to 'INV' via its column default, including Demo's.
-- =====================================================================
alter table public.companies rename column code_prefix to quote_prefix;
alter table public.companies alter column quote_prefix set default 'QTE';
alter table public.companies add column invoice_prefix text not null default 'INV';

comment on column public.companies.quote_prefix is
  'Printed as <prefix>-YYYY-NNNN by next_quote_code(). Never read by next_invoice_code() -- see invoice_prefix, and the bug this split fixed in 0019.';
comment on column public.companies.invoice_prefix is
  'Printed as <prefix>-YYYY-NNNN by next_invoice_code(). A sibling of quote_prefix, not a fallback for it: the two must stay independently settable so a quote and an invoice can never share a code string.';

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

  select c.timezone, nullif(c.quote_prefix, '') into v_tz, v_prefix
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
  'Mints <prefix>-YYYY-NNNN per company (prefix from companies.quote_prefix, default QTE). Call inside the same transaction as the quote insert: an abandoned transaction releases the number. The permission array here must stay byte-identical to quotes_insert in 0008.';

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

  select c.timezone, nullif(c.invoice_prefix, '') into v_tz, v_prefix
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
  'Mints <prefix>-YYYY-NNNN per company (prefix from companies.invoice_prefix, default INV). The permission array here must stay byte-identical to invoices_insert in 0008.';

-- Same signatures as 0017, so CREATE OR REPLACE preserves the existing
-- grants. No grant statement needed; verified after apply that the ACL
-- is unchanged.


-- =====================================================================
-- B. public.create_company(). SECURITY DEFINER, service_role only.
--
-- Cannot use "the caller": it is called with no session at all (service
-- role, auth.uid() is NULL), so it takes an explicit owner email/name and
-- creates a 'Pending invite' staff row. claim_staff_for_current_user()
-- binds it on first sign-in, same as any other invited staff member.
--
-- Provisions REFERENCE DATA, not just roles: a company with zero
-- warehouse_locations, no default rate_cards and no default tax_rates
-- breaks on first load (quote-actions.ts:90-91 needs both defaults, and
-- vaults_expanded inner-joins warehouse_locations).
--
-- THREE DEFECTS IN THE ORIGINAL SKETCH, FIXED HERE, EACH VERIFIED BY
-- ACTUALLY RUNNING IT rather than trusted by inspection:
--
--   1. roles.group_label is `generated always as (...) stored` (0002).
--      Naming it in an INSERT column list is a hard error ("cannot
--      insert into column \"group_label\""). Removed from the column
--      list and the VALUES; it derives itself from status/is_system.
--
--   2. crew_rates has no `hourly_rate` or `ot_threshold` columns -- the
--      real names are `hourly_rate_per_mover` and `ot_threshold_hours`
--      (0003_crm.sql:159,161). The original column list would have
--      failed with "column does not exist" before ever reaching a
--      constraint.
--
--   3. rate_cards.effective_from is NOT NULL with no default
--      (0003_crm.sql:127); staff.joined_at is NOT NULL with no default
--      (0002_platform.sql:187). Both were missing from their respective
--      INSERTs, which would have failed 23502 (not-null violation).
--      effective_from gets current_date; joined_at gets now(), matching
--      how every other provisioning timestamp in this function is set.
-- =====================================================================
create or replace function public.create_company(
  p_name text, p_slug text, p_owner_email text, p_owner_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_owner_role uuid; v_loc uuid; v_card uuid;
begin
  insert into public.companies (slug, name, quote_prefix, invoice_prefix)
  values (p_slug, p_name, 'QTE', 'INV') returning id into v_company;

  -- System roles, per company. roles/role_permission_sets have SELECT-only
  -- policies by design (0008:158-168), so this is the only path that creates
  -- them. group_label is a generated column (see defect 1 above) and is
  -- deliberately absent from this list.
  insert into public.roles (company_id, slug, name, access_level, is_system, status)
  values (v_company,'owner','Owner','Full',true,'Active'),
         (v_company,'admin','Admin','Full',false,'Active'),
         (v_company,'read-only','Read-only','Read only',true,'Active');
  select id into strict v_owner_role from public.roles
   where company_id = v_company and slug = 'owner';

  -- Reference data. Without these the app is broken on first load.
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

  -- Pending invite: claim_staff_for_current_user() binds it on first sign-in.
  -- joined_at is NOT NULL with no default (defect 3 above); now() matches
  -- every other provisioning timestamp set explicitly in this function.
  insert into public.staff (company_id, full_name, work_email, role_id, team, status, joined_at)
  values (v_company, p_owner_name, p_owner_email::extensions.citext,
          v_owner_role, 'Leadership', 'Pending invite', now());

  -- Prime counters so the first mint is 0001.
  insert into app.code_counters (company_id, scope, period, last_value)
  values (v_company,'quote',  to_char(now() at time zone 'America/Los_Angeles','YYYY'), 0),
         (v_company,'invoice',to_char(now() at time zone 'America/Los_Angeles','YYYY'), 0);

  return v_company;
end $$;

comment on function public.create_company(text, text, text, text) is
  'The one durable path by which a company comes into existence. Provisions system roles, a default rate card and tax rate, one warehouse location, a billing profile, a Pending-invite Owner staff row, and both code counters. service_role only -- no self-serve signup in this phase.';

revoke all on function public.create_company(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_company(text,text,text,text) to service_role;


-- =====================================================================
-- C. Demo's quote counter must start from the existing high-water mark,
--    not from whatever app.code_counters happens to hold, or the next
--    live mint could re-issue a code that already exists in public.quotes
--    (the per-company unique on (company_id, code) would then reject the
--    insert outright -- correct outcome, confusing error). Scoped to
--    scope = 'quote' only: this migration does not touch invoice data.
-- =====================================================================
update app.code_counters cc
   set last_value = greatest(cc.last_value, coalesce((
     select max(substring(q.code from '(\d+)$')::bigint)
       from public.quotes q where q.company_id = cc.company_id), 0))
 where cc.scope = 'quote';


-- =====================================================================
-- D. Silicon Valley Moving & Storage -- the first real tenant. Owner
-- staff row is created with a NULL auth_user_id by design: a later task
-- creates the auth account and claim_staff_for_current_user() binds it.
-- No auth user and no password are created or stored here.
-- =====================================================================
select public.create_company(
  'Silicon Valley Moving & Storage', 'svm',
  'joey@siliconvalleymoving.com', 'Joey Childs');

reset check_function_bodies;
