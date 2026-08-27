-- =====================================================================
-- 0010_seed.sql
--
-- The seed. Every row the app renders today out of a static TypeScript
-- array, moved into Postgres with its human code preserved.
--
-- 3 warehouse locations, 16 permission sets, 9 roles, 27 staff,
-- 25 clients, 3 rate cards + 15 crew rates, 15 fee presets, 2 tax rates,
-- 1 company billing profile, 15 deals, 2 accepted quotes with 4 line
-- items, 6 storage agreements, 14 vaults, 21 calendar events with 14
-- crew assignments, 6 document folders, 15 documents, 3 stars.
--
-- ORDERED, AND SINGLE-PASS PAST STEP 13. Steps 1-12 and 14-17 are
-- upserts against REAL unique constraints (code, slug, work_email,
-- storage_path, and the composite primary keys on the join tables),
-- never a partial index, so those steps are genuinely re-runnable.
--
-- STEP 13 IS NOT. A second pass ABORTS at step 13(a) with
--
--     23505: duplicate key value violates unique constraint
--            "quotes_code_key"
--            Key (code)=(QTE-2026-0001) already exists.
--
-- Measured. The two quote INSERTs are plain INSERTs with no
-- `on conflict`, and QTE-2026-0001 collides before step 13(b) has
-- inserted a single line item -- so the quote_line_items freeze trigger
-- is NEVER REACHED on a re-run. An earlier version of this header said
-- the file "will REFUSE a second pass ... the freeze trigger doing
-- exactly what it was built to do"; that is not what happens and the
-- claim is corrected here so nobody debugs the wrong trigger.
--
-- The abort is clean: the whole migration runs in one transaction, so a
-- second pass rolls back and leaves nothing half-applied. To re-seed a
-- dirtied database, drop and recreate rather than re-running this file.
--
-- is_seed = true on every row (D11). The dev calendar reseeder scopes
-- every predicate on that flag and never on a code prefix, because real
-- app-created events mint codes in the same JOB-4xxx namespace.
--
-- WHAT IS DELIBERATELY NOT SEEDED, so nobody reads it as an omission:
--   * invoices / invoice_line_items. The repo's invoice is ephemeral
--     react-hook-form state with `items: []`. There is no seeded invoice
--     anywhere, and inventing an accounts-receivable ledger would be
--     fabrication, not migration. company_billing_profile IS seeded --
--     that one is real, hardcoded data (movingCompanyFromDetails).
--   * staff_profiles for 26 of the 27 people. The repo carries exactly
--     one ProfileRecord, Morgan Ellis's. The other 26 HR records do not
--     exist to migrate.
-- =====================================================================


-- =====================================================================
-- SEARCH PATH IS PINNED, AND IT IS A CORRECTNESS FIX, NOT TIDINESS.
--
-- staff.work_email and staff_profiles_sensitive.personal_email are
-- `extensions.citext`, and this file joins on them a dozen times
-- (`s.work_email = o.owner_email::extensions.citext` and friends).
--
-- The citext `=` OPERATOR lives in schema `extensions`, because 0001
-- installs the extension WITH SCHEMA extensions. Operators resolve
-- through the search_path, and the search_path in effect while a
-- migration is applied is not pinned. Off the path there is no visible
-- `=` for (citext, citext), so Postgres falls back through citext's
-- implicit cast to text and resolves `text = text` instead --
-- CASE-SENSITIVELY, AND WITH NO ERROR.
--
-- Measured on this project, same session, same expression:
--   set search_path = public;
--     'Sam.Okafor@example.com'::extensions.citext
--       = 'sam.okafor@example.com'::extensions.citext   -> false
--   set search_path = public, extensions;
--     the identical expression                          -> true
--
-- A dropped join row here does not raise. It inserts zero rows, and the
-- downstream assertions that count something else still pass. That is
-- the same silent-zero-rows failure this whole migration set was built
-- to avoid, arriving through the back door.
--
-- 0006's public.claim_staff_for_current_user() already works around the
-- same hazard from the other direction: it runs under
-- `set search_path = ''`, so it compares `lower(s.work_email::text) =
-- v_email` rather than trusting a bare citext operator. Same trap,
-- opposite fix. Neither is optional.
--
-- `reset search_path` at the foot of this file, so nothing applied after
-- it inherits a session setting it never asked for.
-- =====================================================================
set search_path = public, extensions;


-- =====================================================================
-- 1. Warehouse locations
--
-- `name` must stay byte-identical to the strings the location filters
-- compare against. sort_order reproduces the dropdown order the UI
-- ships today (Oakland, San Jose, Fremont), which alphabetical would
-- visibly reorder.
-- =====================================================================
insert into public.warehouse_locations (slug, name, sort_order, is_active, is_seed) values
  ('oakland-warehouse', 'Oakland Warehouse', 0, true, true),
  ('san-jose-branch',   'San Jose Branch',   1, true, true),
  ('fremont-depot',     'Fremont Depot',     2, true, true)
on conflict (slug) do update
  set name       = excluded.name,
      sort_order = excluded.sort_order,
      is_active  = excluded.is_active,
      is_seed    = excluded.is_seed;


-- =====================================================================
-- 2. Permission sets
--
-- The 16 distinct strings across the nine roles' permissionSets arrays.
-- app.has_any_perm validates its argument against `slug` and RAISES on
-- an unknown one, so these slugs are an API: 0006 already calls
-- has_any_perm('proposals','pipeline') and ('invoices','billing').
--
-- `description` is left NULL on purpose. The Permission sets tab renders
-- a placeholder today and inventing 16 descriptions would be writing
-- fiction into a reference table.
-- =====================================================================
insert into public.permission_sets (slug, name, is_seed) values
  ('users',     'Users',     true),
  ('settings',  'Settings',  true),
  ('billing',   'Billing',   true),
  ('reports',   'Reports',   true),
  ('clients',   'Clients',   true),
  ('dispatch',  'Dispatch',  true),
  ('jobs',      'Jobs',      true),
  ('fleet',     'Fleet',     true),
  ('calendar',  'Calendar',  true),
  ('pipeline',  'Pipeline',  true),
  ('leads',     'Leads',     true),
  ('proposals', 'Proposals', true),
  ('storage',   'Storage',   true),
  ('vaults',    'Vaults',    true),
  ('documents', 'Documents', true),
  ('invoices',  'Invoices',  true)
on conflict (slug) do update
  set name    = excluded.name,
      is_seed = excluded.is_seed;


-- =====================================================================
-- 3. Roles -- WITHOUT owner_staff_id.
--
-- Same cycle as D3, one level up in the data: roles.owner_staff_id
-- references staff, and staff.role_id references roles. Roles land
-- first with a NULL owner, staff lands second, then step 5 fills the
-- owners in. There is no ordering that avoids this.
--
-- is_system is extracted from the source's Role.owner === 'System'
-- (Owner and Read-only). group_label is GENERATED from status and
-- is_system and reproduces all nine seeded group strings exactly, so it
-- is not supplied here.
-- =====================================================================
insert into public.roles (slug, name, access_level, is_system, status, last_reviewed_on, is_seed) values
  ('owner',             'Owner',             'Full',      true,  'Needs review', date '2026-05-12', true),
  ('admin',             'Admin',             'Full',      false, 'Needs review', date '2026-05-15', true),
  ('driver',            'Driver',            'Scoped',    false, 'Needs review', date '2026-05-18', true),
  ('read-only',         'Read-only',         'Read only', true,  'Active',       date '2026-06-06', true),
  ('dispatcher',        'Dispatcher',        'Scoped',    false, 'Active',       date '2026-06-01', true),
  ('sales-rep',         'Sales Rep',         'Scoped',    false, 'Active',       date '2026-06-02', true),
  ('warehouse-lead',    'Warehouse Lead',    'Scoped',    false, 'Active',       date '2026-06-03', true),
  ('crew-lead',         'Crew Lead',         'Scoped',    false, 'Active',       date '2026-05-30', true),
  ('billing-specialist','Billing Specialist','Scoped',    false, 'Active',       date '2026-06-07', true)
on conflict (slug) do update
  set name             = excluded.name,
      access_level     = excluded.access_level,
      is_system        = excluded.is_system,
      status           = excluded.status,
      last_reviewed_on = excluded.last_reviewed_on,
      is_seed          = excluded.is_seed;


-- =====================================================================
-- 4. Staff -- 27 people.
--
-- 25 from the Users settings table, PLUS Morgan Ellis and Priya Shah,
-- who exist only in src/data/users.ts and appear in no user list. Morgan
-- is rootUser: the person the whole app is currently "logged in as",
-- with a full HR profile page, and until now not an employee anywhere in
-- the data. That is the incoherence this seed closes.
--
-- HEADCOUNT NOTE, stated so the change is not mistaken for a bug: the
-- roles table today carries a hand-maintained Role.users count summing
-- to 25. 0007's roles_expanded replaces it with COUNT(*) over staff, so
-- with Morgan (Admin) and Priya (Dispatcher) real, Admin reads 3 and
-- Dispatcher 4 and the nine counts sum to 27. Over the original 25
-- UserRow emails the split is still exactly 1/2/3/4/3/3/3/3/3 = 25;
-- the final assertion block checks both numbers separately.
--
-- joined_at: UserRow.joinedDate is a real clock time ('12 Jan 2021,
-- 8:00 AM'), read as America/Los_Angeles. Morgan's comes from
-- profile-data.ts startDate 'March 3, 2023'. Priya's is the ONLY
-- invented timestamp in this file -- src/data/users.ts carries no date
-- and the column is NOT NULL.
--
-- last_active_at: UserRow.lastActive is minutes-ago. The three 'Pending
-- invite' rows carry a 90*24*60 sentinel meaning "never", which is NULL
-- here rather than a fake 90-day-old instant. Priya has no activity
-- data at all, so NULL.
-- =====================================================================
insert into public.staff (full_name, work_email, role_id, team, status, joined_at, last_active_at, is_seed)
select
  s.full_name,
  s.work_email,
  r.id,
  s.team,
  s.status,
  s.joined_at,
  case when s.last_active_minutes is null then null
       else now() - make_interval(mins => s.last_active_minutes) end,
  true
from (values
  ('Grace Chen',      'grace.chen@example.com',      'owner',              'Leadership',          'Active',         timestamptz '2021-01-12 08:00 America/Los_Angeles', 0),
  ('Marcus Webb',     'marcus.webb@example.com',     'admin',              'HR & Admin',          'Active',         timestamptz '2022-03-03 09:15 America/Los_Angeles', 5),
  ('Elena Torres',    'elena.torres@example.com',    'dispatcher',         'Dispatch',            'Active',         timestamptz '2023-06-18 07:40 America/Los_Angeles', 12),
  ('Sam Okafor',      'sam.okafor@example.com',      'sales-rep',          'Sales',               'Active',         timestamptz '2023-02-22 13:20 America/Los_Angeles', 60),
  ('Julia Ferreira',  'julia.ferreira@example.com',  'warehouse-lead',     'Warehouse',           'Active',         timestamptz '2022-09-09 06:50 America/Los_Angeles', 20),
  ('Tyler Brooks',    'tyler.brooks@example.com',    'crew-lead',          'Fleet & Maintenance', 'Active',         timestamptz '2021-11-14 11:05 America/Los_Angeles', 90),
  ('Ana Delgado',     'ana.delgado@example.com',     'driver',             'Fleet & Maintenance', 'Active',         timestamptz '2023-07-30 05:30 America/Los_Angeles', 240),
  ('Derek Simmons',   'derek.simmons@example.com',   'dispatcher',         'Dispatch',            'Locked',         timestamptz '2022-05-05 14:10 America/Los_Angeles', 480),
  ('Fatima Rahman',   'fatima.rahman@example.com',   'sales-rep',          'Sales',               'Active',         timestamptz '2024-04-11 10:45 America/Los_Angeles', 15),
  ('Connor Blake',    'connor.blake@example.com',    'admin',              'HR & Admin',          'Pending invite', timestamptz '2024-06-20 15:15 America/Los_Angeles', null),
  ('Nadia Petrov',    'nadia.petrov@example.com',    'warehouse-lead',     'Warehouse',           'Active',         timestamptz '2022-10-01 08:25 America/Los_Angeles', 30),
  ('Wesley Grant',    'wesley.grant@example.com',    'driver',             'Fleet & Maintenance', 'Suspended',      timestamptz '2023-01-17 16:00 America/Los_Angeles', 11520),
  ('Renee Castillo',  'renee.castillo@example.com',  'billing-specialist', 'Billing',             'Active',         timestamptz '2022-12-25 09:35 America/Los_Angeles', 45),
  ('Omar Haddad',     'omar.haddad@example.com',     'sales-rep',          'Sales',               'Active',         timestamptz '2023-08-08 13:10 America/Los_Angeles', 1440),
  ('Lindsey Park',    'lindsey.park@example.com',    'read-only',          'Customer Service',    'Pending invite', timestamptz '2024-01-17 17:45 America/Los_Angeles', null),
  ('Miguel Santos',   'miguel.santos@example.com',   'crew-lead',          'Fleet & Maintenance', 'Active',         timestamptz '2021-10-02 07:15 America/Los_Angeles', 6),
  ('Brianna Cole',    'brianna.cole@example.com',    'dispatcher',         'Dispatch',            'Active',         timestamptz '2023-05-22 06:30 America/Los_Angeles', 10),
  ('Jason Kwan',      'jason.kwan@example.com',      'read-only',          'Customer Service',    'Active',         timestamptz '2022-07-14 18:05 America/Los_Angeles', 240),
  ('Sofia Marchetti', 'sofia.marchetti@example.com', 'sales-rep',          'Sales',               'Deactivated',    timestamptz '2021-11-26 15:40 America/Los_Angeles', 30240),
  ('Trevor Lang',     'trevor.lang@example.com',     'driver',             'Fleet & Maintenance', 'Active',         timestamptz '2023-04-11 09:05 America/Los_Angeles', 18),
  ('Aisha Bello',     'aisha.bello@example.com',     'warehouse-lead',     'Warehouse',           'Active',         timestamptz '2022-09-09 12:25 America/Los_Angeles', 2880),
  ('Dylan Whitfield', 'dylan.whitfield@example.com', 'billing-specialist', 'Billing',             'Active',         timestamptz '2022-12-05 14:15 America/Los_Angeles', 0),
  ('Camille Roux',    'camille.roux@example.com',    'crew-lead',          'Fleet & Maintenance', 'Active',         timestamptz '2024-06-18 16:50 America/Los_Angeles', 7),
  ('Isaac Bergstrom', 'isaac.bergstrom@example.com', 'read-only',          'Customer Service',    'Active',         timestamptz '2024-02-07 19:20 America/Los_Angeles', 60),
  ('Paige Donovan',   'paige.donovan@example.com',   'billing-specialist', 'Billing',             'Pending invite', timestamptz '2024-04-29 11:55 America/Los_Angeles', null),
  -- src/data/users.ts only, absent from the 25 UserRows.
  ('Morgan Ellis',    'morgan.ellis@example.com',    'admin',              'Dispatch',            'Active',         timestamptz '2023-03-03 08:00 America/Los_Angeles', 0),
  ('Priya Shah',      'priya.shah@example.com',      'dispatcher',         'Dispatch',            'Active',         timestamptz '2024-02-05 07:30 America/Los_Angeles', null)
) as s(full_name, work_email, role_slug, team, status, joined_at, last_active_minutes)
join public.roles r on r.slug = s.role_slug
on conflict (work_email) do update
  set full_name      = excluded.full_name,
      role_id        = excluded.role_id,
      team           = excluded.team,
      status         = excluded.status,
      joined_at      = excluded.joined_at,
      last_active_at = excluded.last_active_at,
      is_seed        = excluded.is_seed;


-- =====================================================================
-- 5. Close the roles -> staff cycle.
--
-- Owner and Read-only carry the literal owner string 'System' in the
-- source, which is exactly what owner_staff_id IS NULL means here and
-- what roles_expanded renders back as 'System'. The other seven are
-- named people.
-- =====================================================================
update public.roles r
   set owner_staff_id = s.id
from (values
  ('admin',              'grace.chen@example.com'),
  ('driver',             'grace.chen@example.com'),
  ('dispatcher',         'grace.chen@example.com'),
  ('crew-lead',          'grace.chen@example.com'),
  ('sales-rep',          'marcus.webb@example.com'),
  ('warehouse-lead',     'marcus.webb@example.com'),
  ('billing-specialist', 'marcus.webb@example.com')
) as o(role_slug, owner_email)
join public.staff s on s.work_email = o.owner_email::extensions.citext
where r.slug = o.role_slug;


-- =====================================================================
-- 6. Staff to warehouse assignment.
--
-- `position` preserves UserRow.location array order, which is visible:
-- the Users table renders only the FIRST location as an avatar plus a
-- '+N' count.
-- =====================================================================
insert into public.staff_locations (staff_id, warehouse_location_id, position, is_seed)
select st.id, wl.id, l.position, true
from (values
  ('grace.chen@example.com',      'oakland-warehouse', 0),
  ('grace.chen@example.com',      'san-jose-branch',   1),
  ('grace.chen@example.com',      'fremont-depot',     2),
  ('marcus.webb@example.com',     'oakland-warehouse', 0),
  ('elena.torres@example.com',    'san-jose-branch',   0),
  ('sam.okafor@example.com',      'oakland-warehouse', 0),
  ('julia.ferreira@example.com',  'fremont-depot',     0),
  ('tyler.brooks@example.com',    'oakland-warehouse', 0),
  ('tyler.brooks@example.com',    'fremont-depot',     1),
  ('ana.delgado@example.com',     'san-jose-branch',   0),
  ('derek.simmons@example.com',   'oakland-warehouse', 0),
  ('fatima.rahman@example.com',   'san-jose-branch',   0),
  ('connor.blake@example.com',    'oakland-warehouse', 0),
  ('nadia.petrov@example.com',    'oakland-warehouse', 0),
  ('wesley.grant@example.com',    'fremont-depot',     0),
  ('renee.castillo@example.com',  'oakland-warehouse', 0),
  ('omar.haddad@example.com',     'fremont-depot',     0),
  ('lindsey.park@example.com',    'san-jose-branch',   0),
  ('miguel.santos@example.com',   'oakland-warehouse', 0),
  ('brianna.cole@example.com',    'san-jose-branch',   0),
  ('brianna.cole@example.com',    'fremont-depot',     1),
  ('jason.kwan@example.com',      'oakland-warehouse', 0),
  ('sofia.marchetti@example.com', 'oakland-warehouse', 0),
  ('trevor.lang@example.com',     'san-jose-branch',   0),
  ('aisha.bello@example.com',     'fremont-depot',     0),
  ('dylan.whitfield@example.com', 'oakland-warehouse', 0),
  ('camille.roux@example.com',    'san-jose-branch',   0),
  ('isaac.bergstrom@example.com', 'fremont-depot',     0),
  ('paige.donovan@example.com',   'san-jose-branch',   0),
  -- Morgan's workplace is 'On-site - Warehouse HQ', which is not one of
  -- the three seeded names. Oakland is the HQ site in every other row.
  ('morgan.ellis@example.com',    'oakland-warehouse', 0),
  ('priya.shah@example.com',      'san-jose-branch',   0)
) as l(work_email, location_slug, position)
join public.staff st                on st.work_email = l.work_email::extensions.citext
join public.warehouse_locations wl  on wl.slug = l.location_slug
on conflict (staff_id, warehouse_location_id) do update
  set position = excluded.position,
      is_seed  = excluded.is_seed;


-- =====================================================================
-- 7. Role to permission-set grants.
--
-- `position` preserves the source array order, which is presentation:
-- the roles table renders permissionSets.slice(0, 3) as badges and '+N'
-- for the rest, so which three are visible is data.
-- =====================================================================
insert into public.role_permission_sets (role_id, permission_set_id, position, is_seed)
select r.id, p.id, g.position, true
from (values
  ('owner','users',0),('owner','settings',1),('owner','billing',2),
  ('owner','reports',3),('owner','clients',4),('owner','dispatch',5),

  ('admin','users',0),('admin','settings',1),('admin','reports',2),
  ('admin','billing',3),('admin','clients',4),

  ('driver','jobs',0),('driver','dispatch',1),('driver','fleet',2),

  ('read-only','clients',0),('read-only','jobs',1),('read-only','reports',2),

  ('dispatcher','dispatch',0),('dispatcher','jobs',1),('dispatcher','fleet',2),
  ('dispatcher','clients',3),('dispatcher','calendar',4),

  ('sales-rep','clients',0),('sales-rep','pipeline',1),('sales-rep','leads',2),
  ('sales-rep','proposals',3),('sales-rep','calendar',4),

  ('warehouse-lead','storage',0),('warehouse-lead','vaults',1),
  ('warehouse-lead','clients',2),('warehouse-lead','reports',3),

  ('crew-lead','jobs',0),('crew-lead','dispatch',1),('crew-lead','fleet',2),
  ('crew-lead','documents',3),

  ('billing-specialist','billing',0),('billing-specialist','invoices',1),
  ('billing-specialist','clients',2),('billing-specialist','reports',3)
) as g(role_slug, set_slug, position)
join public.roles r           on r.slug = g.role_slug
join public.permission_sets p on p.slug = g.set_slug
on conflict (role_id, permission_set_id) do update
  set position = excluded.position,
      is_seed  = excluded.is_seed;


-- =====================================================================
-- 8. Morgan Ellis's HR profile.
--
-- The repo carries exactly one ProfileRecord and this is it. Every
-- string that was three facts in one field is split here:
--   'Monday-Friday / 7:00 AM-4:00 PM' -> work_days + start + end
--   'Pacific Time (UTC-7)'            -> the IANA zone (the offset is a
--                                        DST artifact, wrong 5 months a
--                                        year, and is rendered, not
--                                        stored)
--   remainingLeave '12 days'          -> not stored; it is GENERATED as
--                                        20 + 0 - 8 and can never drift
--
-- manager_staff_id is left NULL ON PURPOSE. The source names
-- 'Devon Park, VP of Operations', who exists in no staff list, no user
-- table, and nowhere else in the repo. A migration writes facts that
-- outlive it: guessing a manager would put a person's reporting line
-- into the database on no evidence. NULL is legal, obvious, and takes a
-- human five seconds to correct.
-- =====================================================================
insert into public.staff_profiles (
  staff_id, preferred_name, legal_name, pronouns, work_phone,
  job_title, job_level, department, current_project,
  work_arrangement, primary_location_id, time_zone,
  employee_ref, employment_type, weekly_hours,
  work_days, work_start_time, work_end_time,
  contracting_entity, notice_period_days, manager_staff_id, bio,
  leave_policy, annual_leave_days, carried_over_leave_days,
  used_leave_days, scheduled_leave_days, pending_leave_requests,
  leave_year_start, leave_year_end, next_leave_start, next_leave_end,
  last_working_day, updated_by_staff_id, is_seed)
select
  st.id, 'Morgan', 'Morgan Ellis', 'They / them', '+1 (628) 555-0142',
  'Operations Manager', 'Senior', 'Operations', 'Peak Season Readiness',
  'On-site', wl.id, 'America/Los_Angeles',
  'OPS-2301', 'Contractor', 40.00,
  array[1,2,3,4,5]::smallint[], time '07:00', time '16:00',
  'Self-employed', 14, null,
  'Morgan runs day-to-day operations: dispatch, warehouse storage, and crew scheduling. Most days start at the dispatch board and end with a walk through the warehouse floor, checking vault occupancy and confirming next week''s crews. Morgan works closest with sales during quoting and with the crews once a job is on the calendar.',
  'Contractor time-off allowance', 20, 0,
  8, 3, 0,
  date '2026-01-01', date '2026-12-31', date '2026-09-14', date '2026-09-18',
  date '2027-02-28', st.id, true
from public.staff st
cross join lateral (
  select id from public.warehouse_locations where slug = 'oakland-warehouse'
) wl
where st.work_email = 'morgan.ellis@example.com'::extensions.citext
on conflict (staff_id) do update
  set job_title = excluded.job_title,
      is_seed   = excluded.is_seed;

insert into public.staff_profiles_sensitive (
  staff_id, date_of_birth, home_address, personal_email,
  emergency_contact_name, emergency_contact_relationship,
  emergency_contact_phone, is_seed)
select
  st.id, date '1988-06-12', '215 Bayshore Ave, Oakland, CA 94621',
  'm.ellis@example.com', 'Dana Ellis', 'Spouse', '+1 (628) 555-0177', true
from public.staff st
where st.work_email = 'morgan.ellis@example.com'::extensions.citext
on conflict (staff_id) do update
  set date_of_birth = excluded.date_of_birth,
      is_seed       = excluded.is_seed;


-- =====================================================================
-- 9. Clients -- 25 accounts, CLT-1001 .. CLT-1025.
--
-- account_owner_staff_id resolves the four seeded rep names against
-- staff. Sofia Marchetti is 'Deactivated' and owns five of these
-- (CLT-1007, 1010, 1014, 1018, 1022), which is why neither this FK nor
-- any owner filter built from it may require active status.
--
-- The origin/destination address groups are all-or-nothing by CHECK.
-- Eight clients carry no origin at all and three carry an origin with no
-- destination -- that last shape is 'goods came from here and now sit in
-- a vault', which is real data, not a gap.
-- =====================================================================
insert into public.clients (
  code, name, type, status, primary_contact_name, email, phone,
  billing_street, billing_city, billing_state, billing_zip,
  origin_street, origin_city, origin_state, origin_zip,
  destination_street, destination_city, destination_state, destination_zip,
  account_owner_staff_id, created_date, last_activity_date, notes, is_seed)
select
  c.code, c.name, c.type, c.status, c.contact, c.email, c.phone,
  c.b_street, c.b_city, c.b_state, c.b_zip,
  c.o_street, c.o_city, c.o_state, c.o_zip,
  c.d_street, c.d_city, c.d_state, c.d_zip,
  st.id, c.created_date, c.last_activity_date, c.notes, true
from (values
  ('CLT-1001','Danielle Ruiz','Residential','Active','Danielle Ruiz','danielle.ruiz@example.com','(408) 555-0142',
   '214 Willow Ave','San Jose','CA','95125',
   '214 Willow Ave','San Jose','CA','95125',
   '88 Harbor View Dr','Redwood City','CA','94065',
   'sam.okafor@example.com', date '2026-05-02', date '2026-08-14', 'Requested extra padding for a piano.'),
  ('CLT-1002','Bellweather Logistics','Commercial','In Storage','Marcus Yee','marcus.yee@example.com','(510) 555-0178',
   '4400 Distribution Way','Oakland','CA','94621',
   null,null,null,null, null,null,null,null,
   'omar.haddad@example.com', date '2025-11-19', date '2026-08-20', 'Overflow inventory, quarterly billing.'),
  ('CLT-1003','Priya Nair','Residential','Lead','Priya Nair','priya.nair@example.com','(650) 555-0193',
   '77 Alma St','Palo Alto','CA','94301',
   null,null,null,null, null,null,null,null,
   'fatima.rahman@example.com', date '2026-08-10', date '2026-08-22', null),
  ('CLT-1004','Whitfield & Sons Law','Commercial','Past','Georgia Whitfield','georgia.whitfield@example.com','(408) 555-0111',
   '900 Market St, Suite 4','San Jose','CA','95113',
   '900 Market St, Suite 4','San Jose','CA','95113',
   '1200 Corporate Center Dr','Sunnyvale','CA','94089',
   'sam.okafor@example.com', date '2025-03-14', date '2025-06-02', null),
  ('CLT-1005','Owen Fitzgerald','Residential','Active','Owen Fitzgerald','owen.fitzgerald@example.com','(925) 555-0164',
   '56 Ridgeline Ct','Walnut Creek','CA','94596',
   '56 Ridgeline Ct','Walnut Creek','CA','94596',
   '310 Bayshore Blvd','Concord','CA','94520',
   'omar.haddad@example.com', date '2026-07-28', date '2026-08-21', null),
  ('CLT-1006','Harborline Dental Group','Commercial','Active','Dr. Renata Silva','renata.silva@example.com','(510) 555-0129',
   '220 Broadway','Oakland','CA','94607',
   '220 Broadway','Oakland','CA','94607',
   '48 Telegraph Ave','Berkeley','CA','94704',
   'fatima.rahman@example.com', date '2026-06-11', date '2026-08-19', null),
  ('CLT-1007','Marcus Ainsley','Residential','Inactive','Marcus Ainsley','marcus.ainsley@example.com','(408) 555-0157',
   '1180 Foxworthy Ave','San Jose','CA','95118',
   null,null,null,null, null,null,null,null,
   'sofia.marchetti@example.com', date '2025-09-05', date '2025-09-22', 'Move postponed indefinitely, follow up next quarter.'),
  ('CLT-1008','Lena Brandt','Residential','In Storage','Lena Brandt','lena.brandt@example.com','(650) 555-0136',
   '39 Cedar Ln','San Mateo','CA','94402',
   '39 Cedar Ln','San Mateo','CA','94402',
   null,null,null,null,
   'omar.haddad@example.com', date '2026-02-27', date '2026-08-05', null),
  ('CLT-1009','Ferro Metalworks','Commercial','Active','Diego Ferro','diego.ferro@example.com','(510) 555-0182',
   '3300 Industrial Pkwy','Hayward','CA','94545',
   '3300 Industrial Pkwy','Hayward','CA','94545',
   '5000 Warehouse Row','Fremont','CA','94538',
   'sam.okafor@example.com', date '2026-04-16', date '2026-08-17', null),
  ('CLT-1010','Yusuf Karimi','Residential','Lead','Yusuf Karimi','yusuf.karimi@example.com','(408) 555-0148',
   '812 Blossom Hill Rd','San Jose','CA','95123',
   null,null,null,null, null,null,null,null,
   'sofia.marchetti@example.com', date '2026-08-18', date '2026-08-23', null),
  ('CLT-1011','Chen Family Trust','Residential','Past','Grace Chen','grace.chen.trust@example.com','(650) 555-0121',
   '1900 University Ave','Palo Alto','CA','94303',
   '1900 University Ave','Palo Alto','CA','94303',
   '700 Alma Real Dr','Mountain View','CA','94040',
   'fatima.rahman@example.com', date '2025-05-30', date '2025-07-11', null),
  ('CLT-1012','Bright Horizon Preschool','Commercial','Active','Tasha Freeman','tasha.freeman@example.com','(925) 555-0173',
   '601 School House Rd','Pleasanton','CA','94588',
   '601 School House Rd','Pleasanton','CA','94588',
   '88 Learning Ln','Dublin','CA','94568',
   'omar.haddad@example.com', date '2026-07-01', date '2026-08-16', null),
  ('CLT-1013','Isabel Moreno','Residential','Active','Isabel Moreno','isabel.moreno@example.com','(408) 555-0165',
   '45 Meridian Ave','San Jose','CA','95126',
   '45 Meridian Ave','San Jose','CA','95126',
   '220 Castro St','Mountain View','CA','94041',
   'sam.okafor@example.com', date '2026-08-02', date '2026-08-24', null),
  ('CLT-1014','Redline Auto Detailing','Commercial','Inactive','Carlos Nunez','carlos.nunez@example.com','(510) 555-0159',
   '2100 Auto Mall Pkwy','Fremont','CA','94538',
   null,null,null,null, null,null,null,null,
   'sofia.marchetti@example.com', date '2025-12-08', date '2026-01-15', 'Lost to a competitor''s bid, revisit in a year.'),
  ('CLT-1015','Harold Weiss','Residential','In Storage','Harold Weiss','harold.weiss@example.com','(650) 555-0187',
   '12 Sea Cliff Ter','San Mateo','CA','94404',
   '12 Sea Cliff Ter','San Mateo','CA','94404',
   null,null,null,null,
   'fatima.rahman@example.com', date '2026-01-22', date '2026-08-09', null),
  ('CLT-1016','Odessa Fields','Residential','Lead','Odessa Fields','odessa.fields@example.com','(408) 555-0174',
   '930 Coleman Ave','Santa Clara','CA','95050',
   null,null,null,null, null,null,null,null,
   'omar.haddad@example.com', date '2026-08-19', date '2026-08-25', null),
  ('CLT-1017','Nguyen & Park Orthodontics','Commercial','Active','Dr. Kevin Park','kevin.park@example.com','(408) 555-0198',
   '2777 Stevens Creek Blvd','San Jose','CA','95128',
   '2777 Stevens Creek Blvd','San Jose','CA','95128',
   '10 Almaden Blvd','San Jose','CA','95113',
   'sam.okafor@example.com', date '2026-03-25', date '2026-08-12', null),
  ('CLT-1018','Theodore Banks','Residential','Past','Theodore Banks','theodore.banks@example.com','(925) 555-0142',
   '76 Oak Grove Rd','Concord','CA','94518',
   '76 Oak Grove Rd','Concord','CA','94518',
   '410 Ygnacio Valley Rd','Walnut Creek','CA','94596',
   'sofia.marchetti@example.com', date '2025-08-04', date '2025-09-01', null),
  ('CLT-1019','Amara Okonkwo','Residential','Active','Amara Okonkwo','amara.okonkwo@example.com','(510) 555-0166',
   '515 Grand Ave','Oakland','CA','94610',
   '515 Grand Ave','Oakland','CA','94610',
   '1400 Shattuck Ave','Berkeley','CA','94709',
   'fatima.rahman@example.com', date '2026-08-05', date '2026-08-23', null),
  ('CLT-1020','Cascade Wealth Advisors','Commercial','Lead','Brian Holt','brian.holt@example.com','(650) 555-0129',
   '400 Concar Dr','San Mateo','CA','94402',
   null,null,null,null, null,null,null,null,
   'omar.haddad@example.com', date '2026-08-21', date '2026-08-25', 'Wants a weekend move to avoid business downtime.'),
  ('CLT-1021','Rosalind Pierce','Residential','Inactive','Rosalind Pierce','rosalind.pierce@example.com','(408) 555-0119',
   '660 Saratoga Ave','San Jose','CA','95129',
   null,null,null,null, null,null,null,null,
   'sam.okafor@example.com', date '2025-10-17', date '2025-11-02', null),
  ('CLT-1022','Milestone Physical Therapy','Commercial','Active','Jordan Alvarez','jordan.alvarez@example.com','(510) 555-0144',
   '39500 Stevenson Pl','Fremont','CA','94539',
   '39500 Stevenson Pl','Fremont','CA','94539',
   '43000 Mission Blvd','Fremont','CA','94539',
   'sofia.marchetti@example.com', date '2026-05-20', date '2026-08-13', null),
  ('CLT-1023','Felix Duarte','Residential','In Storage','Felix Duarte','felix.duarte@example.com','(408) 555-0177',
   '205 Vine Ave','Sunnyvale','CA','94086',
   '205 Vine Ave','Sunnyvale','CA','94086',
   null,null,null,null,
   'omar.haddad@example.com', date '2026-03-09', date '2026-08-07', null),
  ('CLT-1024','Greenline Landscaping','Commercial','Past','Walter Meyers','walter.meyers@example.com','(925) 555-0188',
   '1100 Contra Costa Blvd','Concord','CA','94520',
   '1100 Contra Costa Blvd','Concord','CA','94520',
   '2200 Monument Blvd','Concord','CA','94520',
   'fatima.rahman@example.com', date '2025-06-27', date '2025-08-15', null),
  ('CLT-1025','Sasha Petrov','Residential','Active','Sasha Petrov','sasha.petrov@example.com','(650) 555-0155',
   '88 Alameda de las Pulgas','Redwood City','CA','94062',
   '88 Alameda de las Pulgas','Redwood City','CA','94062',
   '301 Ravenswood Ave','Menlo Park','CA','94025',
   'sam.okafor@example.com', date '2026-08-15', date '2026-08-24', null)
) as c(code, name, type, status, contact, email, phone,
       b_street, b_city, b_state, b_zip,
       o_street, o_city, o_state, o_zip,
       d_street, d_city, d_state, d_zip,
       owner_email, created_date, last_activity_date, notes)
left join public.staff st on st.work_email = c.owner_email::extensions.citext
on conflict (code) do update
  set name                   = excluded.name,
      type                   = excluded.type,
      status                 = excluded.status,
      account_owner_staff_id = excluded.account_owner_staff_id,
      last_activity_date     = excluded.last_activity_date,
      is_seed                = excluded.is_seed;


-- =====================================================================
-- 10. Pricing reference data.
--
-- Three rate cards rather than one, so effective_from / effective_to /
-- is_default are load-bearing rather than decorative: a retired 2025
-- residential card, and separate 2026 residential and commercial cards.
-- The commercial card is why a crew of six can be priced at $125 a mover
-- while a crew of four on the residential card is $75 -- two rates on
-- one card would have to invent a per-mover curve that rises with crew
-- size, which is not how either card works.
-- =====================================================================
insert into public.rate_cards (code, name, effective_from, effective_to, is_default, is_seed) values
  ('RC-2025-RES', '2025 Residential Rates', date '2025-01-01', date '2025-12-31', false, true),
  ('RC-2026-RES', '2026 Residential Rates', date '2026-01-01', null,              true,  true),
  ('RC-2026-COM', '2026 Commercial Rates',  date '2026-01-01', null,              false, true)
on conflict (code) do update
  set name           = excluded.name,
      effective_from = excluded.effective_from,
      effective_to   = excluded.effective_to,
      is_default     = excluded.is_default,
      is_seed        = excluded.is_seed;

-- MEASURED, and the number the design docs get wrong: crew 4 at $75 a
-- mover, 3h minimum, 8h overtime threshold, x1.5 gives 900 at 2h,
-- 1500 at 5h and 3300 at 10h. The design's 585 / 975 / 2145 are each
-- exactly 0.65x those. The formula was always right; only the arithmetic
-- in prose was wrong.
insert into public.crew_rates (rate_card_id, crew_size, hourly_rate_per_mover, min_hours, ot_threshold_hours, ot_multiplier, is_seed)
select rc.id, x.crew_size, x.rate, x.min_hours, 8, 1.5, true
from (values
  ('RC-2025-RES', 2,  60.00, 3.0),
  ('RC-2025-RES', 3,  65.00, 3.0),
  ('RC-2025-RES', 4,  70.00, 3.0),
  ('RC-2025-RES', 5,  80.00, 3.0),
  ('RC-2025-RES', 6,  90.00, 3.0),
  ('RC-2026-RES', 2,  65.00, 3.0),
  ('RC-2026-RES', 3,  70.00, 3.0),
  ('RC-2026-RES', 4,  75.00, 3.0),
  ('RC-2026-RES', 5,  85.00, 3.0),
  ('RC-2026-RES', 6,  95.00, 3.0),
  ('RC-2026-COM', 3, 105.00, 4.0),
  ('RC-2026-COM', 4, 115.00, 4.0),
  ('RC-2026-COM', 5, 120.00, 4.0),
  ('RC-2026-COM', 6, 125.00, 4.0),
  ('RC-2026-COM', 8, 135.00, 4.0)
) as x(card_code, crew_size, rate, min_hours)
join public.rate_cards rc on rc.code = x.card_code
on conflict (rate_card_id, crew_size) do update
  set hourly_rate_per_mover = excluded.hourly_rate_per_mover,
      min_hours             = excluded.min_hours,
      is_seed               = excluded.is_seed;

-- D10 IS THE POINT OF THE `taxable` COLUMN. In California, moving labor
-- and the services around it are generally not taxable; the cartons and
-- packing materials you sell the customer are. Every service preset here
-- is taxable = false and every materials preset is taxable = true, which
-- is what makes the quote tax base a real calculation instead of
-- 8.75% of everything.
insert into public.fee_catalog (code, name, category, pricing_mode, default_rate, unit_label, taxable, sort_order, is_seed) values
  ('stairs',           'Stair carry',                  'accessorial', 'flat',             250.00, null,      false, 10, true),
  ('long-carry',       'Long carry',                   'accessorial', 'flat',             175.00, null,      false, 20, true),
  ('elevator',         'Elevator carry',               'accessorial', 'flat',             125.00, null,      false, 30, true),
  ('shuttle',          'Shuttle service',              'accessorial', 'per_hour',         150.00, 'hour',    false, 40, true),
  ('sit-handling',     'Storage-in-transit handling',  'accessorial', 'per_unit',          85.00, 'vault',   false, 50, true),
  ('carton-small',     'Small carton',                 'materials',   'per_unit',           4.50, 'carton',  true,  60, true),
  ('carton-medium',    'Medium carton',                'materials',   'per_unit',           6.75, 'carton',  true,  70, true),
  ('carton-dish',      'Dish pack carton',             'materials',   'per_unit',          12.50, 'carton',  true,  80, true),
  ('carton-wardrobe',  'Wardrobe carton',              'materials',   'per_unit',          18.00, 'carton',  true,  90, true),
  ('packing-supplies', 'Packing supplies',             'materials',   'flat',              95.00, null,      true, 100, true),
  ('piano',            'Piano handling',               'specialty',   'flat',             450.00, null,      false,110, true),
  ('safe',             'Safe handling',                'specialty',   'flat',             375.00, null,      false,120, true),
  ('appliance',        'Appliance service',            'specialty',   'flat',             145.00, null,      false,130, true),
  -- percent_of_labor carries a PERCENT, bounded to 100 by
  -- fee_catalog_percent_bound_check. Without that bound a rep typing 750
  -- makes a 7.5x-labor fuel surcharge and nothing catches it.
  ('fuel-surcharge',   'Fuel surcharge',               'surcharge',   'percent_of_labor',   3.20, 'percent', false,140, true),
  ('after-hours',      'Weekend / after-hours',        'surcharge',   'percent_of_labor',  10.00, 'percent', false,150, true)
on conflict (code) do update
  set name         = excluded.name,
      category     = excluded.category,
      pricing_mode = excluded.pricing_mode,
      default_rate = excluded.default_rate,
      unit_label   = excluded.unit_label,
      taxable      = excluded.taxable,
      sort_order   = excluded.sort_order,
      is_seed      = excluded.is_seed;

-- Codes match invoiceTaxOptions[].id verbatim so the existing Select
-- values keep resolving. is_default replaces the index-based
-- invoiceTaxOptions[0] default, where reordering the array silently
-- changes which tax a new invoice gets.
insert into public.tax_rates (code, name, rate_percent, is_active, is_default, is_seed) values
  ('ca-sales-tax', 'CA Sales Tax', 8.75, true, true,  true),
  ('none',         'No Tax',       0.00, true, false, true)
on conflict (code) do update
  set name         = excluded.name,
      rate_percent = excluded.rate_percent,
      is_default   = excluded.is_default,
      is_seed      = excluded.is_seed;


-- =====================================================================
-- 11. Company billing profile -- the invoice 'From' block.
--
-- Replaces the hardcoded movingCompanyFromDetails constant. issuerName
-- 'Morgan Ellis' is NOT copied here: it becomes invoices.issued_by_staff_id
-- per invoice, which is what makes it a person rather than a string that
-- matches rootUser by coincidence.
-- =====================================================================
insert into public.company_billing_profile (
  id, name, email, phone, website, address_line1, address_line2,
  tax_id, payment_account_name, routing_number, is_seed)
values (
  1, 'Movers CRM', 'billing@example.com', '(510) 555-0100', '',
  '1250 Marina Village Pkwy', 'Alameda, CA 94501',
  'EIN 68-0453921', 'Business Operating Account', '071925363', true)
on conflict (id) do update
  set name                 = excluded.name,
      email                = excluded.email,
      phone                = excluded.phone,
      website              = excluded.website,
      address_line1        = excluded.address_line1,
      address_line2        = excluded.address_line2,
      tax_id               = excluded.tax_id,
      payment_account_name = excluded.payment_account_name,
      routing_number       = excluded.routing_number,
      is_seed              = excluded.is_seed;


-- =====================================================================
-- 12. Deals -- 15, DEAL-3001 .. DEAL-3015.
--
-- Ten resolve to a seeded client by name; five (Meridian Title Co.,
-- Tessa Marlowe, Baywood Dental Partners, Colin Everhart, Northgate
-- Fitness) are unconverted prospects with no client record, which is why
-- deals.client_id is nullable and client_name is retained alongside it.
--
-- THE TWO WON DEALS LAND AT estimated_value = 0 ON PURPOSE. Their real
-- figures come from the quote-acceptance write-back in step 13. Seeding
-- 4200 and 16900 here would make the dashboard read correctly even if
-- the write-back never fired, which is precisely the silent failure the
-- final assertion block exists to catch.
--
-- board_position is source array order within a stage. There is no
-- UNIQUE on it, so a drag rewrites only the cards it moves.
-- =====================================================================
insert into public.deals (
  code, client_id, client_name, stage, priority, estimated_value,
  move_date, origin_city, destination_city, owner_staff_id,
  board_position, is_seed)
select
  d.code, c.id, d.client_name, d.stage, d.priority, d.estimated_value,
  d.move_date, d.origin_city, d.destination_city, st.id,
  d.board_position, true
from (values
  ('DEAL-3001','Priya Nair',              'CLT-1003','Discovery',    'Medium',  3200.00, date '2026-09-19','Palo Alto',   'San Jose',     'fatima.rahman@example.com',  0),
  ('DEAL-3002','Cascade Wealth Advisors', 'CLT-1020','Discovery',    'High',   18500.00, date '2026-10-03','San Mateo',   'Foster City',  'omar.haddad@example.com',    1),
  ('DEAL-3003','Odessa Fields',           'CLT-1016','Discovery',    'Low',     2100.00, null,             'Santa Clara', null,           'omar.haddad@example.com',    2),
  ('DEAL-3004','Yusuf Karimi',            'CLT-1010','Qualified',    'Medium',  2850.00, date '2026-09-12','San Jose',    'Fremont',      'sofia.marchetti@example.com',0),
  ('DEAL-3005','Meridian Title Co.',      null,      'Qualified',    'High',   12400.00, date '2026-10-17','San Jose',    'Campbell',     'sam.okafor@example.com',     1),
  ('DEAL-3006','Tessa Marlowe',           null,      'Qualified',    'Low',     1900.00, date '2026-09-26','Sunnyvale',   'Mountain View','fatima.rahman@example.com',  2),
  ('DEAL-3007','Amara Okonkwo',           'CLT-1019','Proposal Sent','Medium',  4600.00, date '2026-09-15','Oakland',     'Berkeley',     'fatima.rahman@example.com',  0),
  ('DEAL-3008','Baywood Dental Partners', null,      'Proposal Sent','High',   21800.00, date '2026-11-07','Hayward',     'San Leandro',  'sam.okafor@example.com',     1),
  ('DEAL-3009','Colin Everhart',          null,      'Proposal Sent','Low',     2400.00, date '2026-09-29','Walnut Creek','Lafayette',    'sofia.marchetti@example.com',2),
  ('DEAL-3010','Sasha Petrov',            'CLT-1025','Negotiation',  'Medium',  3900.00, date '2026-09-08','Redwood City','Menlo Park',   'sam.okafor@example.com',     0),
  ('DEAL-3011','Northgate Fitness',       null,      'Negotiation',  'High',   15600.00, date '2026-10-24','Fremont',     'Union City',   'omar.haddad@example.com',    1),
  -- 0.00: filled by the write-back trigger, not by this file.
  ('DEAL-3012','Isabel Moreno',           'CLT-1013','Won',          'Medium',     0.00, date '2026-09-05','San Jose',    'Mountain View','sam.okafor@example.com',     0),
  ('DEAL-3013','Harborline Dental Group', 'CLT-1006','Won',          'High',       0.00, date '2026-09-22','Oakland',     'Berkeley',     'fatima.rahman@example.com',  1),
  ('DEAL-3014','Rosalind Pierce',         'CLT-1021','Lost',         'Low',     2700.00, null,             'San Jose',    null,           'sam.okafor@example.com',     0),
  ('DEAL-3015','Redline Auto Detailing',  'CLT-1014','Lost',         'Medium',  8300.00, null,             'Fremont',     null,           'sofia.marchetti@example.com',1)
) as d(code, client_name, client_code, stage, priority, estimated_value,
       move_date, origin_city, destination_city, owner_email, board_position)
left join public.clients c on c.code = d.client_code
left join public.staff st  on st.work_email = d.owner_email::extensions.citext
on conflict (code) do update
  set client_id        = excluded.client_id,
      client_name      = excluded.client_name,
      stage            = excluded.stage,
      priority         = excluded.priority,
      move_date        = excluded.move_date,
      origin_city      = excluded.origin_city,
      destination_city = excluded.destination_city,
      owner_staff_id   = excluded.owner_staff_id,
      board_position   = excluded.board_position,
      is_seed          = excluded.is_seed;


-- =====================================================================
-- 13. The two Won-deal quotes.
--
-- ============ D8: THE ORDER OF THESE THREE STEPS IS LOAD-BEARING ======
-- app.tg_quote_line_items_freeze() rejects a line-item INSERT whenever
-- the parent quote's status is anything but 'Draft'. So:
--
--     (a) INSERT the quote as Draft
--     (b) INSERT its line items
--     (c) UPDATE the quote to Accepted, with sent_at / viewed_at /
--         decided_at
--
-- Inserting a quote straight at 'Accepted' and then adding lines raises
-- 23514 -- measured, not assumed. Do not "simplify" this into one
-- insert. Collapsing (a) and (c) is the exact change that breaks it.
--
-- WHAT ACTUALLY HAPPENS ON A SECOND PASS, measured, because the freeze
-- trigger gets blamed for this and it is not responsible:
--
--   step 13(a) raises 23505 duplicate key value violates unique
--   constraint "quotes_code_key", Key (code)=(QTE-2026-0001) already
--   exists.
--
-- These two INSERTs carry no `on conflict`, so the collision happens on
-- the very first statement of step 13 -- before 13(b) has inserted a
-- single line item, which means app.tg_quote_line_items_freeze() is
-- never reached at all. The freeze trigger is what forces the (a)/(b)/(c)
-- ORDER within one pass; it is not what stops a second pass.
--
-- The abort is clean. The migration is one transaction, so a second pass
-- rolls back whole and leaves nothing half-applied. To re-seed a dirtied
-- database, drop and recreate rather than re-running this file.
-- =====================================================================

-- (a) --------------------------------------------------------------
-- QTE-2026-0001 -- DEAL-3012, Isabel Moreno, CLT-1013.
-- crew 4 x 12h at $75 a mover: 8h straight (8*75*4 = 2400) plus 4h at
-- x1.5 (4*75*4*1.5 = 1800) = 4200. Zero line items, which is also the
-- D7 probe: the header rollup fires on INSERT, so this quote must land
-- at subtotal 4200, not 0.
--
-- tax_rate_percent is a real 8.75 and the tax is still 0.00, because
-- labor_taxable is false and there is nothing else to tax. That is D10
-- working, not a rate that was quietly zeroed to make the total land.
insert into public.quotes (
  code, deal_id, client_id, client_name, status, issued_on, valid_until, move_date,
  origin_street, origin_city, origin_state, origin_zip,
  destination_street, destination_city, destination_state, destination_zip,
  rate_card_id, crew_size, estimated_hours, hourly_rate_per_mover,
  min_hours, ot_threshold_hours, ot_multiplier,
  valuation_type, valuation_fee, labor_taxable, valuation_taxable,
  discount_type, discount_value, tax_rate_id, tax_rate_percent,
  deposit_type, deposit_value,
  owner_staff_id, prepared_by_staff_id, notes, is_seed)
select
  'QTE-2026-0001', d.id, c.id, 'Isabel Moreno', 'Draft',
  date '2026-08-05', date '2026-08-05' + 30, date '2026-09-05',
  '45 Meridian Ave','San Jose','CA','95126',
  '220 Castro St','Mountain View','CA','94041',
  rc.id, 4, 12.00, 75.00, 3.00, 8.00, 1.5,
  'Released Value', 0.00, false, false,
  'fixed', 0.00, tr.id, 8.75,
  'percent', 25.00,
  st.id, st.id, 'Full-day residential move, one flight of stairs at origin.', true
from public.deals d
join public.clients c        on c.code = 'CLT-1013'
join public.rate_cards rc    on rc.code = 'RC-2026-RES'
join public.tax_rates tr     on tr.code = 'ca-sales-tax'
join public.staff st         on st.work_email = 'sam.okafor@example.com'::extensions.citext
where d.code = 'DEAL-3012';

-- QTE-2026-0002 -- DEAL-3013, Harborline Dental Group, CLT-1006.
-- crew 6 x 16h at $125 a mover on the commercial card: 8h straight
-- (8*125*6 = 6000) plus 8h at x1.5 (8*125*6*1.5 = 9000) = 15000.
-- Straight multiplication would give 12000; it only reaches 15000 once
-- overtime applies.
insert into public.quotes (
  code, deal_id, client_id, client_name, status, issued_on, valid_until, move_date,
  origin_street, origin_city, origin_state, origin_zip,
  destination_street, destination_city, destination_state, destination_zip,
  rate_card_id, crew_size, estimated_hours, hourly_rate_per_mover,
  min_hours, ot_threshold_hours, ot_multiplier,
  valuation_type, valuation_fee, labor_taxable, valuation_taxable,
  discount_type, discount_value, tax_rate_id, tax_rate_percent,
  deposit_type, deposit_value,
  owner_staff_id, prepared_by_staff_id, notes, is_seed)
select
  'QTE-2026-0002', d.id, c.id, 'Harborline Dental Group', 'Draft',
  date '2026-08-12', date '2026-08-12' + 30, date '2026-09-22',
  '220 Broadway','Oakland','CA','94607',
  '48 Telegraph Ave','Berkeley','CA','94704',
  rc.id, 6, 16.00, 125.00, 4.00, 8.00, 1.5,
  'Released Value', 0.00, false, false,
  'fixed', 0.00, tr.id, 8.75,
  'percent', 25.00,
  st.id, st.id, 'Two-day pack, third day load and deliver. Operatory equipment crated by the client.', true
from public.deals d
join public.clients c        on c.code = 'CLT-1006'
join public.rate_cards rc    on rc.code = 'RC-2026-COM'
join public.tax_rates tr     on tr.code = 'ca-sales-tax'
join public.staff st         on st.work_email = 'fatima.rahman@example.com'::extensions.citext
where d.code = 'DEAL-3013';

-- (b) --------------------------------------------------------------
-- Four accessorial lines on QTE-2026-0002, summing to 1830.00, with
-- 800.00 of that taxable. Tax = 800 * 8.75% = 70.00, and
-- 15000 + 1830 + 70 = 16900 exactly.
--
-- The four lines exercise all four pricing modes and both sides of the
-- taxable flag, which is the only way to know the D10 tax base is really
-- summing `amount WHERE taxable` rather than the whole subtotal:
--   per_unit + taxable         -> dish pack cartons        800.00
--   percent_of_labor           -> fuel surcharge 3.20%     480.00
--   per_hour                   -> shuttle, 2h at 150.00    300.00
--   flat                       -> stair carry              250.00
insert into public.quote_line_items (
  quote_id, external_key, kind, fee_catalog_id, description,
  pricing_mode, quantity, unit_price, taxable, position, is_seed)
select q.id, l.external_key, l.kind, fc.id, l.description,
       l.pricing_mode, l.quantity, l.unit_price, l.taxable, l.position, true
from (values
  ('QTE-2026-0002-L1','materials',  'carton-dish',    'Dish pack cartons - glassware and instrument trays','per_unit',        64.00,  12.50, true,  0),
  ('QTE-2026-0002-L2','surcharge',  'fuel-surcharge', 'Fuel surcharge',                                    'percent_of_labor', 1.00,   3.20, false, 1),
  ('QTE-2026-0002-L3','accessorial','shuttle',        'Shuttle service - Broadway loading zone',           'per_hour',         2.00, 150.00, false, 2),
  ('QTE-2026-0002-L4','accessorial','stairs',         'Stair carry - rear entrance, one flight',           'flat',             1.00, 250.00, false, 3)
) as l(external_key, kind, fee_code, description, pricing_mode, quantity, unit_price, taxable, position)
join public.quotes q      on q.code = 'QTE-2026-0002'
join public.fee_catalog fc on fc.code = l.fee_code;

-- (c) --------------------------------------------------------------
-- Acceptance. This UPDATE is what fires app.tg_quotes_writeback_to_deal
-- and populates deals.estimated_value / estimated_value_source /
-- accepted_quote_id. Until it runs, both Won deals sit at 0.
update public.quotes
   set status     = 'Accepted',
       sent_at    = timestamptz '2026-08-05 16:20 America/Los_Angeles',
       viewed_at  = timestamptz '2026-08-06 09:05 America/Los_Angeles',
       decided_at = timestamptz '2026-08-11 14:30 America/Los_Angeles'
 where code = 'QTE-2026-0001';

update public.quotes
   set status     = 'Accepted',
       sent_at    = timestamptz '2026-08-12 11:40 America/Los_Angeles',
       viewed_at  = timestamptz '2026-08-13 08:15 America/Los_Angeles',
       decided_at = timestamptz '2026-08-19 15:05 America/Los_Angeles'
 where code = 'QTE-2026-0002';

-- ------------------------------------------------------------------
-- PRIME THE CODE COUNTER. This is not optional bookkeeping.
--
-- The two codes above are written as literals because
-- public.next_quote_code() gates on app.has_any_perm(...), which reads
-- auth.uid(); under a migration that is NULL and the call raises 42501.
-- But the counter is what the running app mints from, so if it is left
-- at zero the very first quote a rep creates comes back as
-- 'QTE-2026-0001' and dies on quotes_code_key -- a collision that would
-- not surface until the first real user did the first real thing.
--
-- The period key is the Pacific-year string the minting function builds,
-- so this only holds if the two literals above stay in 2026. If they are
-- ever re-dated, re-date this too.
-- ------------------------------------------------------------------
insert into app.code_counters (scope, period, last_value)
values ('quote', '2026', 2)
on conflict (scope, period) do update
  set last_value = greatest(app.code_counters.last_value, excluded.last_value);


-- =====================================================================
-- 14. Storage agreements -- 6, STO-2001 .. STO-2006.
--
-- THE EM-DASH. STO-2006 carries the literal U+2014 character as its
-- nextBillingDate in the source, and the UI tests `=== "—"` before
-- formatting. Here it is NULL, which is what it always meant, and the
-- storage_agreements_closed_not_billed_check now encodes the rule the
-- em-dash was standing in for: a closed agreement does not bill.
--
-- THE UI TEST MUST BECOME A NULL CHECK IN THE SAME COMMIT. If the string
-- comparison ships against NULL it falls through to
-- format(new Date(null)) and the cell renders 'Jan 1, 1970' -- a silent
-- wrong answer rather than a crash.
--
-- monthly_rate 0 on STO-2006 is also deliberate: the vault table has a
-- `> 0 ? formatCurrency(...) : em-dash` branch that depends on it.
-- =====================================================================
insert into public.storage_agreements (
  code, client_id, warehouse_location_id, status, monthly_rate,
  move_in_date, next_billing_date, is_seed)
select a.code, c.id, wl.id, a.status, a.monthly_rate,
       a.move_in_date, a.next_billing_date, true
from (values
  ('STO-2001','CLT-1002','oakland-warehouse','Active',            1240.00, date '2025-11-20', date '2026-09-01'),
  ('STO-2002','CLT-1008','san-jose-branch',  'Active',             185.00, date '2026-03-02', date '2026-09-02'),
  ('STO-2003','CLT-1015','san-jose-branch',  'Past Due',           360.00, date '2026-01-25', date '2026-08-25'),
  ('STO-2004','CLT-1023','oakland-warehouse','Move-Out Scheduled', 195.00, date '2026-03-12', date '2026-09-12'),
  ('STO-2005','CLT-1005','fremont-depot',    'Pending Move-In',    175.00, date '2026-09-08', date '2026-10-01'),
  ('STO-2006','CLT-1004','san-jose-branch',  'Closed',               0.00, date '2025-03-20', null)
) as a(code, client_code, location_slug, status, monthly_rate, move_in_date, next_billing_date)
join public.clients c              on c.code = a.client_code
join public.warehouse_locations wl on wl.slug = a.location_slug
on conflict (code) do update
  set client_id             = excluded.client_id,
      warehouse_location_id = excluded.warehouse_location_id,
      status                = excluded.status,
      monthly_rate          = excluded.monthly_rate,
      move_in_date          = excluded.move_in_date,
      next_billing_date     = excluded.next_billing_date,
      is_seed               = excluded.is_seed;


-- =====================================================================
-- 15. Vaults -- 14, V-101 .. V-304.
--
-- vaults.storage_agreement_id is THE single source of truth for the
-- vault-to-agreement relation. The two source directions disagree:
-- StorageCustomer.vaultIds for STO-2005 lists only V-301, while the
-- vaults array assigns BOTH V-207 and V-301 to STO-2005. This file
-- follows the vaults array, which is the direction the schema kept, so
-- STO-2005 holds two vaults and storage_agreements_expanded.vault_count
-- reads 2. The old vaultIds[] array is gone precisely so the two can no
-- longer disagree.
--
-- Two seeded shapes look like bugs and are not:
--   * V-206 is 495 occupied against 450 capacity -> occupancy_percent
--     110. The vault table has a dedicated isOverCapacity branch that
--     renders a destructive 'Over capacity' label and clamps the meter
--     with Math.min(pct, 100). A capacity CHECK here would delete a
--     designed state from the app.
--   * V-207 and V-301 are 'Reserved' at 0 occupied while carrying an
--     assigned agreement, and V-302 is 'Partially Occupied' with none.
--     Status is a loose human label, not a function of occupancy.
-- =====================================================================
insert into public.vaults (
  code, warehouse_location_id, rack, capacity_cubic_ft, occupied_cubic_ft,
  status, storage_agreement_id, last_inspection_date, is_seed)
select v.code, wl.id, v.rack, v.capacity, v.occupied, v.status,
       sa.id, v.last_inspection, true
from (values
  ('V-101','oakland-warehouse','Rack A',700,700,'Occupied',           'STO-2001', date '2026-07-14'),
  ('V-102','oakland-warehouse','Rack A',700,665,'Occupied',           'STO-2001', date '2026-07-14'),
  ('V-103','oakland-warehouse','Rack A',700,410,'Partially Occupied', 'STO-2001', date '2026-07-14'),
  ('V-104','oakland-warehouse','Rack B',500,480,'Occupied',           'STO-2004', date '2026-08-02'),
  ('V-105','oakland-warehouse','Rack B',500,  0,'Empty',              null,       date '2026-08-02'),
  ('V-118','oakland-warehouse','Rack B',500,130,'Partially Occupied', 'STO-2001', date '2026-08-02'),
  ('V-204','san-jose-branch',  'Rack A',600,540,'Occupied',           'STO-2002', date '2026-06-30'),
  ('V-205','san-jose-branch',  'Rack A',600,600,'Occupied',           'STO-2003', date '2026-06-30'),
  ('V-206','san-jose-branch',  'Rack B',450,495,'Occupied',           'STO-2003', date '2026-06-30'),
  ('V-207','san-jose-branch',  'Rack B',450,  0,'Reserved',           'STO-2005', date '2026-08-10'),
  ('V-301','fremont-depot',    'Rack A',550,  0,'Reserved',           'STO-2005', date '2026-08-12'),
  ('V-302','fremont-depot',    'Rack A',550, 90,'Partially Occupied', null,       date '2026-08-12'),
  ('V-303','fremont-depot',    'Rack B',550,  0,'Out of Service',     null,       date '2026-05-19'),
  ('V-304','fremont-depot',    'Rack B',550,  0,'Empty',              null,       date '2026-08-12')
) as v(code, location_slug, rack, capacity, occupied, status, agreement_code, last_inspection)
join public.warehouse_locations wl      on wl.slug = v.location_slug
left join public.storage_agreements sa  on sa.code = v.agreement_code
on conflict (code) do update
  set warehouse_location_id = excluded.warehouse_location_id,
      rack                  = excluded.rack,
      capacity_cubic_ft     = excluded.capacity_cubic_ft,
      occupied_cubic_ft     = excluded.occupied_cubic_ft,
      status                = excluded.status,
      storage_agreement_id  = excluded.storage_agreement_id,
      last_inspection_date  = excluded.last_inspection_date,
      is_seed               = excluded.is_seed;


-- =====================================================================
-- 16. Calendar -- 21 events (10 dispatch + 11 office) and their crews.
--
-- ============ D19: WHY THERE ARE NO LITERAL TIMESTAMPS HERE ==========
-- events-data.ts computes every date at MODULE EVAL from
-- startOfMonth(new Date()), so the calendar has always rendered against
-- the current month. Literal timestamps would freeze the whole screen to
-- whichever day this migration was applied, and the Calendar -- a
-- headline screen -- would be empty next month.
--
-- So: anchor to the current Pacific month at apply time, and keep it
-- fresh afterwards with dev_seed.reseed_calendar(), which shifts every
-- is_seed row by whole calendar months. `npm run seed:dev` is its
-- caller and ships in the same change; a function with nothing invoking
-- it is exactly the hand-wave this was written to avoid.
--
-- CLAMPING. day 30 does not exist in February, and month_start +
-- 29 days would silently land JOB-4006 on March 1. least(..., month_end)
-- pins it to the last day of the month instead, matching the reseeder's
-- own clamping policy (Postgres `+ interval 'N months'` clamps; the JS
-- setDate() it replaces rolls over).
--
-- ALL-DAY CONVENTION: local midnight in America/Los_Angeles, with
-- FullCalendar's EXCLUSIVE end. JOB-4003 runs day 24 to day 26 exclusive
-- and therefore renders across two days, one shorter than its own note
-- describes. That mismatch is preserved rather than silently corrected:
-- changing it here would move an event nobody asked to move.
-- =====================================================================
with anchor as (
  select
    date_trunc('month', (now() at time zone 'America/Los_Angeles'))::date as ms,
    (date_trunc('month', (now() at time zone 'America/Los_Angeles'))
       + interval '1 month' - interval '1 day')::date                     as me,
    gen_random_uuid()                                                     as standup_series
),
src (code, entity_type, title, start_day, start_time, end_day, end_time, all_day,
     status, client_code, estimator_email, agreement_code, location_slug,
     address_line, notes, series_key) as (values
  -- ---- dispatch: 6 jobs + 4 surveys ------------------------------
  ('JOB-4001','job','Move: Isabel Moreno',
     5, time '08:00', 5::integer, time '15:00', false,
     'Completed'::text, 'CLT-1013'::text, null::text, null::text, null::text,
     '45 Meridian Ave, San Jose'::text, null::text, null::text),
  ('JOB-4002','job','Move: Danielle Ruiz',
     14, time '08:00', 14, time '16:00', false,
     'Completed','CLT-1001', null, null, null,
     '214 Willow Ave, San Jose', 'Piano on second floor, extra padding loaded.', null),
  ('SUR-5001','survey','Survey: Priya Nair',
     22, time '10:00', 22, time '11:00', false,
     'Scheduled','CLT-1003','fatima.rahman@example.com', null, null,
     '77 Alma St, Palo Alto', null, null),
  ('SUR-5002','survey','Survey: Cascade Wealth Advisors',
     23, time '14:00', 23, time '15:30', false,
     'Scheduled','CLT-1020','omar.haddad@example.com', null, null,
     '400 Concar Dr, San Mateo', 'Office walk-through after 2 PM only.', null),
  ('JOB-4003','job','Move: Harborline Dental Group',
     24, time '00:00', 26, time '00:00', true,
     'In Progress','CLT-1006', null, null, null,
     '220 Broadway, Oakland', 'Two-day pack, third day load and deliver.', null),
  -- Sofia Marchetti is Deactivated and is this survey's estimator of
  -- record. Any join that filters the REFERENCED staff row by status
  -- silently drops her name here.
  ('SUR-5003','survey','Survey: Yusuf Karimi',
     26, time '09:00', 26, time '10:00', false,
     'Scheduled','CLT-1010','sofia.marchetti@example.com', null, null,
     '812 Blossom Hill Rd, San Jose', null, null),
  -- storage_agreement_id is why STO-2004 reads 'Move-Out Scheduled'.
  ('JOB-4004','job','Move-out: Felix Duarte vault release',
     27, time '09:00', 27, time '12:00', false,
     'Scheduled','CLT-1023', null, 'STO-2004', 'oakland-warehouse',
     'Oakland Warehouse, Rack B', null, null),
  ('SUR-5004','survey','Survey: Odessa Fields',
     28, time '13:00', 28, time '14:00', false,
     'Scheduled','CLT-1016','omar.haddad@example.com', null, null,
     '930 Coleman Ave, Santa Clara', null, null),
  ('JOB-4005','job','Move: Sasha Petrov',
     29, time '08:00', 29, time '14:00', false,
     'Scheduled','CLT-1025', null, null, null,
     '88 Alameda de las Pulgas, Redwood City', null, null),
  -- and storage_agreement_id here is why STO-2005 reads 'Pending Move-In'.
  -- The one seeded event with a start and no end.
  ('JOB-4006','job','Delivery: Owen Fitzgerald move-in',
     30, time '00:00', null, null, true,
     'On Hold','CLT-1005', null, 'STO-2005', 'fremont-depot',
     'Fremont Depot, V-301', 'Waiting on elevator reservation at destination.', null),

  -- ---- office: 11 rows, status NULL and client NULL by CHECK ------
  -- These have no identity of any kind in the source; OFF-6xxx is net
  -- new. The four stand-ups share one series_id, which is what maps onto
  -- FullCalendar's groupId. The source tags only three of the four with
  -- groupId 'standup'; a recurring series missing its own first
  -- occurrence is a source inconsistency, not a feature, and groupId
  -- affects grouped operations rather than the render.
  ('OFF-6001','office','Dispatch stand-up',
     2, time '07:30', 2, time '08:00', false,
     null, null, null, null, null, null, null, 'standup'),
  ('OFF-6002','office','Truck 3 maintenance',
     4, time '00:00', null, null, true,
     null, null, null, null, null, null, null, null),
  ('OFF-6003','office','Dispatch stand-up',
     9, time '07:30', 9, time '08:00', false,
     null, null, null, null, null, null, null, 'standup'),
  ('OFF-6004','office','Crew safety meeting',
     11, time '15:00', 11, time '16:00', false,
     null, null, null, null, null, null, null, null),
  ('OFF-6005','office','Payroll cutoff',
     15, time '00:00', null, null, true,
     null, null, null, null, null, null, null, null),
  ('OFF-6006','office','Dispatch stand-up',
     16, time '07:30', 16, time '08:00', false,
     null, null, null, null, null, null, null, 'standup'),
  -- warehouse_location_id is left NULL: the source names no site, and
  -- picking one would be inventing a fact the dispatch filter then acts on.
  ('OFF-6007','office','Warehouse inspection walk',
     18, time '10:00', 18, time '11:30', false,
     null, null, null, null, null, null, null, null),
  ('OFF-6008','office','Storage billing run',
     21, time '00:00', null, null, true,
     null, null, null, null, null, null, null, null),
  ('OFF-6009','office','Dispatch stand-up',
     23, time '07:30', 23, time '08:00', false,
     null, null, null, null, null, null, null, 'standup'),
  ('OFF-6010','office','All-hands',
     25, time '16:00', 25, time '17:00', false,
     null, null, null, null, null, null, null, null),
  ('OFF-6011','office','DOT compliance review',
     28, time '09:00', 28, time '11:00', false,
     null, null, null, null, null, null, null, null)
)
insert into public.calendar_events (
  code, entity_type, title, starts_at, ends_at, all_day, status,
  client_id, estimator_id, storage_agreement_id, warehouse_location_id,
  address_line, notes, series_id, is_seed)
select
  s.code, s.entity_type, s.title,
  ((least(a.ms + (s.start_day - 1), a.me) + s.start_time) at time zone 'America/Los_Angeles'),
  case when s.end_day is null then null
       else ((least(a.ms + (s.end_day - 1), a.me) + s.end_time) at time zone 'America/Los_Angeles')
  end,
  s.all_day, s.status,
  c.id, es.id, sa.id, wl.id,
  s.address_line, s.notes,
  case when s.series_key = 'standup' then a.standup_series end,
  true
from src s
cross join anchor a
left join public.clients c              on c.code = s.client_code
left join public.staff es               on es.work_email = s.estimator_email::extensions.citext
left join public.storage_agreements sa  on sa.code = s.agreement_code
left join public.warehouse_locations wl on wl.slug = s.location_slug
on conflict (code) do update
  set title                 = excluded.title,
      starts_at             = excluded.starts_at,
      ends_at               = excluded.ends_at,
      all_day               = excluded.all_day,
      status                = excluded.status,
      client_id             = excluded.client_id,
      estimator_id          = excluded.estimator_id,
      storage_agreement_id  = excluded.storage_agreement_id,
      warehouse_location_id = excluded.warehouse_location_id,
      address_line          = excluded.address_line,
      notes                 = excluded.notes,
      is_seed               = excluded.is_seed;

-- Crew. `position` preserves the source array order, which carries
-- meaning: the Crew Lead is listed first on both jobs he works.
-- Every name here resolves to a seeded Fleet & Maintenance or Warehouse
-- staff row -- that is the coherence rule, made checkable by the FK.
insert into public.calendar_event_crew (calendar_event_id, staff_id, position, is_seed)
select e.id, st.id, x.position, true
from (values
  ('JOB-4001','tyler.brooks@example.com',   0),
  ('JOB-4001','ana.delgado@example.com',    1),
  ('JOB-4001','trevor.lang@example.com',    2),
  ('JOB-4002','miguel.santos@example.com',  0),
  ('JOB-4002','wesley.grant@example.com',   1),
  ('JOB-4003','tyler.brooks@example.com',   0),
  ('JOB-4003','miguel.santos@example.com',  1),
  ('JOB-4003','camille.roux@example.com',   2),
  ('JOB-4003','trevor.lang@example.com',    3),
  ('JOB-4004','julia.ferreira@example.com', 0),
  ('JOB-4004','nadia.petrov@example.com',   1),
  ('JOB-4005','tyler.brooks@example.com',   0),
  ('JOB-4005','ana.delgado@example.com',    1),
  ('JOB-4006','camille.roux@example.com',   0)
) as x(event_code, work_email, position)
join public.calendar_events e on e.code = x.event_code
join public.staff st          on st.work_email = x.work_email::extensions.citext
on conflict (calendar_event_id, staff_id) do update
  set position = excluded.position,
      is_seed  = excluded.is_seed;


-- =====================================================================
-- 17. Documents -- 6 folders, 15 files, 3 stars.
--
-- 12 come from the Documents screen and 3 from Morgan Ellis's profile
-- page, which the schema deliberately folds into the same table via
-- documents.staff_id. Two independently checkable counts:
--   staff_id is null  -> 12   (the file-manager rows)
--   all rows          -> 15
--
-- WHAT IS DROPPED, per D18: size, ownerInitials and modifiedAt. Size and
-- modified time join to storage.objects, and getInitials() already
-- exists in src/lib/utils.ts. mime_type is kept -- it is chosen at
-- upload, sets Content-Type on the signed URL, and is enforced against
-- the bucket's allowed_mime_types.
--
-- VISIBILITY: every file-manager row is 'team'. The source's
-- `shared: false` is display-only chrome, and reading access semantics
-- out of it would make five files vanish for everyone but their owner
-- the moment RLS lands. Only the confidentiality agreement, which the
-- profile page marks isRestricted, is 'restricted'.
--
-- STORAGE PATHS follow the D18 convention, scope-first so an RLS policy
-- can read (storage.foldername(name))[2] and get a real id. SQL cannot
-- upload bytes, so scripts/seed-documents.ts creates the private bucket
-- and puts a placeholder object at each of these paths -- without it
-- every Download button 403s against an object that was never there.
-- =====================================================================
insert into public.document_folders (slug, name, position, is_seed) values
  ('contracts',       'Contracts & estimates', 0, true),
  ('bills-of-lading', 'Bills of lading',       1, true),
  ('insurance',       'Insurance & claims',    2, true),
  ('inventories',     'Inventory sheets',      3, true),
  ('fleet',           'Fleet & DOT records',   4, true),
  ('hr-forms',        'Crew & HR forms',       5, true)
on conflict (slug) do update
  set name     = excluded.name,
      position = excluded.position,
      is_seed  = excluded.is_seed;

with src (key, name, slug, ext, kind, mime, folder_slug, owner_email,
          client_code, deal_code, job_code, staff_email,
          visibility, signature_status, signed_at) as (values
  ('ruiz-estimate','Ruiz move estimate.pdf','ruiz-move-estimate','pdf',
     'contract','application/pdf','contracts','sam.okafor@example.com',
     'CLT-1001'::text, null::text, null::text, null::text,
     'team','out_for_signature', null::timestamptz),
  ('harborline-bol','Harborline Dental bill of lading.pdf','harborline-dental-bill-of-lading','pdf',
     'bill-of-lading','application/pdf','bills-of-lading','elena.torres@example.com',
     'CLT-1006', null, 'JOB-4003', null,
     'team','executed', timestamptz '2026-08-24 09:10 America/Los_Angeles'),
  ('storage-billing','Storage billing August.xlsx','storage-billing-august','xlsx',
     'spreadsheet','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     null,'renee.castillo@example.com',
     null, null, null, null,
     'team','unsigned', null),
  ('bellweather-inventory','Bellweather vault inventory.pdf','bellweather-vault-inventory','pdf',
     'inventory','application/pdf','inventories','julia.ferreira@example.com',
     'CLT-1002', null, null, null,
     'team','unsigned', null),
  ('coi-baywood','COI - Baywood Dental building.pdf','coi-baywood-dental-building','pdf',
     'insurance-certificate','application/pdf','insurance','marcus.webb@example.com',
     null, 'DEAL-3008', null, null,
     'team','unsigned', null),
  ('weiss-agreement','Weiss storage agreement.docx','weiss-storage-agreement','docx',
     'contract','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'contracts','omar.haddad@example.com',
     'CLT-1015', null, null, null,
     'team','executed', timestamptz '2026-01-25 10:30 America/Los_Angeles'),
  ('crew-timesheets','Crew timesheets week 34.xlsx','crew-timesheets-week-34','xlsx',
     'spreadsheet','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'hr-forms','marcus.webb@example.com',
     null, null, null, null,
     'team','unsigned', null),
  ('moreno-photos','Moreno pre-move photos.zip','moreno-pre-move-photos','zip',
     'archive','application/zip','inventories','miguel.santos@example.com',
     'CLT-1013', null, 'JOB-4001', null,
     'team','unsigned', null),
  ('claims-procedure','Damage claims procedure.docx','damage-claims-procedure','docx',
     'document','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'insurance','grace.chen@example.com',
     null, null, null, null,
     'team','unsigned', null),
  ('duarte-bol','Duarte move-out bill of lading.pdf','duarte-move-out-bill-of-lading','pdf',
     'bill-of-lading','application/pdf','bills-of-lading','elena.torres@example.com',
     'CLT-1023', null, 'JOB-4004', null,
     'team','executed', timestamptz '2026-08-14 13:45 America/Los_Angeles'),
  ('truck-inspections','Truck inspection reports Q3.zip','truck-inspection-reports-q3','zip',
     'archive','application/zip','fleet','tyler.brooks@example.com',
     null, null, null, null,
     'team','unsigned', null),
  ('rate-sheet','2026 rate sheet.pdf','2026-rate-sheet','pdf',
     'pdf','application/pdf', null,'grace.chen@example.com',
     null, null, null, null,
     'team','unsigned', null),
  -- The three ProfileDocument rows. staff_id scoped, so client_id must
  -- be NULL by documents_hr_has_no_client_check.
  ('hr-contractor-agreement','Contractor agreement.pdf','contractor-agreement','pdf',
     'contract','application/pdf','hr-forms','morgan.ellis@example.com',
     null, null, null, 'morgan.ellis@example.com',
     'restricted','executed', timestamptz '2023-03-03 09:00 America/Los_Angeles'),
  ('hr-confidentiality','Confidentiality agreement.pdf','confidentiality-agreement','pdf',
     'contract','application/pdf','hr-forms','morgan.ellis@example.com',
     null, null, null, 'morgan.ellis@example.com',
     'restricted','executed', timestamptz '2023-03-03 09:05 America/Los_Angeles'),
  ('hr-safety-policy','Safety and handling policy acknowledgement.pdf','safety-and-handling-policy-acknowledgement','pdf',
     'document','application/pdf','hr-forms','morgan.ellis@example.com',
     null, null, null, 'morgan.ellis@example.com',
     'restricted','unsigned', null)
),
-- The document id has to be knowable BEFORE the row exists, because it
-- is part of storage_path. A deterministic md5 of the seed key rather
-- than gen_random_uuid() buys one specific thing: on a second pass the
-- path is identical, so `on conflict (storage_path)` is a real upsert
-- against a real unique constraint instead of a clause that can never
-- fire. Only these 15 seed rows are derived this way; app-created
-- documents take the column default.
ids as (select key, md5('movers-seed:document:' || key)::uuid as id from src)
insert into public.documents (
  id, folder_id, name, kind, storage_bucket, storage_path, mime_type,
  owner_staff_id, client_id, deal_id, job_event_id, staff_id,
  visibility, signature_status, signed_at, is_seed)
select
  i.id, f.id, s.name, s.kind, 'documents',
  case
    when hs.id is not null then 'staff/'   || hs.id || '/' || i.id || '-' || s.slug || '.' || s.ext
    when c.id  is not null then 'clients/' || c.id  || '/' || i.id || '-' || s.slug || '.' || s.ext
    when dl.id is not null then 'deals/'   || dl.id || '/' || i.id || '-' || s.slug || '.' || s.ext
    else                        'company/shared/'   || i.id || '-' || s.slug || '.' || s.ext
  end,
  s.mime,
  ow.id, c.id, dl.id, ev.id, hs.id,
  s.visibility, s.signature_status, s.signed_at, true
from src s
join ids i                       on i.key = s.key
left join public.document_folders f on f.slug = s.folder_slug
left join public.staff ow           on ow.work_email = s.owner_email::extensions.citext
left join public.staff hs           on hs.work_email = s.staff_email::extensions.citext
left join public.clients c          on c.code = s.client_code
left join public.deals dl           on dl.code = s.deal_code
left join public.calendar_events ev on ev.code = s.job_code
on conflict (storage_path) do update
  set name             = excluded.name,
      kind             = excluded.kind,
      mime_type        = excluded.mime_type,
      visibility       = excluded.visibility,
      signature_status = excluded.signature_status,
      signed_at        = excluded.signed_at,
      is_seed          = excluded.is_seed;

-- Stars are PER VIEWER, not a global flag. The three files the source
-- marks starred are starred by rootUser -- Morgan Ellis -- which is the
-- concrete reason he has to be a staff row at all.
--
-- Matched on the SAME derived id expression as the insert above, not on
-- documents.name: name is explicitly not unique (two clients can both
-- have 'bill of lading.pdf'), so a name match would silently star the
-- wrong row the first time a filename repeats. A wrong key here raises
-- 23503 against documents_pkey instead, which is a failure you can see.
insert into public.document_stars (staff_id, document_id)
select st.id, md5('movers-seed:document:' || k.key)::uuid
from public.staff st
cross join (values
  ('ruiz-estimate'),
  ('bellweather-inventory'),
  ('claims-procedure')
) as k(key)
where st.work_email = 'morgan.ellis@example.com'::extensions.citext
on conflict (staff_id, document_id) do nothing;


-- =====================================================================
-- 18. Assertions.
--
-- These run inside the migration and ABORT it on failure. A seed that
-- lands quietly wrong is worse than one that refuses to land: the two
-- Won-deal totals feed a figure the dashboard hardcodes, and nothing
-- downstream would notice them drifting.
--
-- Each check is written so it can only pass for the right reason -- the
-- booked-revenue check reads deals.estimated_value, which this file
-- seeded as 0.00, so it can only be 21100 if the acceptance write-back
-- actually fired.
-- =====================================================================
do $$
declare
  v_num  numeric;
  v_int  integer;
  v_text text;
begin
  -- ---- headcount and role split ----------------------------------
  select count(*) into v_int from public.staff;
  if v_int <> 27 then
    raise exception 'seed: expected 27 staff, got %', v_int;
  end if;

  -- The nine role counts sum to headcount, which is the invariant that
  -- matters. Over the original 25 UserRow emails the split is unchanged.
  select sum(n) into v_int from (
    select count(*) as n from public.staff group by role_id
  ) x;
  if v_int <> 27 then
    raise exception 'seed: role counts sum to % rather than headcount 27', v_int;
  end if;

  select string_agg(n::text, ',' order by n desc) into v_text from (
    select count(*) as n
    from public.staff s
    join public.roles r on r.id = s.role_id
    where s.work_email::text <> 'morgan.ellis@example.com'
      and s.work_email::text <> 'priya.shah@example.com'
    group by r.slug
  ) x;
  if v_text <> '4,3,3,3,3,3,3,2,1' then
    raise exception 'seed: the 25 UserRow role counts are % rather than 4,3,3,3,3,3,3,2,1', v_text;
  end if;

  -- ---- D7 + D8 + D17: booked revenue -----------------------------
  select coalesce(sum(estimated_value), 0) into v_num
  from public.deals where stage = 'Won';
  if v_num <> 21100.00 then
    raise exception
      'seed: Won-deal value is % rather than 21100. The quote acceptance write-back did not fire, or a quote header rollup did not run on INSERT (D7).',
      v_num;
  end if;

  select count(*) into v_int
  from public.deals
  where stage = 'Won' and estimated_value_source <> 'quote';
  if v_int <> 0 then
    raise exception 'seed: % Won deal(s) still carry estimated_value_source = manual', v_int;
  end if;

  select total_amount into v_num from public.quotes where code = 'QTE-2026-0001';
  if v_num <> 4200.00 then
    raise exception 'seed: QTE-2026-0001 total is % rather than 4200 (zero line items -- this is the D7 probe)', v_num;
  end if;

  select total_amount into v_num from public.quotes where code = 'QTE-2026-0002';
  if v_num <> 16900.00 then
    raise exception 'seed: QTE-2026-0002 total is % rather than 16900', v_num;
  end if;

  select tax_amount into v_num from public.quotes where code = 'QTE-2026-0002';
  if v_num <> 70.00 then
    raise exception
      'seed: QTE-2026-0002 tax is % rather than 70.00. The tax base is not honouring quote_line_items.taxable (D10).',
      v_num;
  end if;

  -- ---- vaults ----------------------------------------------------
  select sum(capacity_cubic_ft) into v_int from public.vaults;
  if v_int <> 7900 then
    raise exception 'seed: vault capacity is % rather than 7900', v_int;
  end if;

  select sum(occupied_cubic_ft) into v_int from public.vaults;
  if v_int <> 4110 then
    raise exception 'seed: vault occupancy is % rather than 4110', v_int;
  end if;

  select occupancy_percent into v_int from public.vaults where code = 'V-206';
  if v_int <> 110 then
    raise exception 'seed: V-206 occupancy is % percent, expected 110 (the designed Over capacity state)', v_int;
  end if;

  -- ---- coherence: every referenced person is a seeded person -----
  select count(*) into v_int
  from public.clients c
  where c.account_owner_staff_id is null;
  if v_int <> 0 then
    raise exception 'seed: % client(s) have an unresolved account owner', v_int;
  end if;

  select count(*) into v_int from public.deals where owner_staff_id is null;
  if v_int <> 0 then
    raise exception 'seed: % deal(s) have an unresolved owner', v_int;
  end if;

  select count(*) into v_int
  from public.deals d
  join public.staff s on s.id = d.owner_staff_id
  join public.roles r on r.id = s.role_id
  where r.slug <> 'sales-rep';
  if v_int <> 0 then
    raise exception 'seed: % deal(s) are owned by someone who is not a Sales Rep', v_int;
  end if;

  select count(*) into v_int
  from public.calendar_event_crew cec
  join public.staff s on s.id = cec.staff_id
  where s.team not in ('Fleet & Maintenance','Warehouse');
  if v_int <> 0 then
    raise exception 'seed: % crew assignment(s) name someone outside Fleet or Warehouse', v_int;
  end if;

  -- Storage customers are Clients marked In Storage -- for the four
  -- agreements that are actually holding goods. STO-2005 has not moved
  -- in yet and STO-2006 has moved out, so their clients are correctly
  -- Active and Past.
  select count(*) into v_int from public.clients where status = 'In Storage';
  if v_int <> 4 then
    raise exception 'seed: % clients are In Storage, expected 4', v_int;
  end if;

  select count(distinct sa.client_id) into v_int
  from public.storage_agreements sa
  join public.clients c on c.id = sa.client_id
  where sa.status not in ('Pending Move-In','Closed')
    and c.status <> 'In Storage';
  if v_int <> 0 then
    raise exception 'seed: % holding storage agreement(s) belong to a client not marked In Storage', v_int;
  end if;

  -- ---- calendar --------------------------------------------------
  select count(*) into v_int from public.calendar_events;
  if v_int <> 21 then
    raise exception 'seed: expected 21 calendar events, got %', v_int;
  end if;

  select count(*) into v_int
  from public.calendar_events
  where is_seed is not true;
  if v_int <> 0 then
    raise exception 'seed: % calendar event(s) are not flagged is_seed and would be missed by the reseeder (D11)', v_int;
  end if;

  select count(distinct series_id) into v_int
  from public.calendar_events where series_id is not null;
  if v_int <> 1 then
    raise exception 'seed: the four stand-ups resolve to % series rather than 1', v_int;
  end if;

  -- ---- documents -------------------------------------------------
  select count(*) into v_int from public.documents;
  if v_int <> 15 then
    raise exception 'seed: expected 15 documents (12 file-manager + 3 HR), got %', v_int;
  end if;

  select count(*) into v_int from public.documents where staff_id is null;
  if v_int <> 12 then
    raise exception 'seed: expected 12 file-manager documents, got %', v_int;
  end if;

  select count(distinct storage_path) into v_int from public.documents;
  if v_int <> 15 then
    raise exception 'seed: storage paths are not distinct across the 15 documents';
  end if;

  -- ---- Morgan Ellis's HR profile ---------------------------------
  -- Both halves must exist. That INSERT hangs off a lookup by warehouse
  -- slug AND by work_email; if either ever drifts it inserts ZERO rows,
  -- raises nothing, and the Profile screen renders empty. A count is the
  -- only thing that catches a silently-skipped insert.
  select count(*) into v_int from public.staff_profiles;
  if v_int <> 1 then
    raise exception 'seed: expected 1 staff_profiles row (Morgan Ellis), got %', v_int;
  end if;

  select count(*) into v_int from public.staff_profiles_sensitive;
  if v_int <> 1 then
    raise exception 'seed: expected 1 staff_profiles_sensitive row (Morgan Ellis), got %', v_int;
  end if;

  -- 20 annual + 0 carried - 8 used = 12. This is the source's
  -- 'remainingLeave: 12 days' string reproduced by the generated column
  -- rather than copied, which is the whole reason it is generated.
  select sp.remaining_leave_days into v_int
  from public.staff_profiles sp
  join public.staff s on s.id = sp.staff_id
  where s.work_email = 'morgan.ellis@example.com'::extensions.citext;
  if v_int is distinct from 12 then
    raise exception 'seed: remaining leave computes to % rather than the source''s 12 days', v_int;
  end if;

  -- ---- warehouse names -------------------------------------------
  -- A SLUG typo fails loudly: the joins drop rows and the 7900 capacity
  -- check catches it. A NAME typo does not. It passes every other
  -- assertion in this block and silently makes every location filter in
  -- the UI match nothing, because those Selects compare against these
  -- exact strings.
  select string_agg(name, ',' order by sort_order) into v_text
  from public.warehouse_locations;
  if v_text <> 'Oakland Warehouse,San Jose Branch,Fremont Depot' then
    raise exception
      'seed: warehouse names are "%" rather than "Oakland Warehouse,San Jose Branch,Fremont Depot"; the UI location filters compare against these strings verbatim',
      v_text;
  end if;

  -- ---- the counter that the running app mints from ---------------
  select last_value into v_int from app.code_counters where scope = 'quote' and period = '2026';
  if v_int is null or v_int < 2 then
    raise exception
      'seed: app.code_counters is not primed past QTE-2026-0002; the first app-minted quote would collide on quotes_code_key';
  end if;

  raise notice 'seed: all assertions passed.';
end
$$;

-- Undo the pin from the head of this file. Nothing applied after 0010
-- should inherit a session search_path it did not set for itself.
reset search_path;
