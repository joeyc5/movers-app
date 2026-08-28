-- =====================================================================
-- 0015_constraints.sql
--
-- The structural half of the tenant boundary. Every unique constraint
-- that used to mean "globally unique" becomes "unique within a company,"
-- and every foreign key between two tenant tables becomes composite, so
-- attaching company A's row to company B's row is impossible even if a
-- policy is misconfigured or a service-role script has a bug. RLS (0016)
-- is the other half; this file works even with RLS off.
--
-- MATCH SIMPLE (the default -- no keyword needed) is correct throughout:
-- it skips the FK check when any referencing column is NULL, which with
-- company_id NOT NULL means "no reference at all" for the many optional
-- FKs in this schema. MATCH FULL would forbid every one of them.
--
-- Two DDL cycles from the original schema are preserved here too, though
-- for a different reason than at CREATE TABLE time: roles<->staff
-- (0002:240) and deals<->quotes (0003:619) were deferred ALTERs because
-- the tables didn't both exist yet. Here both tables already exist, so
-- the only real requirement is that each FK's target `unique
-- (company_id, id)` exists before the FK referencing it is added -- which
-- Step 3's parent-uniques loop guarantees for all 15 parents before any
-- FK is touched. The original pairing is kept anyway, at zero cost, so
-- the file reads the same way the schema was built.
-- =====================================================================

-- =====================================================================
-- Step 1: unique constraint swaps.
-- Codes, slugs and names are per-company namespaces now.
-- =====================================================================
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
-- NOTE: next_quote_code() / next_invoice_code() (0006) still say
-- `on conflict (scope, period)`, which no longer names a real constraint
-- once the PK is (company_id, scope, period). That leaves both minters
-- broken (42P10) until 0017_rpcs.sql rewrites them against the new key.
-- Deliberately deferred -- 0015 is constraints only -- but it is a real,
-- currently-shipped regression: quote/invoice code minting is broken from
-- this migration until 0017 lands.
alter table app.code_counters drop constraint code_counters_pkey,
  add constraint code_counters_pkey primary key (company_id, scope, period);

-- =====================================================================
-- Step 1b: close the gap the plan missed. app.code_counters is a scoped
-- table with no FK to companies and no immutability trigger, so of the
-- 25 tables company_id-scoped so far it was the one service_role could
-- silently re-tenant. Same FK shape and same trigger as the 24 tables
-- 0014 already wired (trg_<table>_company_immutable), just schema-
-- qualified because code_counters lives in app, not public.
-- =====================================================================
alter table app.code_counters add constraint code_counters_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete restrict;

create trigger trg_code_counters_company_immutable before update on app.code_counters
  for each row execute function app.tg_company_id_immutable();

-- =====================================================================
-- Step 2: FK-target uniques on the 15 parent tables, then the 48
-- composite-eligible FKs.
--
-- Required: an FK must reference a unique constraint whose column list
-- matches exactly. `id` being independently unique does not satisfy
-- that. Each `unique (company_id, id)` also doubles as the leading-
-- column index for the tenant predicate RLS will add in 0016.
-- =====================================================================
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
    execute format('alter table public.%I add constraint %I unique (company_id, id)',
                   t, t || '_company_id_key');
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- calendar_event_crew
-- ---------------------------------------------------------------------
alter table public.calendar_event_crew drop constraint calendar_event_crew_event_fkey;
alter table public.calendar_event_crew add constraint calendar_event_crew_event_fkey
  foreign key (company_id, calendar_event_id) references public.calendar_events (company_id, id)
  on delete cascade on update restrict not valid;

alter table public.calendar_event_crew drop constraint calendar_event_crew_staff_fkey;
alter table public.calendar_event_crew add constraint calendar_event_crew_staff_fkey
  foreign key (company_id, staff_id) references public.staff (company_id, id)
  on delete restrict on update restrict not valid;

-- ---------------------------------------------------------------------
-- calendar_events
-- ---------------------------------------------------------------------
alter table public.calendar_events drop constraint calendar_events_client_id_fkey;
alter table public.calendar_events add constraint calendar_events_client_id_fkey
  foreign key (company_id, client_id) references public.clients (company_id, id)
  on delete set null (client_id) on update restrict not valid;

alter table public.calendar_events drop constraint calendar_events_estimator_id_fkey;
alter table public.calendar_events add constraint calendar_events_estimator_id_fkey
  foreign key (company_id, estimator_id) references public.staff (company_id, id)
  on delete set null (estimator_id) on update restrict not valid;

alter table public.calendar_events drop constraint calendar_events_storage_agreement_id_fkey;
alter table public.calendar_events add constraint calendar_events_storage_agreement_id_fkey
  foreign key (company_id, storage_agreement_id) references public.storage_agreements (company_id, id)
  on delete set null (storage_agreement_id) on update restrict not valid;

alter table public.calendar_events drop constraint calendar_events_warehouse_location_id_fkey;
alter table public.calendar_events add constraint calendar_events_warehouse_location_id_fkey
  foreign key (company_id, warehouse_location_id) references public.warehouse_locations (company_id, id)
  on delete set null (warehouse_location_id) on update restrict not valid;

-- ---------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------
alter table public.clients drop constraint clients_account_owner_staff_id_fkey;
alter table public.clients add constraint clients_account_owner_staff_id_fkey
  foreign key (company_id, account_owner_staff_id) references public.staff (company_id, id)
  on delete set null (account_owner_staff_id) on update restrict not valid;

-- ---------------------------------------------------------------------
-- crew_rates
-- ---------------------------------------------------------------------
alter table public.crew_rates drop constraint crew_rates_rate_card_id_fkey;
alter table public.crew_rates add constraint crew_rates_rate_card_id_fkey
  foreign key (company_id, rate_card_id) references public.rate_cards (company_id, id)
  on delete cascade on update restrict not valid;

-- ---------------------------------------------------------------------
-- deals  (D3: accepted_quote_id_fkey pairs with quotes_deal_id_fkey below)
-- ---------------------------------------------------------------------
alter table public.deals drop constraint deals_accepted_quote_id_fkey;
alter table public.deals add constraint deals_accepted_quote_id_fkey
  foreign key (company_id, accepted_quote_id) references public.quotes (company_id, id)
  on delete restrict on update restrict not valid;

alter table public.deals drop constraint deals_client_id_fkey;
alter table public.deals add constraint deals_client_id_fkey
  foreign key (company_id, client_id) references public.clients (company_id, id)
  on delete restrict on update restrict not valid;

alter table public.deals drop constraint deals_owner_staff_id_fkey;
alter table public.deals add constraint deals_owner_staff_id_fkey
  foreign key (company_id, owner_staff_id) references public.staff (company_id, id)
  on delete set null (owner_staff_id) on update restrict not valid;

-- ---------------------------------------------------------------------
-- document_stars
-- ---------------------------------------------------------------------
alter table public.document_stars drop constraint document_stars_document_id_fkey;
alter table public.document_stars add constraint document_stars_document_id_fkey
  foreign key (company_id, document_id) references public.documents (company_id, id)
  on delete cascade on update restrict not valid;

alter table public.document_stars drop constraint document_stars_staff_id_fkey;
alter table public.document_stars add constraint document_stars_staff_id_fkey
  foreign key (company_id, staff_id) references public.staff (company_id, id)
  on delete cascade on update restrict not valid;

-- ---------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------
alter table public.documents drop constraint documents_client_id_fkey;
alter table public.documents add constraint documents_client_id_fkey
  foreign key (company_id, client_id) references public.clients (company_id, id)
  on delete set null (client_id) on update restrict not valid;

alter table public.documents drop constraint documents_deal_id_fkey;
alter table public.documents add constraint documents_deal_id_fkey
  foreign key (company_id, deal_id) references public.deals (company_id, id)
  on delete set null (deal_id) on update restrict not valid;

alter table public.documents drop constraint documents_folder_id_fkey;
alter table public.documents add constraint documents_folder_id_fkey
  foreign key (company_id, folder_id) references public.document_folders (company_id, id)
  on delete set null (folder_id) on update restrict not valid;

alter table public.documents drop constraint documents_job_event_id_fkey;
alter table public.documents add constraint documents_job_event_id_fkey
  foreign key (company_id, job_event_id) references public.calendar_events (company_id, id)
  on delete set null (job_event_id) on update restrict not valid;

alter table public.documents drop constraint documents_owner_staff_id_fkey;
alter table public.documents add constraint documents_owner_staff_id_fkey
  foreign key (company_id, owner_staff_id) references public.staff (company_id, id)
  on delete set null (owner_staff_id) on update restrict not valid;

alter table public.documents drop constraint documents_staff_id_fkey;
alter table public.documents add constraint documents_staff_id_fkey
  foreign key (company_id, staff_id) references public.staff (company_id, id)
  on delete cascade on update restrict not valid;

-- ---------------------------------------------------------------------
-- invoice_line_items
-- ---------------------------------------------------------------------
alter table public.invoice_line_items drop constraint invoice_line_items_invoice_id_fkey;
alter table public.invoice_line_items add constraint invoice_line_items_invoice_id_fkey
  foreign key (company_id, invoice_id) references public.invoices (company_id, id)
  on delete cascade on update restrict not valid;

alter table public.invoice_line_items drop constraint invoice_line_items_source_fkey;
alter table public.invoice_line_items add constraint invoice_line_items_source_fkey
  foreign key (company_id, source_quote_line_item_id) references public.quote_line_items (company_id, id)
  on delete set null (source_quote_line_item_id) on update restrict not valid;

-- ---------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------
alter table public.invoices drop constraint invoices_client_id_fkey;
alter table public.invoices add constraint invoices_client_id_fkey
  foreign key (company_id, client_id) references public.clients (company_id, id)
  on delete restrict on update restrict not valid;

alter table public.invoices drop constraint invoices_deal_id_fkey;
alter table public.invoices add constraint invoices_deal_id_fkey
  foreign key (company_id, deal_id) references public.deals (company_id, id)
  on delete set null (deal_id) on update restrict not valid;

alter table public.invoices drop constraint invoices_issued_by_staff_id_fkey;
alter table public.invoices add constraint invoices_issued_by_staff_id_fkey
  foreign key (company_id, issued_by_staff_id) references public.staff (company_id, id)
  on delete set null (issued_by_staff_id) on update restrict not valid;

alter table public.invoices drop constraint invoices_quote_id_fkey;
alter table public.invoices add constraint invoices_quote_id_fkey
  foreign key (company_id, quote_id) references public.quotes (company_id, id)
  on delete set null (quote_id) on update restrict not valid;

alter table public.invoices drop constraint invoices_tax_rate_id_fkey;
alter table public.invoices add constraint invoices_tax_rate_id_fkey
  foreign key (company_id, tax_rate_id) references public.tax_rates (company_id, id)
  on delete set null (tax_rate_id) on update restrict not valid;

-- ---------------------------------------------------------------------
-- quote_line_items
-- ---------------------------------------------------------------------
alter table public.quote_line_items drop constraint quote_line_items_fee_catalog_id_fkey;
alter table public.quote_line_items add constraint quote_line_items_fee_catalog_id_fkey
  foreign key (company_id, fee_catalog_id) references public.fee_catalog (company_id, id)
  on delete set null (fee_catalog_id) on update restrict not valid;

alter table public.quote_line_items drop constraint quote_line_items_quote_id_fkey;
alter table public.quote_line_items add constraint quote_line_items_quote_id_fkey
  foreign key (company_id, quote_id) references public.quotes (company_id, id)
  on delete cascade on update restrict not valid;

-- ---------------------------------------------------------------------
-- quotes  (D3: deal_id_fkey pairs with deals_accepted_quote_id_fkey above)
-- ---------------------------------------------------------------------
alter table public.quotes drop constraint quotes_client_id_fkey;
alter table public.quotes add constraint quotes_client_id_fkey
  foreign key (company_id, client_id) references public.clients (company_id, id)
  on delete set null (client_id) on update restrict not valid;

alter table public.quotes drop constraint quotes_deal_id_fkey;
alter table public.quotes add constraint quotes_deal_id_fkey
  foreign key (company_id, deal_id) references public.deals (company_id, id)
  on delete restrict on update restrict not valid;

alter table public.quotes drop constraint quotes_owner_staff_id_fkey;
alter table public.quotes add constraint quotes_owner_staff_id_fkey
  foreign key (company_id, owner_staff_id) references public.staff (company_id, id)
  on delete set null (owner_staff_id) on update restrict not valid;

alter table public.quotes drop constraint quotes_prepared_by_staff_id_fkey;
alter table public.quotes add constraint quotes_prepared_by_staff_id_fkey
  foreign key (company_id, prepared_by_staff_id) references public.staff (company_id, id)
  on delete set null (prepared_by_staff_id) on update restrict not valid;

alter table public.quotes drop constraint quotes_rate_card_id_fkey;
alter table public.quotes add constraint quotes_rate_card_id_fkey
  foreign key (company_id, rate_card_id) references public.rate_cards (company_id, id)
  on delete set null (rate_card_id) on update restrict not valid;

alter table public.quotes drop constraint quotes_tax_rate_id_fkey;
alter table public.quotes add constraint quotes_tax_rate_id_fkey
  foreign key (company_id, tax_rate_id) references public.tax_rates (company_id, id)
  on delete set null (tax_rate_id) on update restrict not valid;

-- ---------------------------------------------------------------------
-- role_permission_sets
--
-- role_id_fkey becomes composite. permission_set_id_fkey is left
-- single-column, deliberately: permission_sets is a global catalog, not
-- a tenant table. Named in the 0020 guard.
-- ---------------------------------------------------------------------
alter table public.role_permission_sets drop constraint role_permission_sets_role_id_fkey;
alter table public.role_permission_sets add constraint role_permission_sets_role_id_fkey
  foreign key (company_id, role_id) references public.roles (company_id, id)
  on delete cascade on update restrict not valid;

-- ---------------------------------------------------------------------
-- roles  (D3: owner_staff_id_fkey pairs with staff_role_id_fkey below)
-- ---------------------------------------------------------------------
alter table public.roles drop constraint roles_owner_staff_id_fkey;
alter table public.roles add constraint roles_owner_staff_id_fkey
  foreign key (company_id, owner_staff_id) references public.staff (company_id, id)
  on delete set null (owner_staff_id) on update restrict not valid;

-- ---------------------------------------------------------------------
-- staff
--
-- role_id_fkey becomes composite. auth_user_id_fkey is left
-- single-column, deliberately: auth.users is not tenant-scoped and has
-- no company_id. Named in the 0020 guard. Do not conflate this with
-- staff_auth_user_id_key above, which DID go composite -- same column,
-- opposite treatment, because one is a uniqueness rule this schema owns
-- and the other targets a table outside the tenant boundary entirely.
-- ---------------------------------------------------------------------
alter table public.staff drop constraint staff_role_id_fkey;
alter table public.staff add constraint staff_role_id_fkey
  foreign key (company_id, role_id) references public.roles (company_id, id)
  on delete restrict on update restrict not valid;

-- ---------------------------------------------------------------------
-- staff_locations
-- ---------------------------------------------------------------------
alter table public.staff_locations drop constraint staff_locations_staff_id_fkey;
alter table public.staff_locations add constraint staff_locations_staff_id_fkey
  foreign key (company_id, staff_id) references public.staff (company_id, id)
  on delete cascade on update restrict not valid;

alter table public.staff_locations drop constraint staff_locations_warehouse_location_id_fkey;
alter table public.staff_locations add constraint staff_locations_warehouse_location_id_fkey
  foreign key (company_id, warehouse_location_id) references public.warehouse_locations (company_id, id)
  on delete restrict on update restrict not valid;

-- ---------------------------------------------------------------------
-- staff_profiles
-- ---------------------------------------------------------------------
alter table public.staff_profiles drop constraint staff_profiles_manager_staff_id_fkey;
alter table public.staff_profiles add constraint staff_profiles_manager_staff_id_fkey
  foreign key (company_id, manager_staff_id) references public.staff (company_id, id)
  on delete set null (manager_staff_id) on update restrict not valid;

alter table public.staff_profiles drop constraint staff_profiles_primary_location_id_fkey;
alter table public.staff_profiles add constraint staff_profiles_primary_location_id_fkey
  foreign key (company_id, primary_location_id) references public.warehouse_locations (company_id, id)
  on delete set null (primary_location_id) on update restrict not valid;

alter table public.staff_profiles drop constraint staff_profiles_staff_id_fkey;
alter table public.staff_profiles add constraint staff_profiles_staff_id_fkey
  foreign key (company_id, staff_id) references public.staff (company_id, id)
  on delete cascade on update restrict not valid;

alter table public.staff_profiles drop constraint staff_profiles_updated_by_staff_id_fkey;
alter table public.staff_profiles add constraint staff_profiles_updated_by_staff_id_fkey
  foreign key (company_id, updated_by_staff_id) references public.staff (company_id, id)
  on delete set null (updated_by_staff_id) on update restrict not valid;

-- ---------------------------------------------------------------------
-- staff_profiles_sensitive
-- ---------------------------------------------------------------------
alter table public.staff_profiles_sensitive drop constraint staff_profiles_sensitive_staff_id_fkey;
alter table public.staff_profiles_sensitive add constraint staff_profiles_sensitive_staff_id_fkey
  foreign key (company_id, staff_id) references public.staff (company_id, id)
  on delete cascade on update restrict not valid;

-- ---------------------------------------------------------------------
-- storage_agreements
-- ---------------------------------------------------------------------
alter table public.storage_agreements drop constraint storage_agreements_client_id_fkey;
alter table public.storage_agreements add constraint storage_agreements_client_id_fkey
  foreign key (company_id, client_id) references public.clients (company_id, id)
  on delete restrict on update restrict not valid;

alter table public.storage_agreements drop constraint storage_agreements_warehouse_location_id_fkey;
alter table public.storage_agreements add constraint storage_agreements_warehouse_location_id_fkey
  foreign key (company_id, warehouse_location_id) references public.warehouse_locations (company_id, id)
  on delete restrict on update restrict not valid;

-- ---------------------------------------------------------------------
-- vaults
-- ---------------------------------------------------------------------
alter table public.vaults drop constraint vaults_storage_agreement_id_fkey;
alter table public.vaults add constraint vaults_storage_agreement_id_fkey
  foreign key (company_id, storage_agreement_id) references public.storage_agreements (company_id, id)
  on delete set null (storage_agreement_id) on update restrict not valid;

alter table public.vaults drop constraint vaults_warehouse_location_id_fkey;
alter table public.vaults add constraint vaults_warehouse_location_id_fkey
  foreign key (company_id, warehouse_location_id) references public.warehouse_locations (company_id, id)
  on delete restrict on update restrict not valid;

-- =====================================================================
-- Step 3: validate every FK left NOT VALID above. Kept as one loop, not
-- 48 individual VALIDATE statements, so a violation still names exactly
-- one constraint (the loop stops at the first failure) without the file
-- itself growing another 48 lines that carry no new information.
-- =====================================================================
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
