-- =====================================================================
-- 0002_platform.sql
-- warehouse_locations, permission_sets, roles, staff, the HR record
-- (split two ways for PII), staff_locations, role_permission_sets.
--
-- D3 CYCLE: roles.owner_staff_id -> staff(id) and staff.role_id ->
-- roles(id) are a DDL cycle. Resolved by creating `roles` WITHOUT the
-- owner FK, creating `staff`, then ALTER TABLE ADD CONSTRAINT in THIS
-- SAME FILE. Creation order in this file is authoritative; do not
-- reorder it.
--
-- D12: `alter table ... enable row level security` sits immediately
-- after each create table. Policies land in the policy migration. Until
-- then every table here is deny-by-default (0 rows, no error) instead of
-- world-readable by the publishable key.
-- =====================================================================

-- =====================================================================
-- warehouse_locations
--
-- The three physical sites. Today "Oakland Warehouse" / "San Jose
-- Branch" / "Fremont Depot" appear as string literals in three separate
-- files; this is the most duplicated value in the app.
-- =====================================================================
create table public.warehouse_locations (
  id          uuid        not null default gen_random_uuid(),
  slug        text        not null,
  name        text        not null,
  sort_order  smallint    not null default 0,
  is_active   boolean     not null default true,
  is_seed     boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint warehouse_locations_pkey primary key (id),
  constraint warehouse_locations_slug_key unique (slug),
  constraint warehouse_locations_name_key unique (name),
  constraint warehouse_locations_name_not_blank check (length(btrim(name)) > 0),
  constraint warehouse_locations_slug_format  check (slug ~ '^[a-z0-9-]+$')
);

alter table public.warehouse_locations enable row level security;

comment on table public.warehouse_locations is
  'The three physical sites. Global reference data: readable by any active staff member, written behind has_perm(settings, true).';
comment on column public.warehouse_locations.slug is
  'Stable machine key and the on_conflict target for seeding. Separate from name so a rename never breaks a re-seed.';
comment on column public.warehouse_locations.name is
  'MUST stay byte-identical to the strings the UI filters compare against, or every location filter silently matches nothing.';
comment on column public.warehouse_locations.sort_order is
  'The filter dropdowns render Oakland, San Jose, Fremont. Alphabetical would visibly reorder two Selects, so ordering is data.';

-- Three rows. No index on sort_order or is_active: a seq scan is
-- strictly cheaper and an index here is noise.

create trigger trg_warehouse_locations_touch
  before update on public.warehouse_locations
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- permission_sets
--
-- The 16 distinct strings across the 9 Role.permissionSets arrays:
-- Users, Settings, Billing, Reports, Clients, Dispatch, Jobs, Fleet,
-- Calendar, Pipeline, Leads, Proposals, Storage, Vaults, Invoices,
-- Documents.
-- =====================================================================
create table public.permission_sets (
  id          uuid        not null default gen_random_uuid(),
  slug        text        not null,
  name        text        not null,
  description text,
  is_seed     boolean     not null default false,
  created_at  timestamptz not null default now(),

  constraint permission_sets_pkey primary key (id),
  constraint permission_sets_slug_key unique (slug),
  constraint permission_sets_name_key unique (name),
  constraint permission_sets_slug_format check (slug ~ '^[a-z0-9-]+$')
);

alter table public.permission_sets enable row level security;

comment on table public.permission_sets is
  'The 16 permission sets. app.has_any_perm validates its argument against slug and RAISES on an unknown one, so a typo is an error rather than a silent false.';
comment on column public.permission_sets.description is
  'Net new and nullable. The Permission sets tab renders a placeholder today; the seed has no descriptions and inventing 16 would be fabrication.';

-- =====================================================================
-- roles  (created WITHOUT the owner_staff_id FK -- D3)
--
-- The 9 access roles. `users: number` is deleted: the count becomes
-- COUNT(*) over staff.role_id, exposed by public.roles_expanded in 0007.
-- =====================================================================
create table public.roles (
  id               uuid        not null default gen_random_uuid(),
  slug             text        not null,
  name             text        not null,
  access_level     text        not null,
  is_system        boolean     not null default false,
  status           text        not null default 'Active',

  -- Role.group is not independent data. This derivation reproduces all
  -- nine seeded values exactly (Owner/Admin/Driver -> 'Needs review',
  -- Read-only -> 'System roles', the other five -> 'Custom roles') and
  -- keeps the roles table's grouping headers working unchanged, while
  -- removing the contradiction where group and status encoded the same
  -- fact. Immutable over same-row columns, so STORED is legal.
  group_label      text        not null generated always as (
                     case
                       when status = 'Needs review' then 'Needs review'
                       when is_system then 'System roles'
                       else 'Custom roles'
                     end
                   ) stored,

  -- FK added at the bottom of this file, after staff exists (D3).
  owner_staff_id   uuid,

  last_reviewed_on date,
  archived_at      timestamptz,
  is_seed          boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint roles_pkey primary key (id),
  constraint roles_slug_key unique (slug),
  constraint roles_name_key unique (name),
  constraint roles_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint roles_access_level_check check (access_level in ('Full','Scoped','Read only')),
  constraint roles_status_check       check (status in ('Active','Needs review'))
);

alter table public.roles enable row level security;

comment on table public.roles is
  'The 9 access roles. SELECT-only for authenticated, with NO exceptions: if a Scoped user can UPDATE roles.access_level they escalate without ever touching staff. Role editing goes through an RPC gated on has_perm(settings, true).';
comment on column public.roles.slug is
  'Immutable seed/upsert key. `name` is user-editable via the Edit role action, so name cannot be the on_conflict target.';
comment on column public.roles.is_system is
  'Extracted from Role.group: true for the two rows whose owner was the literal string "System". This is the fact the Type filter actually wants, and it is unreachable today because Owner group collapses to "Needs review".';
comment on column public.roles.owner_staff_id is
  'NULL means System-owned, which is why this cannot be NOT NULL. FK added by ALTER at the foot of this file (D3 cycle).';
comment on column public.roles.archived_at is
  'Soft archive. staff.role_id is ON DELETE RESTRICT, so an archived role with members must still resolve for display.';

create index roles_owner_staff_id_idx on public.roles (owner_staff_id);
-- No index on status, group_label or access_level. Nine rows.

create trigger trg_roles_touch
  before update on public.roles
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- staff
--
-- One table, 27 rows after reconciling the 25 UserRows with Morgan Ellis
-- and Priya Shah from src/data/users.ts. This is the FK target every
-- other domain points at.
-- =====================================================================
create table public.staff (
  id             uuid              not null default gen_random_uuid(),

  -- NULLABLE by design. Three seeded staff are 'Pending invite' and have
  -- never registered, and Grace Chen exists only in UserRow. Under the
  -- usual `profiles (id uuid primary key references auth.users)` shape
  -- those people could not be rows at all. Nullable + a REAL UNIQUE
  -- (Postgres allows many NULLs) keeps invited-but-unregistered staff
  -- first-class and stays a legal on_conflict target.
  auth_user_id   uuid,

  full_name      text              not null,

  -- THE natural seed key: the only field present in UserRow,
  -- src/data/users.ts and ProfileRecord alike. citext rather than
  -- text + lower() unique index because PostgREST's on_conflict takes
  -- column names and cannot resolve an expression index.
  work_email     extensions.citext not null,

  role_id        uuid              not null,
  team           text              not null,
  status         text              not null default 'Pending invite',
  avatar_url     text,

  -- UserRow.joinedDate is '12 Jan 2021, 8:00 AM' -- a real clock time,
  -- so timestamptz, read as America/Los_Angeles on the way in.
  joined_at      timestamptz       not null,

  -- UserRow.lastActive is minutes-ago, which would freeze to migration
  -- day. NULL is the honest value for the three Pending invite rows
  -- carrying the 90*24*60 sentinel.
  last_active_at timestamptz,

  is_seed        boolean           not null default false,
  created_at     timestamptz       not null default now(),
  updated_at     timestamptz       not null default now(),

  constraint staff_pkey primary key (id),
  constraint staff_work_email_key   unique (work_email),
  constraint staff_auth_user_id_key unique (auth_user_id),
  constraint staff_role_id_fkey
    foreign key (role_id) references public.roles(id) on delete restrict,
  constraint staff_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users(id) on delete set null,
  constraint staff_team_check check (team in (
    'Dispatch','Sales','Warehouse','Fleet & Maintenance',
    'Customer Service','Billing','HR & Admin','Leadership')),
  constraint staff_status_check check (status in (
    'Active','Pending invite','Deactivated','Locked','Suspended'))
);

alter table public.staff enable row level security;

comment on table public.staff is
  'Employment record, 27 rows. CROSS-CUTTING RULE: RLS gates the CALLER''s status = Active. It must NEVER filter a REFERENCED staff row by status -- Sofia Marchetti is Deactivated and owns 5 clients, 3 deals, and is SUR-5003''s estimator. Any join that requires the referenced row to be active silently drops those rows.';
comment on column public.staff.auth_user_id is
  'Claim-on-first-login, not an after-insert-on-auth.users trigger: the staff row pre-exists the auth user, and a trigger inside the signup transaction turns any failure into an opaque 500 that reads as a Supabase outage. Set only by public.claim_staff_for_current_user().';
comment on column public.staff.role_id is
  'ONE role per person. ON DELETE RESTRICT so a role with members cannot vanish; that is what roles.archived_at is for.';
comment on column public.staff.status is
  'An APPLICATION status, fully independent of auth state. A Deactivated row with a live session still authenticates, which is why the predicate helpers gate on this column and not merely on auth.uid() being non-null.';
comment on column public.staff.avatar_url is
  'NULL, never empty string. An empty string is a sentinel pretending to be data.';

create index staff_role_id_idx   on public.staff (role_id);
create index staff_status_idx    on public.staff (status);
create index staff_team_idx      on public.staff (team);
create index staff_joined_at_idx on public.staff (joined_at desc);
-- The UNIQUE indexes on work_email and auth_user_id come from the
-- constraints; the auth_user_id one is the lookup path for
-- app.current_staff_id().

create trigger trg_staff_touch
  before update on public.staff
  for each row execute function app.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- D3: close the roles/staff cycle now that both tables exist.
-- ---------------------------------------------------------------------
alter table public.roles
  add constraint roles_owner_staff_id_fkey
  foreign key (owner_staff_id) references public.staff(id) on delete set null;

-- =====================================================================
-- staff_profiles  --  the NON-sensitive HR record
--
-- D1 PII SPLIT, part one of two.
--
-- The split is a structural guarantee, not tidiness: a Dispatcher must
-- never be able to read a colleague's date of birth or home address, and
-- the only durable way to hold that line is for those columns to live in
-- a table whose read predicate cannot be widened by accident. If the
-- directory half is ever opened up for an org chart (job title, manager,
-- department), the sensitive half does not move with it.
--
-- INTENDED POLICY (written in the policy migration, not here):
--   SELECT / UPDATE  using ( staff_id = (select app.current_staff_id())
--                            or (select app.has_perm('users')) )
-- =====================================================================
create table public.staff_profiles (
  staff_id                uuid        not null,

  preferred_name          text,
  legal_name              text,
  pronouns                text,
  work_phone              text,

  -- NOT roles.name. src/data/users.ts conflates them by putting
  -- 'operations manager' in a field called role while UserRow.role holds
  -- an access role. Separating them is what lets Morgan Ellis be an
  -- Admin by access and an Operations Manager by title without inventing
  -- a tenth role.
  job_title               text,
  job_level               text,
  department              text,
  current_project         text,

  work_arrangement        text,
  primary_location_id     uuid,

  -- IANA zone. ProfileRecord.timeZone is 'Pacific Time (UTC-7)'; the
  -- offset is a DST artifact that is wrong for five months a year, so it
  -- is rendered with Intl rather than stored.
  time_zone               text        not null default 'America/Los_Angeles',

  employee_ref            text,
  employment_type         text,
  weekly_hours            numeric(5,2),

  -- ProfileRecord.schedule 'Monday-Friday / 7:00 AM-4:00 PM' is three
  -- facts in one string. ISO day-of-week 1..7.
  work_days               smallint[],
  work_start_time         time,
  work_end_time           time,

  contracting_entity      text,
  notice_period_days      integer,
  manager_staff_id        uuid,
  bio                     text,

  leave_policy            text,
  annual_leave_days       integer,
  carried_over_leave_days integer     not null default 0,
  used_leave_days         integer     not null default 0,
  scheduled_leave_days    integer     not null default 0,

  -- Derived, not stored: 20 + 0 - 8 = 12 reproduces the seeded
  -- 'remainingLeave' exactly. Generated so it can never drift from its
  -- three inputs, which a hand-maintained string eventually would.
  remaining_leave_days    integer     generated always as (
                            coalesce(annual_leave_days, 0)
                            + carried_over_leave_days
                            - used_leave_days
                          ) stored,

  pending_leave_requests  integer     not null default 0,
  leave_year_start        date,
  leave_year_end          date,
  next_leave_start        date,
  next_leave_end          date,
  last_working_day        date,

  updated_by_staff_id     uuid,
  is_seed                 boolean     not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint staff_profiles_pkey primary key (staff_id),
  constraint staff_profiles_staff_id_fkey
    foreign key (staff_id) references public.staff(id) on delete cascade,
  constraint staff_profiles_manager_staff_id_fkey
    foreign key (manager_staff_id) references public.staff(id) on delete set null,
  constraint staff_profiles_updated_by_staff_id_fkey
    foreign key (updated_by_staff_id) references public.staff(id) on delete set null,
  constraint staff_profiles_primary_location_id_fkey
    foreign key (primary_location_id) references public.warehouse_locations(id) on delete set null,
  constraint staff_profiles_employee_ref_key unique (employee_ref),

  constraint staff_profiles_work_arrangement_check
    check (work_arrangement in ('On-site','Hybrid','Remote')),
  constraint staff_profiles_employment_type_check
    check (employment_type in ('Employee','Contractor')),
  constraint staff_profiles_work_days_check
    check (work_days <@ array[1,2,3,4,5,6,7]::smallint[]),
  constraint staff_profiles_leave_year_order_check
    check (leave_year_end is null or leave_year_start is null or leave_year_end >= leave_year_start),
  constraint staff_profiles_next_leave_order_check
    check (next_leave_end is null or next_leave_start is null or next_leave_end >= next_leave_start),
  constraint staff_profiles_work_time_order_check
    check (work_end_time is null or work_start_time is null or work_end_time > work_start_time),
  constraint staff_profiles_not_self_managed_check
    check (manager_staff_id is null or manager_staff_id <> staff_id),
  constraint staff_profiles_notice_period_check check (notice_period_days >= 0),
  constraint staff_profiles_annual_leave_check   check (annual_leave_days >= 0),
  constraint staff_profiles_carried_leave_check  check (carried_over_leave_days >= 0),
  constraint staff_profiles_used_leave_check     check (used_leave_days >= 0),
  constraint staff_profiles_scheduled_leave_check check (scheduled_leave_days >= 0),
  constraint staff_profiles_pending_leave_check  check (pending_leave_requests >= 0)
);

alter table public.staff_profiles enable row level security;

comment on table public.staff_profiles is
  'The non-sensitive half of the HR record: 1:1 with staff. Date of birth, home address and emergency contact live in staff_profiles_sensitive (D1). Intended predicate: self OR has_perm(users).';

create index staff_profiles_manager_staff_id_idx    on public.staff_profiles (manager_staff_id);
create index staff_profiles_primary_location_id_idx on public.staff_profiles (primary_location_id);

create trigger trg_staff_profiles_touch
  before update on public.staff_profiles
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- staff_profiles_sensitive  --  D1 PII SPLIT, part two of two
--
-- Date of birth, home address, personal email, emergency contact.
--
-- INTENDED POLICY (policy migration):
--   SELECT / UPDATE  using ( staff_id = (select app.current_staff_id())
--                            or (select app.has_perm('users')) )
-- and NOTHING may widen it. This is the table a Dispatcher must never be
-- able to read for a colleague.
--
-- COMPENSATION: D1 names compensation fields as belonging here. The repo
-- has no compensation data at all -- profile-panel.tsx renders a
-- "Restricted information" placeholder under the Compensation tab and
-- ProfileRecord carries no pay columns. Nothing is invented here. When
-- compensation becomes real it lands in THIS table, not in
-- staff_profiles and not on staff.
-- =====================================================================
create table public.staff_profiles_sensitive (
  staff_id                       uuid        not null,

  date_of_birth                  date,
  home_address                   text,
  personal_email                 extensions.citext,

  emergency_contact_name         text,
  emergency_contact_relationship text,
  emergency_contact_phone        text,

  is_seed                        boolean     not null default false,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now(),

  constraint staff_profiles_sensitive_pkey primary key (staff_id),
  constraint staff_profiles_sensitive_staff_id_fkey
    foreign key (staff_id) references public.staff(id) on delete cascade
);

alter table public.staff_profiles_sensitive enable row level security;

comment on table public.staff_profiles_sensitive is
  'Restricted PII: date of birth, home address, personal email, emergency contact. Self or has_perm(users) only. Compensation lands here when it exists (D1).';
comment on column public.staff_profiles_sensitive.date_of_birth is
  'A calendar date, never a timestamp. The single most access-sensitive column in the platform domain and the reason this table exists.';
comment on column public.staff_profiles_sensitive.personal_email is
  'Deliberately NOT unique: two people can share a household.';

create trigger trg_staff_profiles_sensitive_touch
  before update on public.staff_profiles_sensitive
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- staff_locations
--
-- Replaces UserRow.location: string[]. Real cardinality: one person has
-- three, two have two, the other 24 have one.
-- =====================================================================
create table public.staff_locations (
  staff_id              uuid     not null,
  warehouse_location_id uuid     not null,

  -- The Users table's LocationCell renders only the FIRST location as an
  -- avatar plus a '+N' count, so which one is first is visible. Without
  -- position it would be nondeterministic across renders.
  position              smallint not null default 0,
  is_seed               boolean  not null default false,

  constraint staff_locations_pkey primary key (staff_id, warehouse_location_id),
  constraint staff_locations_staff_id_fkey
    foreign key (staff_id) references public.staff(id) on delete cascade,
  constraint staff_locations_warehouse_location_id_fkey
    foreign key (warehouse_location_id) references public.warehouse_locations(id) on delete restrict,
  constraint staff_locations_position_check check (position >= 0)
);

alter table public.staff_locations enable row level security;

comment on table public.staff_locations is
  'Staff to warehouse assignment. ON DELETE RESTRICT on the location: closing a warehouse while staff are assigned should fail loudly, not silently unassign 22 people.';

-- The composite PK indexes staff_id as its leading column only, so the
-- reverse direction (the Location filter) needs its own index.
create index staff_locations_warehouse_location_id_idx
  on public.staff_locations (warehouse_location_id);

-- =====================================================================
-- role_permission_sets
--
-- Many-to-many, 39 rows at seed (6+5+3+3+5+5+4+4+4).
-- =====================================================================
create table public.role_permission_sets (
  role_id           uuid     not null,
  permission_set_id uuid     not null,

  -- The roles table renders permissionSets.slice(0, 3) as badges and
  -- '+N' for the rest, so array order is presentation, not incidental.
  position          smallint not null default 0,
  is_seed           boolean  not null default false,

  constraint role_permission_sets_pkey primary key (role_id, permission_set_id),
  constraint role_permission_sets_role_id_fkey
    foreign key (role_id) references public.roles(id) on delete cascade,
  -- RESTRICT, not cascade: silently removing a permission set from every
  -- role because someone deleted the set is a security-relevant
  -- surprise. Force the caller to detach it first.
  constraint role_permission_sets_permission_set_id_fkey
    foreign key (permission_set_id) references public.permission_sets(id) on delete restrict,
  constraint role_permission_sets_position_check check (position >= 0)
);

alter table public.role_permission_sets enable row level security;

comment on table public.role_permission_sets is
  'Role to permission-set grants. SELECT-only for authenticated: INSERT here is an escalation path that never touches the staff table.';

-- Reverse lookup ("which roles use this set"), which is the whole point
-- of the Permission sets tab. The composite PK only indexes role_id.
create index role_permission_sets_permission_set_id_idx
  on public.role_permission_sets (permission_set_id);
