-- =====================================================================
-- 0004_operations.sql
-- storage_agreements, vaults, calendar_events, calendar_event_crew.
--
-- TWO DECISIONS THIS FILE ENCODES:
--
-- 1. The vault-to-agreement relation collapses to ONE direction:
--    vaults.storage_agreement_id. Both `Vault.assignedCustomerId` and
--    `StorageCustomer.vaultIds[]` are dropped. The relation is 1:N -- a
--    vault is held by at most one agreement -- and an FK on the many
--    side is the only shape where the database enforces that for free. A
--    text[] of codes cannot be FK-constrained in Postgres at all, and a
--    join table would need a partial unique index or a btree_gist
--    exclusion constraint to enforce the same thing, and a partial
--    unique index cannot be an on_conflict target.
--
-- 2. ONE canonical calendar_events table holds dispatch jobs, dispatch
--    surveys AND office events. Today those are two incompatible shapes
--    -- 10 typed rows with extendedProps, and 11 untyped office literals
--    with no id, no status and no extendedProps at all -- that already
--    feed the same component through the same prop. The ?view= toggle is
--    a filter, not a different kind of thing. An office row is a
--    DEGENERATE dispatch row, and one paired CHECK encodes both shapes.
--
-- CHECK CONSTRAINTS DELIBERATELY ABSENT are documented inline. Each one
-- would reject real seed data or encode a coincidence as a rule.
--
-- D12: RLS is enabled immediately after each create table.
-- =====================================================================

-- =====================================================================
-- storage_agreements
--
-- Renamed from `storageCustomers`. The row is an AGREEMENT; the customer
-- is the client, reached by FK. The UI tab keeps its 'Storage Customers'
-- label -- only the table name changes.
-- =====================================================================
create table public.storage_agreements (
  id                    uuid          not null default gen_random_uuid(),
  code                  text          not null,
  client_id             uuid          not null,

  -- Stored on the agreement, NOT derived from its vaults: the Closed
  -- agreement has zero vaults and still displays a location, so there is
  -- nothing to derive it from.
  warehouse_location_id uuid          not null,

  status                text          not null,
  monthly_rate          numeric(12,2) not null default 0,
  move_in_date          date          not null,

  -- THE EM-DASH FIX. One seeded row carries the literal U+2014 character
  -- as its nextBillingDate and the UI tests `=== "—"` before formatting.
  -- As a date column that value becomes NULL, which is what it always
  -- meant. The UI test MUST become a null check in the same commit: if
  -- the string comparison ships against NULL it falls through to
  -- format(new Date(null)) and the cell renders 'Jan 1, 1970' -- a
  -- silent wrong answer, not a crash.
  next_billing_date     date,

  is_seed               boolean       not null default false,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now(),

  constraint storage_agreements_pkey primary key (id),
  constraint storage_agreements_code_key unique (code),
  constraint storage_agreements_code_format check (code ~ '^STO-[0-9]+$'),

  -- RESTRICT: deleting a client who still holds a storage agreement must
  -- fail loudly rather than orphan the vaults.
  constraint storage_agreements_client_id_fkey
    foreign key (client_id) references public.clients(id) on delete restrict,
  constraint storage_agreements_warehouse_location_id_fkey
    foreign key (warehouse_location_id) references public.warehouse_locations(id) on delete restrict,

  constraint storage_agreements_status_check check (
    status in ('Active','Pending Move-In','Past Due','Move-Out Scheduled','Closed')),

  -- >= 0, not > 0: one seeded row is Closed at rate 0 and the UI has a
  -- `> 0 ? formatCurrency(...) : em-dash` branch that depends on it.
  constraint storage_agreements_monthly_rate_check check (monthly_rate >= 0),

  -- Encodes the fact the em-dash was standing in for: a closed agreement
  -- does not bill. It also makes the dead 'Close agreement' action's
  -- contract explicit -- closing must null the billing date.
  constraint storage_agreements_closed_not_billed_check
    check (status <> 'Closed' or next_billing_date is null),
  constraint storage_agreements_billing_after_move_in_check
    check (next_billing_date is null or next_billing_date >= move_in_date)

  -- DELIBERATELY ABSENT: UNIQUE (client_id). All six seeded rows have
  --   distinct clients, but a commercial client legitimately holds
  --   separate agreements at two warehouses. Adding it would encode a
  --   coincidence as a rule.
  -- DELIBERATELY ABSENT: any rule tying monthly_rate to status. A closed
  --   agreement retaining its last rate is valid history.
);

alter table public.storage_agreements enable row level security;

comment on table public.storage_agreements is
  'Storage agreements (STO-2001..). Status is deliberately independent of clients.status: agreement lifecycle and account lifecycle are two different facts and neither derives the other.';
comment on column public.storage_agreements.next_billing_date is
  'NULL means "does not bill". This replaces a literal em-dash character that was being stored in a date field.';
comment on column public.storage_agreements.monthly_rate is
  'numeric, arriving over PostgREST as an unquoted JSON NUMBER (measured on this project). No Number() wrapping is needed in the mapper.';

create index storage_agreements_client_id_idx
  on public.storage_agreements (client_id);
create index storage_agreements_warehouse_location_id_idx
  on public.storage_agreements (warehouse_location_id);
create index storage_agreements_status_idx
  on public.storage_agreements (status);
-- The monthly billing-run query. NULLs sort last in a default ASC btree,
-- which is the wanted behaviour.
create index storage_agreements_next_billing_date_idx
  on public.storage_agreements (next_billing_date);

create trigger trg_storage_agreements_touch
  before update on public.storage_agreements
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- vaults
--
-- The 14 physical vaults. THE SINGLE SOURCE OF TRUTH for the
-- vault-to-agreement relation.
-- =====================================================================
create table public.vaults (
  id                    uuid        not null default gen_random_uuid(),
  code                  text        not null,
  warehouse_location_id uuid        not null,

  -- Left as text rather than promoted to a `racks` table: a rack has no
  -- attributes of its own, it is a label scoped to a location, and a
  -- table would add a join to serve two distinct values.
  rack                  text        not null,

  capacity_cubic_ft     integer     not null,
  occupied_cubic_ft     integer     not null default 0,

  -- STORED generated column matching getVaultOccupancyPercent() exactly
  -- (Postgres round() on a positive numeric agrees with JS Math.round).
  -- Chosen over a view, which cannot be indexed, and over app-only
  -- compute, which SQL cannot sort or filter on. nullif() rather than
  -- trusting the capacity CHECK: a generated expression is evaluated
  -- before the CHECK fires, so a bad write yields NULL and a clean
  -- check_violation instead of a division_by_zero.
  occupancy_percent     integer     generated always as (
                          (round((occupied_cubic_ft::numeric * 100)
                                 / nullif(capacity_cubic_ft, 0)))::integer
                        ) stored,

  status                text        not null,

  -- THE one direction of the vault-to-agreement relation. NULL for an
  -- unassigned vault. ON DELETE SET NULL: closing an agreement releases
  -- its vaults, it does not delete them.
  storage_agreement_id  uuid,

  last_inspection_date  date        not null,
  is_seed               boolean     not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint vaults_pkey primary key (id),
  constraint vaults_code_key unique (code),
  constraint vaults_code_format check (code ~ '^V-[0-9]+$'),

  constraint vaults_warehouse_location_id_fkey
    foreign key (warehouse_location_id) references public.warehouse_locations(id) on delete restrict,
  constraint vaults_storage_agreement_id_fkey
    foreign key (storage_agreement_id) references public.storage_agreements(id) on delete set null,

  constraint vaults_status_check check (
    status in ('Occupied','Partially Occupied','Empty','Reserved','Out of Service')),
  constraint vaults_capacity_check check (capacity_cubic_ft > 0),
  constraint vaults_occupied_check check (occupied_cubic_ft >= 0),
  constraint vaults_rack_not_blank_check check (length(btrim(rack)) > 0)

  -- DELIBERATELY ABSENT: CHECK (occupied_cubic_ft <= capacity_cubic_ft).
  --   V-206 is seeded at 495/450 ON PURPOSE and the vault table has a
  --   dedicated isOverCapacity branch that renders a destructive
  --   'Over capacity' label and clamps the meter with Math.min(pct,100).
  --   Adding this constraint deletes a designed state from the app.
  --
  -- DELIBERATELY ABSENT: any status-to-occupancy rule. The seed proves
  --   status is a loose human label: one vault is 'Partially Occupied'
  --   with no agreement, and V-207 and V-301 are 'Reserved' at 0
  --   occupied while still carrying an assigned customer. Enforcing one
  --   leg of a coupling the data shows is loose would also reject a
  --   legitimate two-step UI write that sets status before zeroing
  --   contents.
  --
  -- DELIBERATELY ABSENT: NOT NULL on storage_agreement_id for occupied
  --   vaults, for the same reason.
);

alter table public.vaults enable row level security;

comment on table public.vaults is
  'The 14 physical vaults. vaults.storage_agreement_id is the ONLY representation of the vault-to-agreement relation; the agreement side is an aggregated vault_codes array from public.storage_agreements_expanded.';
comment on column public.vaults.code is
  'V-101.. The read DTO exposes this column AS `id`, which keeps getRowId, the accessorKey ''id'' under the header ''Vault'' and both search accessors working untouched.';
comment on column public.vaults.occupancy_percent is
  'Generated so occupancy can be sorted, filtered and indexed. NOTE for the dashboard: the Storage Occupancy card is SUM(occupied)/SUM(capacity), NOT AVG(occupancy_percent) -- those give 52% and 49.4% respectively, and this column makes the wrong one easy to reach.';

create index vaults_warehouse_location_id_idx on public.vaults (warehouse_location_id);
-- Serves the agreement -> vault_codes aggregate AND keeps ON DELETE SET
-- NULL from table-scanning.
create index vaults_storage_agreement_id_idx  on public.vaults (storage_agreement_id);
create index vaults_status_idx                on public.vaults (status);
-- The exact grouping key the Vaults panel builds its section headers from.
create index vaults_location_rack_idx         on public.vaults (warehouse_location_id, rack);
create index vaults_last_inspection_date_idx  on public.vaults (last_inspection_date);
-- Only reachable because occupancy is a stored generated column.
create index vaults_occupancy_percent_idx     on public.vaults (occupancy_percent);

create trigger trg_vaults_touch
  before update on public.vaults
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- calendar_events
--
-- ONE table for dispatch jobs, dispatch surveys and office events.
--
-- extendedProps becomes real typed columns plus one join table. The
-- decisive fact: extendedProps is rendered NOWHERE today, so there is no
-- backward-compatibility argument for preserving the nested shape, and
-- every reason to shape it properly -- clientName is 10/10 a real
-- client, estimator is 3/3 real staff, crew is 8/8 real staff. jsonb
-- would make all three unqueryable with integrity.
--
-- COLOR IS NOT STORED. It is derived from entity_type and it is a CSS
-- custom property, i.e. a design token. Storing a token in Postgres
-- makes a theme change a data migration. Office rows keep today's
-- undefined so the Office view's appearance is unchanged.
-- =====================================================================
create table public.calendar_events (
  id                    uuid        not null default gen_random_uuid(),

  -- JOB-4xxx, SUR-5xxx, and eleven NET-NEW OFF-6xxx for the office rows,
  -- which have no identity of any kind today.
  code                  text        not null,

  -- Lowercase here because these values are never rendered. The
  -- display-string rule applies to `status`, which is.
  entity_type           text        not null,

  title                 text        not null,

  -- A real instant. For all_day rows the convention is local midnight in
  -- America/Los_Angeles. timestamptz, not timestamp: a stored naive
  -- timestamp is a bug waiting for the first person who opens the
  -- calendar from another zone.
  starts_at             timestamptz not null,

  -- NULL for the one seeded job that has a start and no end. For all_day
  -- rows this is FullCalendar's EXCLUSIVE end, i.e. local midnight AFTER
  -- the last day. That convention is already producing a render one day
  -- shorter than one event's own note describes; the seed preserves the
  -- current render rather than silently correcting it.
  ends_at               timestamptz,

  all_day               boolean     not null default false,

  -- NULL for every office row. Office events have no status field today
  -- and inventing one would put a badge on the Office view that has
  -- never existed.
  status                text,

  client_id             uuid,
  estimator_id          uuid,

  -- NET-NEW and worth its place: the move-out job is exactly why one
  -- agreement reads 'Move-Out Scheduled', and the delivery job is
  -- exactly why another reads 'Pending Move-In'. Making it an FK is what
  -- lets the dead 'Schedule move-out' action create a bound event.
  storage_agreement_id  uuid,

  -- NET-NEW: three events happen at a facility rather than a client
  -- address. Lets the dispatch board filter by site without parsing
  -- address_line.
  warehouse_location_id uuid,

  -- Free text, NOT an FK to a client address. The seed values are
  -- heterogeneous on purpose: street addresses, facility locations, and
  -- nothing at all for office rows. It describes where the crew goes,
  -- which is not always a row in any address table.
  address_line          text,

  notes                 text,

  -- RECURRENCE: discrete rows grouped by series_id, NOT a recurrence
  -- rule. Maps 1:1 onto FullCalendar's groupId. @fullcalendar/rrule is
  -- not installed, an RRULE would have to be expanded server-side per
  -- window, only 4 of 21 rows recur, and every dispatch row carries
  -- per-occurrence status and crew that a rule cannot express. Upgrade
  -- path, documented not built: add recurrence_rule plus an expansion
  -- function only when a user can actually create a repeating event.
  series_id             uuid,

  is_seed               boolean     not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint calendar_events_pkey primary key (id),
  constraint calendar_events_code_key unique (code),
  constraint calendar_events_code_format check (code ~ '^(JOB|SUR|OFF)-[0-9]+$'),

  constraint calendar_events_client_id_fkey
    foreign key (client_id) references public.clients(id) on delete set null,
  constraint calendar_events_estimator_id_fkey
    foreign key (estimator_id) references public.staff(id) on delete set null,
  constraint calendar_events_storage_agreement_id_fkey
    foreign key (storage_agreement_id) references public.storage_agreements(id) on delete set null,
  constraint calendar_events_warehouse_location_id_fkey
    foreign key (warehouse_location_id) references public.warehouse_locations(id) on delete set null,

  constraint calendar_events_entity_type_check
    check (entity_type in ('job','survey','office')),
  constraint calendar_events_status_check
    check (status is null or status in (
      'Scheduled','In Progress','Completed','Delayed','On Hold','Canceled')),

  -- THE constraint that earns the single-table design: it encodes both
  -- shapes as one rule.
  constraint calendar_events_shape_check check (
    (entity_type = 'office' and status is null)
    or (entity_type in ('job','survey') and status is not null)),
  constraint calendar_events_office_has_no_client_check
    check (entity_type <> 'office' or client_id is null),

  constraint calendar_events_end_after_start_check
    check (ends_at is null or ends_at > starts_at),
  constraint calendar_events_title_not_blank_check
    check (length(btrim(title)) > 0)

  -- DELIBERATELY ABSENT: CHECK (estimator_id IS NULL OR entity_type =
  --   'survey'). True in the seed but it forbids recording a surveyor of
  --   record on a job, which is a plausible real workflow. Coincidence,
  --   not rule.
  -- DELIBERATELY ABSENT: NOT NULL on client_id for job/survey. All ten
  --   have one today, but an internal repositioning job legitimately
  --   does not.
);

alter table public.calendar_events enable row level security;

comment on table public.calendar_events is
  'One table for dispatch jobs, dispatch surveys and office events. entity_type = ''job'' is what the documents domain means by a job -- there is no separate jobs table anywhere (D5).';
comment on column public.calendar_events.all_day is
  'Chosen over a separate start_date/end_date pair so the date-window query stays ONE predicate over ONE indexable range for both kinds.';
comment on column public.calendar_events.is_seed is
  'D11. dev_seed.reseed_calendar scopes every UPDATE on THIS FLAG, never on `code LIKE ''JOB-4%''`: a real dispatcher-created JOB-4007 sits squarely inside that prefix and would be destroyed.';

create index calendar_events_starts_at_idx
  on public.calendar_events (starts_at);
-- Serves both ?view= branches: entity_type = 'office' and
-- entity_type IN ('job','survey').
create index calendar_events_entity_type_starts_at_idx
  on public.calendar_events (entity_type, starts_at);
create index calendar_events_client_id_idx
  on public.calendar_events (client_id);
create index calendar_events_estimator_id_idx
  on public.calendar_events (estimator_id);
create index calendar_events_storage_agreement_id_idx
  on public.calendar_events (storage_agreement_id);
create index calendar_events_warehouse_location_id_idx
  on public.calendar_events (warehouse_location_id);
-- LOOKUP INDEX ONLY. Explicitly never an on_conflict target; the seed
-- upserts on the UNIQUE (code) constraint.
create index calendar_events_series_id_idx
  on public.calendar_events (series_id) where series_id is not null;
-- Serves the reseed's is_seed-scoped scan.
create index calendar_events_is_seed_idx
  on public.calendar_events (is_seed) where is_seed;

create trigger trg_calendar_events_touch
  before update on public.calendar_events
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- calendar_event_crew
--
-- Replaces extendedProps.crew?: string[]. A real FK is the entire
-- argument against text[]: an array cannot be constrained, cannot answer
-- 'is Tyler double-booked on the 24th' without a containment scan, and
-- breaks the moment a person's name changes.
-- =====================================================================
create table public.calendar_event_crew (
  calendar_event_id uuid        not null,
  staff_id          uuid        not null,

  -- Preserves the source array order, which is meaningful: the Crew Lead
  -- is listed first on both jobs he works. This preserves the existing
  -- ordering rather than inventing an is_lead flag that appears nowhere.
  position          smallint    not null default 0,

  is_seed           boolean     not null default false,
  created_at        timestamptz not null default now(),

  -- A REAL composite unique constraint, so it is a valid on_conflict
  -- target for the reseed.
  constraint calendar_event_crew_pkey primary key (calendar_event_id, staff_id),
  constraint calendar_event_crew_event_fkey
    foreign key (calendar_event_id) references public.calendar_events(id) on delete cascade,
  -- RESTRICT: you must not silently erase who worked a completed move.
  -- Staff removal is a 'Deactivated' status change, not a DELETE.
  constraint calendar_event_crew_staff_fkey
    foreign key (staff_id) references public.staff(id) on delete restrict,
  constraint calendar_event_crew_position_check check (position >= 0)

  -- DELIBERATELY ABSENT: UNIQUE (calendar_event_id, position). It would
  --   enforce a strictly clean ordering but forces a two-phase update on
  --   every crew reorder, which is a bad trade for a display detail.
);

alter table public.calendar_event_crew enable row level security;

comment on table public.calendar_event_crew is
  'Crew roster per event. The composite PK indexes calendar_event_id as its leading column only, so staff_id needs its own index -- for "what is Tyler on this week" and so the ON DELETE RESTRICT check does not seq-scan.';

create index calendar_event_crew_staff_id_idx
  on public.calendar_event_crew (staff_id);
