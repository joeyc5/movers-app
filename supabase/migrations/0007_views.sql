-- =====================================================================
-- 0007_views.sql
-- The expanded read views the UI needs, plus the roles view that
-- replaces the hand-maintained member count.
--
-- WHY THESE ARE REQUIRED, NOT CONVENIENT: vaults-columns.tsx is a
-- "use client" module that imports the storageCustomers VALUE and
-- resolves the vault-to-agreement FK inside getCustomerName(), which
-- feeds both the search accessor and the customer cell. A client bundle
-- cannot reach Postgres. The server component selects from the view and
-- passes flat rows down.
--
-- security_invoker = true ON ALL OF THEM, and the two halves of that
-- rule both matter:
--
--   * false is the POSTGRES DEFAULT, and a view created without the
--     option reads as its OWNER. Measured, same caller, same instant:
--     invoker = true returned 1 row (matching a direct table read),
--     invoker = false returned 2. A view left at the default is a silent
--     RLS bypass.
--   * true means the view reads AS THE CALLER, so the caller owes both a
--     SELECT grant and a SELECT policy on every base table the view
--     touches, or they get nothing. That is the "returns zero rows"
--     trap, and it does NOT bite here: every base table below
--     (vaults, storage_agreements, warehouse_locations, clients, staff,
--     calendar_events, calendar_event_crew, roles, permission_sets,
--     role_permission_sets) is broad-read for any active staff member
--     under D1. These views are not a privilege-widening subset of a
--     restricted table, which is the shape the trap applies to.
--
-- Granting SELECT on these views therefore cannot widen anything: base
-- table RLS still runs, as the caller. The per-TABLE grants live in the
-- policy migration; the view grants are here because a view carries no
-- policies of its own and is inert without them.
--
-- CROSS-CUTTING RULE, observed throughout this file: RLS gates the
-- CALLER's status. A REFERENCED staff row is NEVER filtered by status.
-- One seeded rep is Deactivated and is an estimator of record and the
-- account owner on five clients; a `where s.status = 'Active'` on any
-- join below would silently drop those rows, and would make the role
-- member counts stop summing to headcount.
--
-- ID NAMING, stated so it is not read as an oversight: these views
-- expose the real uuid as `id` and the human key as `code`. The
-- operations brief suggested aliasing `code AS id` so the existing
-- getRowId and accessorKey survive untouched, but a column named `id`
-- that is not the primary key breaks every future join through the view
-- and misleads the next reader. The alias belongs in the TypeScript DTO,
-- which is one line per table, not in the schema.
-- =====================================================================

-- =====================================================================
-- vaults_expanded
-- =====================================================================
create view public.vaults_expanded with (security_invoker = true) as
select
  v.id,
  v.code,
  v.warehouse_location_id,
  wl.name                as warehouse_location_name,
  v.rack,
  -- The exact grouping key the Vaults panel builds its section headers
  -- from: "<location> — <rack>".
  wl.name || ' — ' || v.rack as group_label,
  v.capacity_cubic_ft,
  v.occupied_cubic_ft,
  v.occupancy_percent,
  v.status,
  v.storage_agreement_id,
  sa.code                as storage_agreement_code,
  -- NULL renders as the em-dash placeholder. This is the only column the
  -- deliberate V-207 data repair changes.
  c.name                 as customer_name,
  c.id                   as client_id,
  -- The client CODE, not the uuid: the Customer cell links to
  -- /dashboard/clients/CLT-1001, and a uuid in a search haystack is
  -- noise that matches nothing a human types.
  c.code                 as client_code,
  v.last_inspection_date,
  v.is_seed,
  v.created_at,
  v.updated_at
from public.vaults v
join public.warehouse_locations wl on wl.id = v.warehouse_location_id
left join public.storage_agreements sa on sa.id = v.storage_agreement_id
left join public.clients c on c.id = sa.client_id;

comment on view public.vaults_expanded is
  'Vault rows with the warehouse name and the holding customer resolved. Replaces the client-side getCustomerName() that imported the agreements array by value.';

-- =====================================================================
-- storage_agreements_expanded
--
-- vault_codes is the aggregated replacement for the dropped
-- StorageCustomer.vaultIds[]. It is DERIVED from vaults.storage_agreement_id,
-- which is the single source of truth, so the two directions can no
-- longer disagree the way the seed already does.
-- =====================================================================
create view public.storage_agreements_expanded with (security_invoker = true) as
select
  sa.id,
  sa.code,
  sa.client_id,
  c.name  as client_name,
  c.code  as client_code,
  sa.warehouse_location_id,
  wl.name as warehouse_location_name,
  sa.status,
  sa.monthly_rate,
  sa.move_in_date,
  sa.next_billing_date,
  coalesce(vc.vault_codes, array[]::text[]) as vault_codes,
  coalesce(vc.vault_count, 0)               as vault_count,
  sa.is_seed,
  sa.created_at,
  sa.updated_at
from public.storage_agreements sa
join public.clients c              on c.id  = sa.client_id
join public.warehouse_locations wl on wl.id = sa.warehouse_location_id
left join lateral (
  select array_agg(v.code order by v.code) as vault_codes,
         count(*)                          as vault_count
  from public.vaults v
  where v.storage_agreement_id = sa.id
) vc on true;

comment on view public.storage_agreements_expanded is
  'Agreements with client, location, and the vault codes aggregated from vaults.storage_agreement_id. The Closed agreement holds zero vaults and correctly returns an empty array rather than NULL.';

-- =====================================================================
-- calendar_events_expanded
--
-- Rebuilds everything the old extendedProps object carried, from real
-- typed columns and one join table. `color` is NOT here: it is derived
-- from entity_type in the mapper and it is a design token, so storing or
-- selecting it would turn a theme change into a data migration.
-- =====================================================================
create view public.calendar_events_expanded with (security_invoker = true) as
select
  e.id,
  e.code,
  e.entity_type,
  e.title,
  e.starts_at,
  e.ends_at,
  e.all_day,
  e.status,
  e.client_id,
  c.name  as client_name,
  c.code  as client_code,
  e.estimator_id,
  -- NOT filtered by staff.status: one seeded survey's estimator is
  -- Deactivated and would lose her name.
  es.full_name as estimator_name,
  e.storage_agreement_id,
  sa.code as storage_agreement_code,
  e.warehouse_location_id,
  wl.name as warehouse_location_name,
  e.address_line,
  e.notes,
  e.series_id,
  coalesce(cr.crew, array[]::text[]) as crew,
  e.is_seed,
  e.created_at,
  e.updated_at
from public.calendar_events e
left join public.clients c              on c.id  = e.client_id
left join public.staff es               on es.id = e.estimator_id
left join public.storage_agreements sa  on sa.id = e.storage_agreement_id
left join public.warehouse_locations wl on wl.id = e.warehouse_location_id
left join lateral (
  select array_agg(s.full_name order by cec.position, s.full_name) as crew
  from public.calendar_event_crew cec
  join public.staff s on s.id = cec.staff_id
  where cec.calendar_event_id = e.id
) cr on true;

comment on view public.calendar_events_expanded is
  'One row per event for both the dispatch and office views. crew preserves the source array order via calendar_event_crew.position, which is meaningful: the crew lead is listed first.';

-- =====================================================================
-- roles_expanded
--
-- Replaces the hand-maintained Role.users count with COUNT(*), and the
-- free-text Role.owner with the joined staff name.
--
-- The count is over ALL staff in the role, not active staff. The nine
-- seeded counts sum to exactly headcount, and filtering by status would
-- break that invariant silently the first time someone is deactivated.
-- Owner NULL renders as 'System'.
-- =====================================================================
create view public.roles_expanded with (security_invoker = true) as
select
  r.id,
  r.slug,
  r.name,
  r.access_level,
  r.is_system,
  r.status,
  r.group_label,
  r.owner_staff_id,
  ow.full_name as owner_name,
  r.last_reviewed_on,
  r.archived_at,
  coalesce(sc.staff_count, 0) as staff_count,
  coalesce(ps.permission_set_names, array[]::text[]) as permission_set_names,
  coalesce(ps.permission_set_slugs, array[]::text[]) as permission_set_slugs,
  r.is_seed,
  r.created_at,
  r.updated_at
from public.roles r
left join public.staff ow on ow.id = r.owner_staff_id
left join lateral (
  select count(*) as staff_count
  from public.staff s
  where s.role_id = r.id
) sc on true
left join lateral (
  select array_agg(p.name order by rp.position, p.name) as permission_set_names,
         array_agg(p.slug order by rp.position, p.slug) as permission_set_slugs
  from public.role_permission_sets rp
  join public.permission_sets p on p.id = rp.permission_set_id
  where rp.role_id = r.id
) ps on true;

comment on view public.roles_expanded is
  'Roles with a live member count and the permission sets ordered by role_permission_sets.position, which is what keeps the visible first three badges stable. staff_count counts ALL members, never only active ones.';

-- =====================================================================
-- Grants.
--
-- A view has no policies of its own, so it needs the grant and nothing
-- else. Every one of these is security_invoker, so base-table RLS still
-- decides what comes back.
-- =====================================================================
revoke all on
    public.vaults_expanded,
    public.storage_agreements_expanded,
    public.calendar_events_expanded,
    public.roles_expanded
  from public, anon, authenticated;

grant select on
    public.vaults_expanded,
    public.storage_agreements_expanded,
    public.calendar_events_expanded,
    public.roles_expanded
  to authenticated;
