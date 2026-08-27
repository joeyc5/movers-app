-- =====================================================================
-- 0008_rls_policies.sql
-- Row-level security policies for all 26 public tables plus
-- app.code_counters.
--
-- RLS itself was enabled in the file that created each table (D12), so
-- every table has been deny-by-default since it existed. This file adds
-- the policies that let anyone in. Table GRANTS are 0009: a policy is
-- not a grant, and the two failure modes are deliberately kept in
-- separate files because they are separately diagnosable --
-- `42501 permission denied for table X` is a grant problem, and
-- `succeeds, 0 rows, no error` is a policy problem.
--
-- =====================================================================
-- D1 IS THE WHOLE POINT OF THIS FILE. READS ARE BROAD.
-- =====================================================================
--
-- Every operational table is readable by any ACTIVE staff member. Not
-- because the roles do not matter, but because a permission-gated READ
-- in THIS app is invisible. Measured against the 9 seeded roles and the
-- 27 seeded staff:
--
--   * gating `deals` on PA[pipeline,leads,billing] blanks /dashboard/sales
--     for 16 of 27 people and turns the dashboard's "Booked Revenue This
--     Month" card from $21,100 into $0
--   * gating `documents` visibility='team' on has_perm('documents')
--     leaves 20 of 27 people looking at only the files they personally
--     own -- Ana Delgado (Driver) sees zero of the fifteen
--   * src/navigation/sidebar/sidebar-items.ts is a flat static array
--     with no `permission` field and no filtering, so all seven nav
--     items render for every role
--   * no screen in the repo has an "you do not have access" empty state
--
-- A LEFT JOIN to a table the caller cannot read returns NULL, it does
-- not raise. So each of those ships as a blank screen with no error --
-- the single hardest symptom in this system to diagnose, chosen
-- deliberately. Do not reintroduce it.
--
-- WRITES stay permission-gated per role, and that is where the 9 roles
-- do their work. `app.has_any_perm(sets, true)` short-circuits on
-- access_level = 'Full' (Owner, Admin) and returns false for
-- access_level = 'Read only' whatever sets that role holds.
--
-- THE ONE READ EXCEPTION IS STAFF PII. public.staff_profiles_sensitive
-- (date of birth, home address, personal email, emergency contact) is
-- self-or-has_perm('users') and nothing may widen it. The non-sensitive
-- half, public.staff_profiles, is broad-read: it is the staff directory
-- (job title, department, manager, work phone, leave calendar) and the
-- columns D1 named as restricted were moved out of it in 0002. The
-- "INTENDED POLICY" comment written on that table in 0002 predates this
-- decision; the `comment on table` at the foot of this file replaces it.
--
-- =====================================================================
-- PERFORMANCE CONTRACT: EVERY FUNCTION CALL IN A PREDICATE IS WRAPPED
-- =====================================================================
--
-- `(select app.has_perm('clients'))`, never `app.has_perm('clients')`.
-- Measured on 20,000 rows: 506.1 ms as a per-row `Filter:` versus 3.7 ms
-- as an `InitPlan`. The rule is not specific to auth.uid() -- it applies
-- to any function in a policy predicate. There is no bare `auth.uid()`
-- anywhere in this file because no policy calls it directly; the four
-- predicate helpers in 0001 already wrap it as `(select auth.uid())`
-- inside their own bodies, which is where it needs to be.
--
-- Every policy is `TO authenticated`. Without the role clause the
-- predicate is also evaluated for `anon`, which holds nothing.
--
-- THE INITPLAN FORM IS ALL-ROWS-OR-NONE PER TABLE, BY DESIGN.
-- `using ((select app.is_active_staff()))` does not vary by row. That is
-- the correct semantic for a single-company internal CRM and it is what
-- makes the 136x available. The per-row policies -- staff self-row,
-- staff_profiles_sensitive, documents visibility, document_stars --
-- genuinely reference row columns and compare them against an
-- InitPlan'd scalar. Do not let anyone "simplify" those into the
-- all-or-nothing form, and do not let anyone expand the others into
-- per-row form.
--
-- =====================================================================
-- CROSS-CUTTING RULE
-- =====================================================================
--
-- RLS gates the CALLER's status = 'Active'. It must NEVER filter a
-- REFERENCED staff row by status. Sofia Marchetti is Deactivated and is
-- the account owner on CLT-1007, CLT-1010, CLT-1014, CLT-1018 and
-- CLT-1022, owns DEAL-3004/3009/3015, and is SUR-5003's estimator. Any
-- predicate that requires the referenced staff row to be active silently
-- drops those rows.
-- =====================================================================


-- =====================================================================
-- app.is_active_writer()
--
-- The fifth predicate helper, and it exists to close exactly one hole.
--
-- `app.is_active_staff()` is true for the three Read-only staff. The
-- documents INSERT gate below is deliberately NOT has_perm('documents'),
-- for the reason set out in the documents section, so without this
-- helper a Read-only account could upload files -- and "Read only ...
-- never write" is what access_level means.
--
-- SECURITY DEFINER for the same two reasons the 0001 helpers are: it
-- bypasses RLS, so a policy that reads staff cannot recurse, and one
-- function serves every caller.
-- =====================================================================
create or replace function app.is_active_writer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    join public.roles r on r.id = s.role_id
    where s.auth_user_id = (select auth.uid())
      and s.status = 'Active'
      and r.access_level <> 'Read only'
  )
$$;

comment on function app.is_active_writer() is
  'True when the caller is active staff whose role may write at all (access_level <> ''Read only''). The floor under any write gate that is not tied to a specific permission set.';

-- Explicit grants only. ALTER DEFAULT PRIVILEGES does not strip EXECUTE
-- from the PUBLIC pseudo-role, and PUBLIC EXECUTE on a SECURITY DEFINER
-- function is the classic escalation vector.
revoke all on function app.is_active_writer() from public, anon, authenticated;
grant execute on function app.is_active_writer() to authenticated;


-- =====================================================================
-- PLATFORM
-- =====================================================================

-- ---------------------------------------------------------------------
-- warehouse_locations -- global reference data.
-- ---------------------------------------------------------------------
create policy warehouse_locations_select on public.warehouse_locations
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy warehouse_locations_insert on public.warehouse_locations
  for insert to authenticated
  with check ( (select app.has_perm('settings', true)) );

create policy warehouse_locations_update on public.warehouse_locations
  for update to authenticated
  using      ( (select app.has_perm('settings', true)) )
  with check ( (select app.has_perm('settings', true)) );

create policy warehouse_locations_delete on public.warehouse_locations
  for delete to authenticated
  using ( (select app.has_perm('settings', true)) );

-- ---------------------------------------------------------------------
-- permission_sets / roles / role_permission_sets
--
-- SELECT-ONLY FOR authenticated, WITH NO EXCEPTIONS, and the absence of
-- a write policy here is load-bearing rather than an oversight.
--
-- If a Scoped user can UPDATE roles.access_level to 'Full', or INSERT a
-- row into role_permission_sets, they escalate to every permission in
-- the system without ever touching the staff table. There is no policy
-- that makes that safe, so there is no policy. Role editing goes through
-- an RPC gated on has_perm('settings', true); 0009 backs this up by
-- granting only SELECT, so both layers deny independently.
-- ---------------------------------------------------------------------
create policy permission_sets_select on public.permission_sets
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy roles_select on public.roles
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy role_permission_sets_select on public.role_permission_sets
  for select to authenticated
  using ( (select app.is_active_staff()) );

-- ---------------------------------------------------------------------
-- staff
--
-- SELECT is broad: the app resolves owner names, estimator names and
-- crew rosters on nearly every screen.
--
-- There is NO INSERT policy and NO DELETE policy. Creating an employee
-- is public.admin_create_staff / admin_invite_staff; removing one is a
-- status change to 'Deactivated', never a DELETE (calendar_event_crew's
-- FK is ON DELETE RESTRICT precisely so you cannot erase who worked a
-- completed move).
--
-- THE ESCALATION THIS PAIR OF LAYERS CLOSES, measured:
--
--   With a plain "staff may edit their own row" policy and a table-wide
--   GRANT UPDATE, a Driver ran
--     update staff set role_id = (select id from roles where slug='owner')
--      where id = (select app.current_staff_id());
--   and came back as access_level 'Full'. Using only the publishable key
--   and their own session.
--
-- The policy below is NOT the fix and cannot be: policies cannot express
-- column granularity. The fix is the column grant in 0009 --
-- `grant update (full_name, avatar_url) on public.staff to authenticated`
-- and nothing else -- so role_id, status, auth_user_id and work_email are
-- unreachable by direct DML for everyone, Full access included. Those
-- four move only through the audited SECURITY DEFINER RPCs in 0006.
--
-- The self branch carries no is_active_writer() gate on purpose. Editing
-- your own display name and avatar is identity, not company data, and a
-- Read-only account that cannot fix the spelling of its own name is a
-- silently-failing form.
-- ---------------------------------------------------------------------
create policy staff_select on public.staff
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy staff_update on public.staff
  for update to authenticated
  using      ( id = (select app.current_staff_id())
               or (select app.has_perm('users', true)) )
  with check ( id = (select app.current_staff_id())
               or (select app.has_perm('users', true)) );

-- ---------------------------------------------------------------------
-- staff_profiles -- the staff DIRECTORY. Broad read (D1).
--
-- Job title, department, manager, work phone, work pattern, leave
-- calendar. The columns D1 restricts -- date of birth, home address,
-- personal email, emergency contact -- are not in this table; 0002 split
-- them into staff_profiles_sensitive precisely so this half could be
-- opened without carrying them along.
-- ---------------------------------------------------------------------
create policy staff_profiles_select on public.staff_profiles
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy staff_profiles_insert on public.staff_profiles
  for insert to authenticated
  with check ( staff_id = (select app.current_staff_id())
               or (select app.has_perm('users', true)) );

create policy staff_profiles_update on public.staff_profiles
  for update to authenticated
  using      ( staff_id = (select app.current_staff_id())
               or (select app.has_perm('users', true)) )
  with check ( staff_id = (select app.current_staff_id())
               or (select app.has_perm('users', true)) );

-- Deleting an HR record is not a self-service action, unlike editing it.
create policy staff_profiles_delete on public.staff_profiles
  for delete to authenticated
  using ( (select app.has_perm('users', true)) );

-- ---------------------------------------------------------------------
-- staff_profiles_sensitive -- THE ONE READ EXCEPTION IN THE SCHEMA.
--
-- Date of birth, home address, personal email, emergency contact.
-- Self or has_perm('users'). A Dispatcher must never be able to read a
-- colleague's date of birth, and nothing in this file or any later one
-- may widen this predicate. When compensation becomes real data it lands
-- in THIS table, behind THIS policy.
--
-- Genuinely per-row: `staff_id = <InitPlan'd scalar>` is one function
-- evaluation plus a primary-key comparison. Do not "optimize" it into
-- the all-or-nothing form -- that would hand every reader every row.
-- ---------------------------------------------------------------------
create policy staff_profiles_sensitive_select on public.staff_profiles_sensitive
  for select to authenticated
  using ( staff_id = (select app.current_staff_id())
          or (select app.has_perm('users')) );

create policy staff_profiles_sensitive_insert on public.staff_profiles_sensitive
  for insert to authenticated
  with check ( staff_id = (select app.current_staff_id())
               or (select app.has_perm('users', true)) );

create policy staff_profiles_sensitive_update on public.staff_profiles_sensitive
  for update to authenticated
  using      ( staff_id = (select app.current_staff_id())
               or (select app.has_perm('users', true)) )
  with check ( staff_id = (select app.current_staff_id())
               or (select app.has_perm('users', true)) );

create policy staff_profiles_sensitive_delete on public.staff_profiles_sensitive
  for delete to authenticated
  using ( (select app.has_perm('users', true)) );

-- ---------------------------------------------------------------------
-- staff_locations -- who works where. Read broad, written by HR.
-- ---------------------------------------------------------------------
create policy staff_locations_select on public.staff_locations
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy staff_locations_insert on public.staff_locations
  for insert to authenticated
  with check ( (select app.has_perm('users', true)) );

create policy staff_locations_update on public.staff_locations
  for update to authenticated
  using      ( (select app.has_perm('users', true)) )
  with check ( (select app.has_perm('users', true)) );

create policy staff_locations_delete on public.staff_locations
  for delete to authenticated
  using ( (select app.has_perm('users', true)) );


-- =====================================================================
-- CRM
-- =====================================================================

-- ---------------------------------------------------------------------
-- clients
--
-- The canonical D1 case. A Driver holds jobs/dispatch/fleet and no
-- `clients`. Gate the READ and their job card loses the customer name
-- and the delivery address, silently, through a LEFT JOIN. Broad read.
-- ---------------------------------------------------------------------
create policy clients_select on public.clients
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy clients_insert on public.clients
  for insert to authenticated
  with check ( (select app.has_perm('clients', true)) );

create policy clients_update on public.clients
  for update to authenticated
  using      ( (select app.has_perm('clients', true)) )
  with check ( (select app.has_perm('clients', true)) );

create policy clients_delete on public.clients
  for delete to authenticated
  using ( (select app.has_perm('clients', true)) );

-- ---------------------------------------------------------------------
-- rate_cards / crew_rates / fee_catalog / tax_rates
--
-- Pricing reference data. Every quote screen reads it; only Settings
-- writes it.
-- ---------------------------------------------------------------------
create policy rate_cards_select on public.rate_cards
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy rate_cards_insert on public.rate_cards
  for insert to authenticated
  with check ( (select app.has_perm('settings', true)) );

create policy rate_cards_update on public.rate_cards
  for update to authenticated
  using      ( (select app.has_perm('settings', true)) )
  with check ( (select app.has_perm('settings', true)) );

create policy rate_cards_delete on public.rate_cards
  for delete to authenticated
  using ( (select app.has_perm('settings', true)) );

create policy crew_rates_select on public.crew_rates
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy crew_rates_insert on public.crew_rates
  for insert to authenticated
  with check ( (select app.has_perm('settings', true)) );

create policy crew_rates_update on public.crew_rates
  for update to authenticated
  using      ( (select app.has_perm('settings', true)) )
  with check ( (select app.has_perm('settings', true)) );

create policy crew_rates_delete on public.crew_rates
  for delete to authenticated
  using ( (select app.has_perm('settings', true)) );

create policy fee_catalog_select on public.fee_catalog
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy fee_catalog_insert on public.fee_catalog
  for insert to authenticated
  with check ( (select app.has_perm('settings', true)) );

create policy fee_catalog_update on public.fee_catalog
  for update to authenticated
  using      ( (select app.has_perm('settings', true)) )
  with check ( (select app.has_perm('settings', true)) );

create policy fee_catalog_delete on public.fee_catalog
  for delete to authenticated
  using ( (select app.has_perm('settings', true)) );

create policy tax_rates_select on public.tax_rates
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy tax_rates_insert on public.tax_rates
  for insert to authenticated
  with check ( (select app.has_perm('settings', true)) );

create policy tax_rates_update on public.tax_rates
  for update to authenticated
  using      ( (select app.has_perm('settings', true)) )
  with check ( (select app.has_perm('settings', true)) );

create policy tax_rates_delete on public.tax_rates
  for delete to authenticated
  using ( (select app.has_perm('settings', true)) );

-- ---------------------------------------------------------------------
-- deals
--
-- Read broad. The Dashboard's "Booked Revenue This Month" card sums
-- deals.estimated_value on a page every one of the 27 people lands on,
-- and PA[pipeline,leads,billing] would show 16 of them $0.
--
-- Write is PA[pipeline,leads], which is the Sales Rep role plus Full.
-- ---------------------------------------------------------------------
create policy deals_select on public.deals
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy deals_insert on public.deals
  for insert to authenticated
  with check ( (select app.has_any_perm(array['pipeline','leads'], true)) );

create policy deals_update on public.deals
  for update to authenticated
  using      ( (select app.has_any_perm(array['pipeline','leads'], true)) )
  with check ( (select app.has_any_perm(array['pipeline','leads'], true)) );

create policy deals_delete on public.deals
  for delete to authenticated
  using ( (select app.has_any_perm(array['pipeline','leads'], true)) );

-- ---------------------------------------------------------------------
-- quotes / quote_line_items
--
-- The write set is array['proposals','pipeline'] and it must stay
-- byte-identical to the gate inside public.next_quote_code(), which
-- raises 42501 on `not app.has_any_perm(array['proposals','pipeline'],
-- true)`. If the two ever diverge, a rep passes the policy, gets a row
-- started, and then takes a hard 42501 from the code minter -- a failure
-- halfway through a create.
-- ---------------------------------------------------------------------
create policy quotes_select on public.quotes
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy quotes_insert on public.quotes
  for insert to authenticated
  with check ( (select app.has_any_perm(array['proposals','pipeline'], true)) );

create policy quotes_update on public.quotes
  for update to authenticated
  using      ( (select app.has_any_perm(array['proposals','pipeline'], true)) )
  with check ( (select app.has_any_perm(array['proposals','pipeline'], true)) );

create policy quotes_delete on public.quotes
  for delete to authenticated
  using ( (select app.has_any_perm(array['proposals','pipeline'], true)) );

create policy quote_line_items_select on public.quote_line_items
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy quote_line_items_insert on public.quote_line_items
  for insert to authenticated
  with check ( (select app.has_any_perm(array['proposals','pipeline'], true)) );

create policy quote_line_items_update on public.quote_line_items
  for update to authenticated
  using      ( (select app.has_any_perm(array['proposals','pipeline'], true)) )
  with check ( (select app.has_any_perm(array['proposals','pipeline'], true)) );

create policy quote_line_items_delete on public.quote_line_items
  for delete to authenticated
  using ( (select app.has_any_perm(array['proposals','pipeline'], true)) );

-- ---------------------------------------------------------------------
-- company_billing_profile -- the invoice 'From' block, one row, id = 1.
--
-- D1 puts this in the broad-read set and that is what ships. The
-- column comment in 0003 calls the read "permission-gated"; D1 is
-- binding and supersedes it. The reasoning holds up: this is the
-- company's OWN remittance block, printed verbatim on the face of every
-- invoice the company sends, not a customer's bank details. Gating it
-- renders a blank From block on a tab that is always visible.
--
-- No DELETE policy: there is exactly one row and the singleton CHECK
-- exists to keep it that way.
-- ---------------------------------------------------------------------
create policy company_billing_profile_select on public.company_billing_profile
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy company_billing_profile_insert on public.company_billing_profile
  for insert to authenticated
  with check ( (select app.has_perm('settings', true)) );

create policy company_billing_profile_update on public.company_billing_profile
  for update to authenticated
  using      ( (select app.has_perm('settings', true)) )
  with check ( (select app.has_perm('settings', true)) );

-- ---------------------------------------------------------------------
-- invoices / invoice_line_items
--
-- Read broad. The client detail page at
-- src/app/(main)/dashboard/clients/[id]/page.tsx renders an
-- unconditional <TabsTrigger value="invoices">, so a gated read gives a
-- Sales Rep an empty table on a tab he can always click.
--
-- The write set array['invoices','billing'] must stay byte-identical to
-- the gate inside public.next_invoice_code(), for the same reason as
-- quotes above.
-- ---------------------------------------------------------------------
create policy invoices_select on public.invoices
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy invoices_insert on public.invoices
  for insert to authenticated
  with check ( (select app.has_any_perm(array['invoices','billing'], true)) );

create policy invoices_update on public.invoices
  for update to authenticated
  using      ( (select app.has_any_perm(array['invoices','billing'], true)) )
  with check ( (select app.has_any_perm(array['invoices','billing'], true)) );

create policy invoices_delete on public.invoices
  for delete to authenticated
  using ( (select app.has_any_perm(array['invoices','billing'], true)) );

create policy invoice_line_items_select on public.invoice_line_items
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy invoice_line_items_insert on public.invoice_line_items
  for insert to authenticated
  with check ( (select app.has_any_perm(array['invoices','billing'], true)) );

create policy invoice_line_items_update on public.invoice_line_items
  for update to authenticated
  using      ( (select app.has_any_perm(array['invoices','billing'], true)) )
  with check ( (select app.has_any_perm(array['invoices','billing'], true)) );

create policy invoice_line_items_delete on public.invoice_line_items
  for delete to authenticated
  using ( (select app.has_any_perm(array['invoices','billing'], true)) );


-- =====================================================================
-- OPERATIONS
-- =====================================================================

-- ---------------------------------------------------------------------
-- storage_agreements / vaults
--
-- Both feed public.vaults_expanded and public.storage_agreements_expanded,
-- which are security_invoker = true. A view reads as the caller, so the
-- caller owes a SELECT policy AND a SELECT grant on every base table the
-- view touches -- vaults, storage_agreements, warehouse_locations,
-- clients, staff. Broad read is what makes those four views work at all;
-- a gate on any one of them turns the whole Warehouse tab into zero
-- rows with no error.
-- ---------------------------------------------------------------------
create policy storage_agreements_select on public.storage_agreements
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy storage_agreements_insert on public.storage_agreements
  for insert to authenticated
  with check ( (select app.has_any_perm(array['storage','vaults'], true)) );

create policy storage_agreements_update on public.storage_agreements
  for update to authenticated
  using      ( (select app.has_any_perm(array['storage','vaults'], true)) )
  with check ( (select app.has_any_perm(array['storage','vaults'], true)) );

create policy storage_agreements_delete on public.storage_agreements
  for delete to authenticated
  using ( (select app.has_any_perm(array['storage','vaults'], true)) );

create policy vaults_select on public.vaults
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy vaults_insert on public.vaults
  for insert to authenticated
  with check ( (select app.has_any_perm(array['storage','vaults'], true)) );

create policy vaults_update on public.vaults
  for update to authenticated
  using      ( (select app.has_any_perm(array['storage','vaults'], true)) )
  with check ( (select app.has_any_perm(array['storage','vaults'], true)) );

create policy vaults_delete on public.vaults
  for delete to authenticated
  using ( (select app.has_any_perm(array['storage','vaults'], true)) );

-- ---------------------------------------------------------------------
-- calendar_events / calendar_event_crew
--
-- One table holds dispatch jobs, dispatch surveys and office events, so
-- the write gate spans the three sets that legitimately touch a
-- schedule: calendar (Sales Rep books a survey), dispatch (Dispatcher
-- and Crew Lead move a job), jobs (Driver marks a job In Progress).
-- ---------------------------------------------------------------------
create policy calendar_events_select on public.calendar_events
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy calendar_events_insert on public.calendar_events
  for insert to authenticated
  with check ( (select app.has_any_perm(array['calendar','dispatch','jobs'], true)) );

create policy calendar_events_update on public.calendar_events
  for update to authenticated
  using      ( (select app.has_any_perm(array['calendar','dispatch','jobs'], true)) )
  with check ( (select app.has_any_perm(array['calendar','dispatch','jobs'], true)) );

create policy calendar_events_delete on public.calendar_events
  for delete to authenticated
  using ( (select app.has_any_perm(array['calendar','dispatch','jobs'], true)) );

create policy calendar_event_crew_select on public.calendar_event_crew
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy calendar_event_crew_insert on public.calendar_event_crew
  for insert to authenticated
  with check ( (select app.has_any_perm(array['calendar','dispatch','jobs'], true)) );

create policy calendar_event_crew_update on public.calendar_event_crew
  for update to authenticated
  using      ( (select app.has_any_perm(array['calendar','dispatch','jobs'], true)) )
  with check ( (select app.has_any_perm(array['calendar','dispatch','jobs'], true)) );

create policy calendar_event_crew_delete on public.calendar_event_crew
  for delete to authenticated
  using ( (select app.has_any_perm(array['calendar','dispatch','jobs'], true)) );


-- =====================================================================
-- DOCUMENTS
-- =====================================================================

-- ---------------------------------------------------------------------
-- document_folders -- six flat folders, an operational taxonomy.
-- ---------------------------------------------------------------------
create policy document_folders_select on public.document_folders
  for select to authenticated
  using ( (select app.is_active_staff()) );

create policy document_folders_insert on public.document_folders
  for insert to authenticated
  with check ( (select app.has_perm('documents', true)) );

create policy document_folders_update on public.document_folders
  for update to authenticated
  using      ( (select app.has_perm('documents', true)) )
  with check ( (select app.has_perm('documents', true)) );

create policy document_folders_delete on public.document_folders
  for delete to authenticated
  using ( (select app.has_perm('documents', true)) );

-- ---------------------------------------------------------------------
-- documents
--
-- ===== THE SEEDED-OWNER CONTRADICTION, AND HOW IT IS RESOLVED ========
--
-- The obvious INSERT gate is has_perm('documents', true). Only Crew Lead
-- holds `documents` among the eight non-Full roles, so that gate says:
-- 6 of the 12 seeded file-manager documents could not have been created
-- by the person the seed records as their owner.
--
--   Elena Torres     Dispatcher       owns BOTH bills of lading
--   Sam Okafor       Sales Rep        Ruiz move estimate
--   Omar Haddad      Sales Rep        Weiss storage agreement
--   Renee Castillo   Billing Spec.    Storage billing August
--   Julia Ferreira   Warehouse Lead   Bellweather vault inventory
--
-- That is not bad seed data. A dispatcher fills out the bill of lading;
-- a warehouse lead writes the vault inventory; a billing specialist
-- exports the billing sheet. Producing the paperwork for the job you
-- just did is a function of every operational role in a moving company,
-- not a separate privilege. A gate that says otherwise is a gate that
-- would have to be worked around on day one.
--
-- SO THE PERMISSION SET IS REDEFINED, ONCE AND EXPLICITLY:
--
--   `documents` means MANAGE THE LIBRARY -- act on files you do not own
--   (rename, refile, retag, move to trash), and read `restricted` files.
--   It does NOT mean "may create a file".
--
--   Creating a file is `app.is_active_writer()` -- any active staff
--   member whose role is not Read only -- and only as YOURSELF. The
--   owner column must be your own staff id, or you must hold `documents`
--   and be filing on someone's behalf.
--
-- This resolves the contradiction without editing the seed, without
-- inventing a permission set, and without handing the library to
-- everyone: reassigning, retagging and trashing OTHER people's files
-- still needs `documents`.
--
-- The `staff_id` clause is the second half. staff_id scopes a document
-- to a person's HR record (the Profile > Documents tab). Planting a
-- document on a colleague's HR record is an HR action, so it needs
-- has_perm('users', true).
--
-- ===== READ =========================================================
--
-- D1: `visibility = 'team'` means EXACTLY app.is_active_staff(). That is
-- the column's own stated semantics in 0005, and gating it on
-- has_perm('documents') would show 7 of 27 people the shared library and
-- hand the other 20 an empty screen. Only 'restricted' is
-- permission-gated; 'private' is owner-only by omission.
--
-- The trash branch is deliberate. A soft delete you cannot see is a soft
-- delete you cannot undo, and 49 CFR 375.505(d) puts a one-year
-- retention floor on every bill of lading -- a hold you cannot inspect
-- is not a hold you can defend. Trashed rows stay readable by their
-- owner and by the library managers, and by nobody else. The app filters
-- `deleted_at is null` for the ordinary list.
--
-- ===== DELETE =======================================================
--
-- There is NO delete policy, and 0009 grants no DELETE. "Move to trash"
-- sets deleted_at. Hard delete past the retention window is a
-- service-role job, off the request path entirely.
-- ---------------------------------------------------------------------
create policy documents_select on public.documents
  for select to authenticated
  using (
    (
      deleted_at is null
      and (
           ( visibility = 'team'       and (select app.is_active_staff()) )
        or ( visibility = 'restricted' and (select app.has_perm('users')) )
        or owner_staff_id = (select app.current_staff_id())
        or staff_id       = (select app.current_staff_id())
      )
    )
    or (
      -- Trash and retention hold: owner or library manager only.
      deleted_at is not null
      and (
           owner_staff_id = (select app.current_staff_id())
        or (select app.has_perm('documents', true))
      )
    )
  );

create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    (select app.is_active_writer())
    and (
         owner_staff_id = (select app.current_staff_id())
      or (select app.has_perm('documents', true))
    )
    and (
         staff_id is null
      or staff_id = (select app.current_staff_id())
      or (select app.has_perm('users', true))
    )
  );

-- Symmetric using/with check. An owner who tries to hand a file to
-- somebody else fails the WITH CHECK (they are no longer the owner and
-- do not hold `documents`), which is the intended behaviour: giving away
-- a file is a library action.
create policy documents_update on public.documents
  for update to authenticated
  using      ( owner_staff_id = (select app.current_staff_id())
               or (select app.has_perm('documents', true)) )
  with check ( owner_staff_id = (select app.current_staff_id())
               or (select app.has_perm('documents', true)) );

-- ---------------------------------------------------------------------
-- document_stars -- strictly per viewer.
--
-- One `for all` policy because the rule genuinely is one rule for every
-- command: it is your row or it does not exist. No other staff member
-- may read it, which is why this cannot be folded into a broad-read
-- shape.
--
-- No is_active_writer() gate, deliberately. A star is the viewer's own
-- UI state, not company data, and a Read-only account with a star button
-- that silently does nothing is worse than one that works.
-- ---------------------------------------------------------------------
create policy document_stars_all on public.document_stars
  for all to authenticated
  using      ( staff_id = (select app.current_staff_id()) )
  with check ( staff_id = (select app.current_staff_id()) );


-- =====================================================================
-- app.code_counters -- NO POLICY, DELIBERATELY.
--
-- The 27th table. RLS is on (0006) and there is no policy and no grant,
-- so it is unreachable from PostgREST for anon and authenticated alike.
-- It is written only by public.next_quote_code() and
-- public.next_invoice_code(), which are SECURITY DEFINER owned by
-- postgres and therefore bypass both layers.
--
-- The security guard's "RLS enabled" assertion covers schema `app` as
-- well as `public`, but its "RLS on but no policy" assertion is scoped
-- to `public` for exactly this row. A policy here would be the defect,
-- not the fix.
-- =====================================================================


-- =====================================================================
-- Supersede the stale intent recorded on staff_profiles in 0002.
--
-- That table was created before D1 settled, and its comment still says
-- the intended predicate is "self OR has_perm(users)". It ships broad-
-- read. Leaving two contradictory statements in the catalog is how the
-- next person reintroduces the gate.
-- =====================================================================
comment on table public.staff_profiles is
  'The staff DIRECTORY: job title, department, manager, work pattern, leave calendar. BROAD READ for any active staff member (D1); written by self or has_perm(users). Date of birth, home address, personal email and emergency contact are NOT here -- they are in staff_profiles_sensitive, which is the one genuinely read-restricted table in the schema.';
