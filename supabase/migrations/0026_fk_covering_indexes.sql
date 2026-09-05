-- =====================================================================
-- 0026_fk_covering_indexes.sql
--
-- 0015_constraints.sql converted 48 single-column foreign keys to
-- composite (company_id, X) keys. 47 of them kept only the single-column
-- index that predated the change, which no longer covers a two-column FK,
-- so every parent-row UPDATE or DELETE sequentially scans the child table
-- to check the constraint. Free at current size; not free with real data.
--
-- The 48th, crew_rates_rate_card_id_fkey, is already covered by
-- crew_rates_company_card_crew_key.
--
-- Generated from pg_constraint, not by hand. Additive and idempotent.
-- =====================================================================

create index if not exists calendar_event_crew_company_calendar_event_id_idx on calendar_event_crew (company_id, calendar_event_id);
create index if not exists calendar_event_crew_company_staff_id_idx on calendar_event_crew (company_id, staff_id);
create index if not exists calendar_events_company_client_id_idx on calendar_events (company_id, client_id);
create index if not exists calendar_events_company_estimator_id_idx on calendar_events (company_id, estimator_id);
create index if not exists calendar_events_company_storage_agreement_id_idx on calendar_events (company_id, storage_agreement_id);
create index if not exists calendar_events_company_warehouse_location_id_idx on calendar_events (company_id, warehouse_location_id);
create index if not exists clients_company_account_owner_staff_id_idx on clients (company_id, account_owner_staff_id);
create index if not exists deals_company_accepted_quote_id_idx on deals (company_id, accepted_quote_id);
create index if not exists deals_company_client_id_idx on deals (company_id, client_id);
create index if not exists deals_company_owner_staff_id_idx on deals (company_id, owner_staff_id);
create index if not exists document_stars_company_document_id_idx on document_stars (company_id, document_id);
create index if not exists document_stars_company_staff_id_idx on document_stars (company_id, staff_id);
create index if not exists documents_company_client_id_idx on documents (company_id, client_id);
create index if not exists documents_company_deal_id_idx on documents (company_id, deal_id);
create index if not exists documents_company_folder_id_idx on documents (company_id, folder_id);
create index if not exists documents_company_job_event_id_idx on documents (company_id, job_event_id);
create index if not exists documents_company_owner_staff_id_idx on documents (company_id, owner_staff_id);
create index if not exists documents_company_staff_id_idx on documents (company_id, staff_id);
create index if not exists invoice_line_items_company_invoice_id_idx on invoice_line_items (company_id, invoice_id);
create index if not exists invoice_line_items_company_source_quote_line_item_id_idx on invoice_line_items (company_id, source_quote_line_item_id);
create index if not exists invoices_company_client_id_idx on invoices (company_id, client_id);
create index if not exists invoices_company_deal_id_idx on invoices (company_id, deal_id);
create index if not exists invoices_company_issued_by_staff_id_idx on invoices (company_id, issued_by_staff_id);
create index if not exists invoices_company_quote_id_idx on invoices (company_id, quote_id);
create index if not exists invoices_company_tax_rate_id_idx on invoices (company_id, tax_rate_id);
create index if not exists quote_line_items_company_fee_catalog_id_idx on quote_line_items (company_id, fee_catalog_id);
create index if not exists quote_line_items_company_quote_id_idx on quote_line_items (company_id, quote_id);
create index if not exists quotes_company_client_id_idx on quotes (company_id, client_id);
create index if not exists quotes_company_deal_id_idx on quotes (company_id, deal_id);
create index if not exists quotes_company_owner_staff_id_idx on quotes (company_id, owner_staff_id);
create index if not exists quotes_company_prepared_by_staff_id_idx on quotes (company_id, prepared_by_staff_id);
create index if not exists quotes_company_rate_card_id_idx on quotes (company_id, rate_card_id);
create index if not exists quotes_company_tax_rate_id_idx on quotes (company_id, tax_rate_id);
create index if not exists role_permission_sets_company_role_id_idx on role_permission_sets (company_id, role_id);
create index if not exists roles_company_owner_staff_id_idx on roles (company_id, owner_staff_id);
create index if not exists staff_company_role_id_idx on staff (company_id, role_id);
create index if not exists staff_locations_company_staff_id_idx on staff_locations (company_id, staff_id);
create index if not exists staff_locations_company_warehouse_location_id_idx on staff_locations (company_id, warehouse_location_id);
create index if not exists staff_profiles_company_manager_staff_id_idx on staff_profiles (company_id, manager_staff_id);
create index if not exists staff_profiles_company_primary_location_id_idx on staff_profiles (company_id, primary_location_id);
create index if not exists staff_profiles_company_staff_id_idx on staff_profiles (company_id, staff_id);
create index if not exists staff_profiles_company_updated_by_staff_id_idx on staff_profiles (company_id, updated_by_staff_id);
create index if not exists staff_profiles_sensitive_company_staff_id_idx on staff_profiles_sensitive (company_id, staff_id);
create index if not exists storage_agreements_company_client_id_idx on storage_agreements (company_id, client_id);
create index if not exists storage_agreements_company_warehouse_location_id_idx on storage_agreements (company_id, warehouse_location_id);
create index if not exists vaults_company_storage_agreement_id_idx on vaults (company_id, storage_agreement_id);
create index if not exists vaults_company_warehouse_location_id_idx on vaults (company_id, warehouse_location_id);
