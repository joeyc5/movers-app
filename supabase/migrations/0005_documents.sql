-- =====================================================================
-- 0005_documents.sql
-- document_folders, documents, document_stars.
--
-- D5: there is NO `jobs` table anywhere in this system. Operations folds
-- jobs into calendar_events with entity_type = 'job'. The FK is
-- `job_event_id -> calendar_events(id)`, and because a CHECK cannot
-- cross tables, a trigger asserts the referenced row really is a job.
--
-- D18: bytes live in one PRIVATE Supabase Storage bucket named
-- 'documents'. This table holds metadata ONLY. size, owner initials and
-- modified-time are deliberately NOT stored here -- they are joined from
-- storage.objects and public.staff. "Move to trash" sets deleted_at and
-- leaves the object, because 49 CFR 375.505(d) requires a household
-- goods carrier to retain each bill of lading for at least one year.
--
-- D12: RLS is enabled immediately after each create table.
-- =====================================================================

-- =====================================================================
-- document_folders
--
-- fileCount, size and updatedAt are all DELETED as stored fields: they
-- become COUNT(*), SUM over storage.objects, and MAX(objects.updated_at).
-- The seeded counts sum to 236 across six folders while the file array
-- has 12 rows -- the two arrays describe different worlds, so the cards
-- will show real, small numbers.
--
-- FOLDERS ARE FLAT. parent_id is deliberately omitted: all six folders
-- are top-level, the UI renders one grid with no breadcrumb and no
-- drill-in, and the set reads as a fixed operational taxonomy. Adding
-- parent_id costs one column but obligates breadcrumbs, move-to-folder,
-- cycle prevention and a recursive CTE for the rollups, none of which
-- exists. If nesting is ever wanted it is one non-breaking ALTER.
-- =====================================================================
create table public.document_folders (
  id         uuid        not null default gen_random_uuid(),
  slug       text        not null,
  name       text        not null,
  position   smallint    not null default 0,
  is_seed    boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint document_folders_pkey primary key (id),
  constraint document_folders_slug_key unique (slug),
  constraint document_folders_name_key unique (name),
  constraint document_folders_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint document_folders_position_check check (position >= 0)
);

alter table public.document_folders enable row level security;

comment on table public.document_folders is
  'The six folders. Flat by design. Counts and sizes on the folder cards are aggregates over documents and storage.objects, never stored here.';
comment on column public.document_folders.slug is
  'Preserves the existing folder ids verbatim as an immutable upsert key and as the URL segment when the folder route gets built. Rename is a UI action, so `name` cannot be the on_conflict target.';
comment on column public.document_folders.updated_at is
  'Row metadata only. The card''s "Updated 24 min ago" comes from the newest object in the folder, not from this column.';

create trigger trg_document_folders_touch
  before update on public.document_folders
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- documents
--
-- SCOPE MODEL: explicit nullable FKs, not polymorphic. `client_id` is a
-- denormalized ANCESTOR pointer that legitimately coexists with the
-- precise scope; deal_id / job_event_id / staff_id are mutually
-- exclusive. This is what lets the client-detail Documents tab run one
-- indexed predicate instead of a triple LEFT JOIN. A polymorphic
-- (owner_type, owner_id) pair would lose FK enforcement outright, lose
-- ON DELETE behaviour, and be unembeddable by PostgREST.
--
-- The price of the ancestor column, stated plainly: reassigning a job to
-- a different client must update its documents' client_id in the same
-- Server Action.
-- =====================================================================
create table public.documents (
  id               uuid        not null default gen_random_uuid(),

  -- NULLABLE because root-level documents are real: several seeded files
  -- fit none of the six folders, and inventing a seventh to avoid a NULL
  -- is worse.
  folder_id        uuid,

  -- Display filename including extension. NOT unique: two clients can
  -- both have 'bill of lading.pdf'.
  name             text        not null,

  kind             text        not null,

  -- Explicit rather than assumed. One bucket today; a second (a
  -- longer-retention archive bucket for the BOL floor) should not
  -- require a schema change.
  storage_bucket   text        not null default 'documents',

  -- The object key inside the bucket. UNIQUE does three jobs: one row
  -- per object, the seed upsert target, and the exact join key for the
  -- storage.objects RLS policy
  -- (`d.storage_path = storage.objects.name`), which means re-scoping a
  -- document between a client and a job never requires moving bytes.
  -- Path convention: clients/{client_id}/{document_id}-{slug}.pdf
  storage_path     text        not null,

  -- Retained (unlike size and modified-time) because it is chosen at
  -- upload, sets Content-Type on the signed download, and is enforced
  -- against the bucket's allowed_mime_types. Not CHECK-constrained: the
  -- set of legitimate MIME types is open.
  mime_type        text        not null,

  -- Replaces the free-text owner name and deletes ownerInitials
  -- entirely; getInitials() already exists in src/lib/utils.ts. Nullable
  -- + SET NULL so removing a staff member does not delete a bill of
  -- lading the company is legally required to retain.
  owner_staff_id   uuid,

  client_id        uuid,
  deal_id          uuid,

  -- D5. There is no jobs table. A job IS a calendar_events row with
  -- entity_type = 'job'; the trigger below asserts it.
  job_event_id     uuid,

  -- Folds the ProfileDocument rows into this table. CASCADE here, unlike
  -- the other scopes: an HR document for a deleted staff record has no
  -- owner and no retention argument.
  staff_id         uuid,

  visibility       text        not null default 'team',

  -- Gives the schema the affordance to RECEIVE an executed PDF without
  -- building a signing ceremony.
  signature_status text        not null default 'unsigned',
  signed_at        timestamptz,

  -- The e-sign vendor's document id, so a webhook can find the row it
  -- belongs to. UNIQUE is a real constraint and Postgres permits many
  -- NULLs, so the documents without one are fine and the ingest can
  -- on_conflict (external_ref) do update.
  external_ref     text,

  -- Soft delete. 49 CFR 375.505(d): a household goods carrier must
  -- retain each bill of lading for at least one year from creation, so
  -- "delete" in the UI cannot mean delete in storage. Hard delete is a
  -- scheduled service-role job past the retention window.
  deleted_at       timestamptz,

  is_seed          boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint documents_pkey primary key (id),
  constraint documents_storage_path_key unique (storage_path),
  constraint documents_external_ref_key unique (external_ref),

  constraint documents_folder_id_fkey
    foreign key (folder_id) references public.document_folders(id) on delete set null,
  constraint documents_owner_staff_id_fkey
    foreign key (owner_staff_id) references public.staff(id) on delete set null,
  constraint documents_client_id_fkey
    foreign key (client_id) references public.clients(id) on delete set null,
  constraint documents_deal_id_fkey
    foreign key (deal_id) references public.deals(id) on delete set null,
  constraint documents_job_event_id_fkey
    foreign key (job_event_id) references public.calendar_events(id) on delete set null,
  constraint documents_staff_id_fkey
    foreign key (staff_id) references public.staff(id) on delete cascade,

  -- The FileKind union verbatim, hyphens included: the icon map is a
  -- bare index used immediately AS A JSX COMPONENT, so an unrecognized
  -- label is a render-time crash, not a missing icon.
  constraint documents_kind_check check (kind in (
    'document','spreadsheet','pdf','archive',
    'contract','bill-of-lading','inventory','insurance-certificate')),

  -- Replaces BOTH FileManagerFile.shared and ProfileDocument.isRestricted
  -- with one lever RLS can read. 'team' means exactly "every active
  -- staff member" -- reading access semantics out of the old display-only
  -- `shared: false` would make five files vanish for everyone but their
  -- owner the moment RLS lands.
  constraint documents_visibility_check
    check (visibility in ('team','restricted','private')),

  constraint documents_signature_status_check
    check (signature_status in ('unsigned','out_for_signature','executed')),
  constraint documents_signed_at_agrees_check
    check ((signature_status = 'executed') = (signed_at is not null)),

  -- The PRECISE scope is exclusive. client_id is excluded from this
  -- because it is an ancestor pointer that legitimately coexists with
  -- deal_id or job_event_id.
  constraint documents_scope_exclusive_check
    check (num_nonnulls(deal_id, job_event_id, staff_id) <= 1),
  -- An HR document has no client ancestor.
  constraint documents_hr_has_no_client_check
    check (staff_id is null or client_id is null)
);

alter table public.documents enable row level security;

comment on table public.documents is
  'File metadata for one PRIVATE Storage bucket. size, owner initials and modified-time are NOT stored: join storage.objects (metadata size, updated_at) and public.staff. deleted_at is a soft delete held open by the 49 CFR 375.505(d) one-year bill-of-lading retention floor.';
comment on column public.documents.visibility is
  'Under D1, ''team'' resolves to app.is_active_staff() -- the column''s own stated semantics. Only ''restricted'' is permission-gated, and ''private'' is owner-only. Gating ''team'' on has_perm(documents) would show 7 of 27 staff the shared files and hand the other 20 an empty screen with no error.';
comment on column public.documents.job_event_id is
  'A bill of lading belongs to a JOB. There is no jobs table: a job is a calendar_events row with entity_type = ''job'', asserted by trg_documents_assert_job_event (D5).';
comment on column public.documents.deleted_at is
  'Set by "Move to trash". No DELETE policy exists for authenticated; hard delete past the retention window is a service-role job.';

create index documents_owner_staff_id_idx on public.documents (owner_staff_id);
create index documents_deal_id_idx        on public.documents (deal_id);
create index documents_job_event_id_idx   on public.documents (job_event_id);
-- The Profile > Documents tab.
create index documents_staff_id_idx       on public.documents (staff_id);

-- Partial indexes are used freely on this table: the rule about partial
-- indexes applies only to on_conflict targets, and the only upsert
-- target here is the plain UNIQUE (storage_path).
create index documents_client_id_idx
  on public.documents (client_id) where deleted_at is null;
create index documents_folder_id_idx
  on public.documents (folder_id) where deleted_at is null;
create index documents_kind_idx
  on public.documents (kind) where deleted_at is null;
create index documents_created_at_idx
  on public.documents (created_at desc) where deleted_at is null;

-- D14: schema-qualified opclass. The 'Search files and folders...' input
-- is substring search, which needs a trigram index, and pg_trgm installs
-- WITH SCHEMA extensions while the search_path during apply is not
-- pinned.
create index documents_name_trgm_idx
  on public.documents using gin (name extensions.gin_trgm_ops);

create trigger trg_documents_touch
  before update on public.documents
  for each row execute function app.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- D5: the entity_type = 'job' assertion.
--
-- A CHECK cannot read another table, so this is a trigger. Two of them,
-- because the assertion can be broken from either side: by pointing a
-- document at a non-job event, or by later changing that event's type.
-- ---------------------------------------------------------------------
create or replace function app.tg_documents_assert_job_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entity_type text;
begin
  if new.job_event_id is null then
    return new;
  end if;

  select e.entity_type into v_entity_type
  from public.calendar_events e
  where e.id = new.job_event_id;

  if v_entity_type is distinct from 'job' then
    raise exception
      'documents.job_event_id must reference a calendar_events row with entity_type = ''job'' (got %)',
      coalesce(v_entity_type, 'no such event')
      using errcode = '23514';
  end if;

  return new;
end
$$;

comment on function app.tg_documents_assert_job_event() is
  'D5: enforces that documents.job_event_id points at a job, not a survey or an office event. A CHECK cannot cross tables.';

create trigger trg_documents_assert_job_event
  before insert or update of job_event_id on public.documents
  for each row execute function app.tg_documents_assert_job_event();

create or replace function app.tg_calendar_events_protect_job_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.entity_type = 'job' and new.entity_type <> 'job'
     and exists (select 1 from public.documents d where d.job_event_id = old.id) then
    raise exception
      'cannot change entity_type away from ''job'': documents are attached to this event'
      using errcode = '23514';
  end if;
  return new;
end
$$;

comment on function app.tg_calendar_events_protect_job_type() is
  'The other half of the D5 assertion: a job with documents attached cannot be reclassified out from under them.';

create trigger trg_calendar_events_protect_job_type
  before update of entity_type on public.calendar_events
  for each row execute function app.tg_calendar_events_protect_job_type();

-- =====================================================================
-- document_stars
--
-- Per-viewer starring, replacing FileManagerFile.starred: boolean. A
-- join table rather than a boolean column because the UI reads
-- unambiguously as per-viewer -- a global boolean would mean one person
-- starring a file pins it for the entire company. Cost is one two-column
-- table.
-- =====================================================================
create table public.document_stars (
  staff_id    uuid        not null,
  document_id uuid        not null,
  created_at  timestamptz not null default now(),

  -- Real UNIQUE, so the star toggle is
  -- `on conflict (staff_id, document_id) do nothing` and the unstar is a
  -- plain delete.
  constraint document_stars_pkey primary key (staff_id, document_id),
  constraint document_stars_staff_id_fkey
    foreign key (staff_id) references public.staff(id) on delete cascade,
  constraint document_stars_document_id_fkey
    foreign key (document_id) references public.documents(id) on delete cascade
);

alter table public.document_stars enable row level security;

comment on table public.document_stars is
  'STRICTLY USER-SCOPED: every row belongs to one staff member and no one else may read it. Intended policy: staff_id = (select app.current_staff_id()) for ALL commands.';

-- Reverse lookup; the composite PK only indexes staff_id as a leading
-- column. The PK covers the hot path, "which documents has THIS viewer
-- starred", fetched as one set alongside the file list.
create index document_stars_document_id_idx on public.document_stars (document_id);

-- ---------------------------------------------------------------------
-- NOT IN THIS FILE, and not an oversight:
--
-- * The 'documents' Storage bucket row and the storage.objects policies
--   live in the policy migration alongside the public.documents
--   policies, because the object SELECT policy mirrors the row SELECT
--   policy exactly and the two must be written together.
--
-- * SQL cannot upload bytes. Seeding documents needs
--   scripts/seed-documents.ts, which uploads real (small) placeholder
--   objects and then upserts on storage_path. A documents row whose
--   storage_path points at nothing gives you a Download button that
--   404s, which is a figure that cannot be opened.
-- ---------------------------------------------------------------------
