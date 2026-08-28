-- Add nullable company_id everywhere. Nullable, no default, no constraints:
-- a `not null default app.current_company_id()` in one statement is a
-- trap. The function is STABLE, so Postgres evaluates it once at DDL
-- time (NULL, since migrations run as postgres), stores that as the
-- missing-value, and the statement fails on its own NOT NULL.
--
-- company_billing_profile is excluded here; a later migration rebuilds it
-- with company_id as its primary key.
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
