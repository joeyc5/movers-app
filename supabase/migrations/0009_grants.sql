-- =====================================================================
-- 0009_grants.sql
-- Table and column grants for `authenticated`, the private `documents`
-- Storage bucket, and the storage.objects policies.
--
-- =====================================================================
-- A POLICY IS NOT A GRANT.
-- =====================================================================
--
-- 0008 wrote a permissive SELECT policy on all 26 public tables. Without
-- this file every one of them answers `42501 permission denied for table
-- clients` -- a table can land owned by postgres with correct RLS and
-- ZERO DML grants, and the policy is never even reached. The two failure
-- modes are distinguishable and that is the diagnostic:
--
--   42501 permission denied for table X   -> grant problem, look here
--   succeeds, returns 0 rows, no error    -> policy problem, look at 0008
--
-- Nothing is granted with `on all tables in schema public`. Every line
-- below names its table and its privilege list, because the two tables
-- that must NOT have DELETE (documents, company_billing_profile) and the
-- four that must have only SELECT (roles, permission_sets,
-- role_permission_sets, staff) are exactly the ones a blanket grant
-- would quietly open.
--
-- `anon` receives nothing, on any object, ever. 0001 additionally
-- revokes USAGE on schema public from the PUBLIC pseudo-role, which is
-- what actually takes it away -- see the note there.
--
-- =====================================================================
-- D9: NO SEQUENCE GRANTS. NOT ONE.
-- =====================================================================
--
-- There is no `grant usage on ... sequences` anywhere in this file and
-- there must never be. Every human code in the system -- QTE-YYYY-NNNN,
-- INV-YYYY-NNNN -- is minted inside public.next_quote_code() /
-- public.next_invoice_code(), which are SECURITY DEFINER over the
-- app.code_counters table and therefore need no privilege from the
-- caller at all. The counters are a table rather than a sequence on
-- purpose: a sequence does not roll back, so an aborted insert would
-- leave a hole in the invoice numbering, and "void rather than delete"
-- only keeps the series gapless if the minting is transactional too.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Close the door before opening the windows.
--
-- MEASURED on this project: pg_default_acl for (defaclrole = postgres,
-- nspname = public, objtype = r) grants anon AND authenticated
-- `arwdDxtm` on every new table, and migrations run as postgres. 0001
-- revokes that default, but this REVOKE is what covers anything created
-- before 0001 landed, anything created by a hand-run statement, and any
-- grant a dashboard action added.
--
-- NOTE: `all tables` in Postgres includes VIEWS. This statement
-- therefore strips the four view grants that 0007 issued, which is why
-- they are re-issued at the foot of this file rather than left to 0007.
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;


-- =====================================================================
-- PLATFORM
-- =====================================================================

grant select, insert, update, delete on public.warehouse_locations to authenticated;

-- ---------------------------------------------------------------------
-- THE ESCALATION GUARD, AND IT IS A COLUMN GRANT.
--
-- Measured: with a "staff may edit their own row" policy and a
-- table-wide GRANT UPDATE, a Driver ran
--
--   update staff set role_id = (select id from roles where slug='owner')
--    where id = (select app.current_staff_id());
--
-- and came back with access_level 'Full'. Using nothing but the
-- publishable key and their own session. The policy was not wrong --
-- POLICIES CANNOT EXPRESS COLUMN GRANULARITY AND GRANTS CAN. This is
-- the fix, and it is the reason the second verification query at the
-- foot of this file is not optional.
--
-- role_id, status, auth_user_id and work_email are unreachable by direct
-- DML for EVERY caller including access_level 'Full'. They move only
-- through the SECURITY DEFINER RPCs in 0006 (admin_set_staff_role,
-- admin_set_staff_status, admin_update_staff, admin_create_staff,
-- claim_staff_for_current_user), each of which gates itself, refuses to
-- let you change your own role or status, and refuses to leave the
-- company with no active Owner.
--
-- No INSERT: creating an employee is admin_create_staff.
-- No DELETE: removing one is a status change. calendar_event_crew's FK
--            is ON DELETE RESTRICT so you cannot erase who worked a
--            completed move.
-- ---------------------------------------------------------------------
grant select                            on public.staff to authenticated;
grant update (full_name, avatar_url)    on public.staff to authenticated;

grant select, insert, update, delete on public.staff_profiles           to authenticated;
grant select, insert, update, delete on public.staff_profiles_sensitive to authenticated;
grant select, insert, update, delete on public.staff_locations          to authenticated;

-- ---------------------------------------------------------------------
-- The role tables. SELECT and nothing else, forever.
--
-- 0008 writes no INSERT/UPDATE/DELETE policy on these three; this grant
-- is the second, independent layer. Either one alone would hold. Both
-- are here because an UPDATE on roles.access_level or an INSERT into
-- role_permission_sets is a promotion to every permission in the system
-- that never touches the staff table, and one layer is not enough for
-- that.
-- ---------------------------------------------------------------------
grant select on public.permission_sets      to authenticated;
grant select on public.roles                to authenticated;
grant select on public.role_permission_sets to authenticated;


-- =====================================================================
-- CRM
-- =====================================================================

grant select, insert, update, delete on public.clients            to authenticated;
grant select, insert, update, delete on public.rate_cards         to authenticated;
grant select, insert, update, delete on public.crew_rates         to authenticated;
grant select, insert, update, delete on public.fee_catalog        to authenticated;
grant select, insert, update, delete on public.tax_rates          to authenticated;
grant select, insert, update, delete on public.deals              to authenticated;
grant select, insert, update, delete on public.quotes             to authenticated;
grant select, insert, update, delete on public.quote_line_items   to authenticated;
grant select, insert, update, delete on public.invoices           to authenticated;
grant select, insert, update, delete on public.invoice_line_items to authenticated;

-- Singleton, id = 1, enforced by a CHECK. INSERT is granted so a fresh
-- environment can create the row from the Settings screen; DELETE is not,
-- because deleting it renders a blank From block on every invoice.
grant select, insert, update on public.company_billing_profile to authenticated;


-- =====================================================================
-- OPERATIONS
-- =====================================================================

grant select, insert, update, delete on public.storage_agreements   to authenticated;
grant select, insert, update, delete on public.vaults               to authenticated;
grant select, insert, update, delete on public.calendar_events      to authenticated;
grant select, insert, update, delete on public.calendar_event_crew  to authenticated;


-- =====================================================================
-- DOCUMENTS
-- =====================================================================

grant select, insert, update, delete on public.document_folders to authenticated;
grant select, insert, update, delete on public.document_stars   to authenticated;

-- ---------------------------------------------------------------------
-- NO DELETE ON documents. This is a regulatory floor, not a preference.
--
-- 49 CFR 375.505(d) requires a household goods carrier to retain each
-- bill of lading for at least one year from creation. "Move to trash" in
-- the UI sets deleted_at; the row and the object both stay. Hard delete
-- past the retention window is a service-role job that never runs on a
-- request path.
--
-- Withholding the grant AND writing no DELETE policy (0008) means the
-- floor is in the database rather than in the hope that the UI behaves.
-- ---------------------------------------------------------------------
grant select, insert, update on public.documents to authenticated;


-- =====================================================================
-- app.code_counters -- ZERO GRANTS, RESTATED EXPLICITLY.
--
-- `authenticated` holds USAGE on schema app (0001) so that it can call
-- the four predicate helpers. That USAGE makes this table NAMEABLE, so
-- the absence of a grant is doing real work and is worth stating out
-- loud rather than leaving to the reader to infer. RLS is on it as well
-- (0006) with no policy, so both layers deny independently.
--
-- The security guard asserts this is still true after every migration.
-- =====================================================================
revoke all on table app.code_counters from public, anon, authenticated;


-- =====================================================================
-- VIEWS
--
-- Re-issued here, not left to 0007: the `revoke all on all tables in
-- schema public` at the head of this file includes views, so 0007's
-- grants are gone by the time execution reaches this line. If you delete
-- that revoke, do not delete these.
--
-- All four are `with (security_invoker = true)`, so they read AS THE
-- CALLER and base-table RLS still decides what comes back. A SELECT
-- grant on them cannot widen anything. The reverse -- a view left at the
-- Postgres default of security_invoker = false -- is a silent RLS
-- bypass, measured at 2 rows where a direct table read returned 1. The
-- guard asserts the option on every view in public.
-- =====================================================================
grant select on public.vaults_expanded             to authenticated;
grant select on public.storage_agreements_expanded to authenticated;
grant select on public.calendar_events_expanded    to authenticated;
grant select on public.roles_expanded              to authenticated;


-- =====================================================================
-- STORAGE (D18)
--
-- One PRIVATE bucket, `documents`. 52428800 = 50 MiB, which clears a
-- scanned multi-page bill of lading with room to spare.
--
-- The bucket row is written with plain DML. Verified on this project:
-- storage.buckets carries `enforce_bucket_name_length_trigger` on INSERT
-- and `protect_buckets_delete` on DELETE, so an INSERT from a migration
-- is allowed and a DELETE is not ("Direct deletion from storage tables
-- is not allowed. Use the Storage API instead."). Removing this bucket
-- is therefore a Storage API operation, not a down-migration.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/msword',
    'application/zip'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- storage.objects policies.
--
-- storage.objects is owned by supabase_storage_admin and shared with
-- every future bucket, so each policy below is bucket-scoped and each is
-- dropped first: this is a platform-managed table and a dashboard action
-- can have left a policy of the same name behind. No grants are issued
-- on it -- Supabase already grants `authenticated` full DML there, which
-- is precisely why the absence of a DELETE policy is what denies
-- deletion. Do NOT "fix" that with `revoke delete on storage.objects`:
-- that is global and would silently break every bucket added later.
--
-- PATH CONVENTION (D18), written by the seed and by the upload action:
--     clients/{client_id}/{document_id}-{slug}.{ext}
--     deals/{deal_id}/{document_id}-{slug}.{ext}
--     staff/{staff_id}/{document_id}-{slug}.{ext}
--     company/shared/{document_id}-{slug}.{ext}
-- so (storage.foldername(name))[1] is the scope and
--    (storage.foldername(name))[2] is the id inside it.
--
-- WHY INSERT AND SELECT ARE KEYED DIFFERENTLY, stated so nobody
-- "corrects" one to match the other:
--
--   INSERT keys on the PATH. At upload time the metadata row does not
--   exist yet -- the browser streams bytes to a signed upload URL and a
--   second Server Action inserts public.documents afterwards -- so an
--   INSERT policy that joins public.documents can never match and every
--   upload 403s. It validates the scope segment and resolves
--   (storage.foldername(name))[2] against the real client/deal/staff id.
--
--   SELECT and UPDATE key on the METADATA ROW, joined on the UNIQUE
--   documents.storage_path. That is what makes the object policy MIRROR
--   the row policy rather than approximate it, and it means re-scoping a
--   document between a client and a job never requires moving bytes.
--
-- HOW THE MIRROR IS GUARANTEED. Measured on this project: a table
-- referenced inside a policy expression has ITS OWN RLS applied, as the
-- caller. So `exists (select 1 from public.documents d where
-- d.storage_path = storage.objects.name)` is already exactly the
-- documents SELECT policy, structurally, and cannot drift from it. The
-- predicate is ALSO written out below, deliberately duplicated, so that
-- a future grant change on public.documents cannot silently widen what
-- bytes are reachable. Both halves must agree; if you edit 0008's
-- documents_select, edit documents_object_select in the same commit.
-- ---------------------------------------------------------------------

drop policy if exists documents_object_insert on storage.objects;
create policy documents_object_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (select app.is_active_writer())
    and (
      -- Client-scoped. The id segment must resolve to a real client.
      -- Compared as text rather than cast to uuid: a malformed segment
      -- must be a clean policy denial, not a 22P02 that aborts the
      -- statement with an invalid-input-syntax error.
      (
        (storage.foldername(name))[1] = 'clients'
        and exists (
          select 1 from public.clients c
          where c.id::text = (storage.foldername(name))[2]
        )
      )
      or (
        (storage.foldername(name))[1] = 'deals'
        and exists (
          select 1 from public.deals d
          where d.id::text = (storage.foldername(name))[2]
        )
      )
      or (
        -- HR scope: your own folder, or an HR administrator's.
        (storage.foldername(name))[1] = 'staff'
        and (
             (storage.foldername(name))[2] = (select app.current_staff_id())::text
          or (select app.has_perm('users', true))
        )
      )
      or (
        -- Company-wide shelf. Library managers only -- nothing here
        -- belongs to a client, a deal or a person.
        (storage.foldername(name))[1] = 'company'
        and (storage.foldername(name))[2] = 'shared'
        and (select app.has_perm('documents', true))
      )
    )
  );

drop policy if exists documents_object_select on storage.objects;
create policy documents_object_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1
      from public.documents d
      where d.storage_bucket = 'documents'
        and d.storage_path   = storage.objects.name
        and (
          (
            d.deleted_at is null
            and (
                 ( d.visibility = 'team'       and (select app.is_active_staff()) )
              or ( d.visibility = 'restricted' and (select app.has_perm('users')) )
              or d.owner_staff_id = (select app.current_staff_id())
              or d.staff_id       = (select app.current_staff_id())
            )
          )
          or (
            d.deleted_at is not null
            and (
                 d.owner_staff_id = (select app.current_staff_id())
              or (select app.has_perm('documents', true))
            )
          )
        )
    )
  );

drop policy if exists documents_object_update on storage.objects;
create policy documents_object_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1
      from public.documents d
      where d.storage_bucket = 'documents'
        and d.storage_path   = storage.objects.name
        and d.deleted_at is null
        and (
             d.owner_staff_id = (select app.current_staff_id())
          or (select app.has_perm('documents', true))
        )
    )
  );

-- NO DELETE POLICY ON storage.objects, DELIBERATELY.
--
-- storage.objects has RLS enabled by Supabase, so the absence of a
-- policy denies deletion to `authenticated` outright even though the
-- platform grants it DELETE at the table level. That is the 49 CFR
-- 375.505(d) one-year bill-of-lading floor, expressed in the database.
-- Hard delete past the retention window runs with the secret key.


-- =====================================================================
-- THE TWO VERIFICATION QUERIES. SHIP BOTH. RUN BOTH.
-- =====================================================================
--
-- Query (A) is the standing check. Query (B) is the one that has to
-- accompany it, because COLUMN-LEVEL GRANTS ARE INVISIBLE TO (A).
-- Measured:
--
--     grant select on staff to authenticated;
--     grant update (full_name, avatar_url) on staff to authenticated;
--     -- role_table_grants  -> SELECT only. The UPDATE does not appear.
--     -- column_privileges  -> UPDATE (full_name), UPDATE (avatar_url)
--
-- That hole matters here specifically, because the privilege-escalation
-- fix on `staff` IS a column grant. A reviewer running only (A) sees "no
-- UPDATE on staff", concludes the Profile screen must be broken, grants
-- table-wide to fix it, and reopens the exact escalation this file was
-- written to close. Run (B) or you cannot see the fix you are undoing.
--
-- ---------------------------------------------------------------------
-- (A) Table-level grants.
--     Expected: ZERO rows for anon, on every object, forever.
--     Expected for authenticated, exactly:
--       select                          -> permission_sets, roles,
--                                          role_permission_sets, staff,
--                                          and the four _expanded views
--       select, insert, update          -> company_billing_profile,
--                                          documents
--       select, insert, update, delete  -> the other 20 tables
-- ---------------------------------------------------------------------
--   select table_name, grantee,
--          string_agg(privilege_type, ', ' order by privilege_type) as privileges
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and grantee in ('anon','authenticated','service_role')
--   group by table_name, grantee
--   order by table_name, grantee;
--
-- ---------------------------------------------------------------------
-- (B) Column-level grants. INVISIBLE TO (A).
--     Expected, in full, for anon and authenticated:
--       staff.avatar_url  UPDATE  authenticated
--       staff.full_name   UPDATE  authenticated
--     ...and NOTHING else. Any other UPDATE or INSERT row on `staff` is
--     the escalation.
-- ---------------------------------------------------------------------
--   select table_name, column_name, grantee, privilege_type
--   from information_schema.column_privileges
--   where table_schema = 'public'
--     and grantee in ('anon','authenticated')
--     and privilege_type in ('UPDATE','INSERT')
--   order by table_name, column_name;
--
-- ---------------------------------------------------------------------
-- (B') The same query WITHOUT the privilege_type filter, and the reason
--      the filter is there.
--
--      Unfiltered, (B) also returns one SELECT row per column of each of
--      the four `grant select on <view> to authenticated` statements
--      above. That is the column projection of a table-level grant --
--      information_schema.column_privileges expands every table-level
--      grant to every column -- and it is EXPECTED, NOT A LEAK. The four
--      views carry 19 + 16 + 24 + 17 = 76 columns between them, so that
--      is the order of magnitude to expect; a review note recorded 78,
--      and the discrepancy is a counting question, not a security one.
--
--      Neither the guard nor this checklist depends on the number.
--      Filtering on UPDATE/INSERT/DELETE removes the projection entirely,
--      because a view can only ever carry SELECT.
-- ---------------------------------------------------------------------
--   select table_name, column_name, grantee, privilege_type
--   from information_schema.column_privileges
--   where table_schema = 'public'
--     and grantee in ('anon','authenticated')
--   order by table_name, column_name, privilege_type;
--
-- ---------------------------------------------------------------------
-- (C) Sequences. Expected: zero rows, for both roles, forever (D9).
-- ---------------------------------------------------------------------
--   select c.relname, r.rolname,
--          has_sequence_privilege(r.rolname, c.oid, 'USAGE')  as usage,
--          has_sequence_privilege(r.rolname, c.oid, 'SELECT') as sel,
--          has_sequence_privilege(r.rolname, c.oid, 'UPDATE') as upd
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   cross join (values ('anon'),('authenticated')) as r(rolname)
--   where n.nspname in ('public','app') and c.relkind = 'S';
--
-- ---------------------------------------------------------------------
-- (D) Storage. Expected: bucket `documents` with public = false, and
--     exactly three policies on storage.objects -- insert, select,
--     update. NO delete policy. A fourth row named %delete% is the
--     retention floor coming off.
-- ---------------------------------------------------------------------
--   select id, name, public, file_size_limit from storage.buckets;
--   select polname, polcmd from pg_policy
--   where polrelid = 'storage.objects'::regclass order by polname;
--
-- 9999_security_guard.sql turns (A), (B) and (C) into assertions that
-- RAISE. Run it after this file and after every migration that follows.
-- =====================================================================
