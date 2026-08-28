-- =====================================================================
-- 0018_storage_grants.sql
--
-- Closes the last two unscoped surfaces: storage object paths, and
-- company_billing_profile, which 0013/0014/0016 all skipped because it
-- had no company_id yet.
--
-- Three changes:
--
--   A. company_billing_profile gets company_id AS ITS PRIMARY KEY, not a
--      surrogate column with a separate singleton CHECK. The PK IS the
--      company: that preserves "exactly one row per tenant" structurally,
--      the same job `check (id = 1)` did for "exactly one row, period,"
--      without an extra column and one more way to get it wrong. It gets
--      the same RESTRICTIVE tenant_isolation policy, byte-identical in
--      body to the 24 from 0016, so the count reaches 25.
--
--   B. Every existing storage path gains a leading company_id segment:
--        {company_id}/{scope}/{id}/{document_id}-{slug}.{ext}
--      instead of
--        {scope}/{id}/{document_id}-{slug}.{ext}
--      Repathed here, in the migration, not deferred to the seed script:
--      there are no bytes in the bucket yet (seed-documents.ts is unrun,
--      per HANDOFF.md), so the metadata row is the only thing that can be
--      wrong, and a data migration that depends on a script actually
--      being re-run later is a bug waiting to happen. All 15 existing
--      rows belong to Demo Movers, so this is a single unconditional
--      prefix, not a per-row lookup.
--
--   C. The three storage.objects policies get the same prefix check,
--      keyed on PATH ALONE, because the metadata row does not exist yet
--      at upload time for the insert policy. The select/update policies
--      already join public.documents (itself tenant-scoped since 0016),
--      but the path check is added anyway per the brief: a future grant
--      change on public.documents must not silently widen what bytes are
--      reachable through a path that no longer matches anyone's company.
--
--      A REAL BUG FOUND AND FIXED WHILE REWRITING documents_object_insert:
--      its clients branch read
--        exists (select 1 from public.clients c
--                 where c.id::text = (storage.foldername(name))[2])
--      with a bare `name`. public.clients HAS a column named `name` (the
--      customer's own name), so Postgres resolves the bare identifier to
--      the INNERMOST scope -- c.name, the client's name string -- not the
--      outer storage.objects row being inserted. storage.foldername() on
--      a customer name is nonsense and the branch can never match.
--      Measured on this project, pre-migration: a deals-scope insert
--      (public.deals has no `name` column, so the same bare reference
--      correctly resolved to the outer row) succeeded; the identical
--      shape against the clients branch was denied. The rewrite below
--      qualifies every reference as `objects.name`, matching the style
--      documents_object_select/_update already used for exactly this
--      reason, which is also why they never had the bug.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. company_billing_profile: rekey on company_id.
-- ---------------------------------------------------------------------
alter table public.company_billing_profile drop constraint company_billing_profile_singleton;
alter table public.company_billing_profile drop constraint company_billing_profile_pkey;
alter table public.company_billing_profile add column company_id uuid;

update public.company_billing_profile
   set company_id = (select id from public.companies where slug = 'demo-movers')
 where company_id is null;

alter table public.company_billing_profile alter column company_id set not null;
alter table public.company_billing_profile drop column id;

alter table public.company_billing_profile
  add constraint company_billing_profile_pkey primary key (company_id),
  add constraint company_billing_profile_company_fkey
    foreign key (company_id) references public.companies(id) on delete cascade;

alter table public.company_billing_profile
  alter column company_id set default app.current_company_id();

create policy tenant_isolation on public.company_billing_profile
  as restrictive for all to public
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

-- ---------------------------------------------------------------------
-- B. Repath every existing document. All 15 rows are Demo Movers'.
-- ---------------------------------------------------------------------
update public.documents
   set storage_path = company_id::text || '/' || storage_path;

-- ---------------------------------------------------------------------
-- C. storage.objects: add the company segment to all three policies.
-- ---------------------------------------------------------------------
drop policy documents_object_insert on storage.objects;
create policy documents_object_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(objects.name))[1] = (select app.current_company_id())::text
    and (select app.is_active_writer())
    and (
      -- Client-scoped. The id segment must resolve to a real client. The
      -- exists() below runs public.clients' OWN RLS as the caller (which
      -- is company-scoped since 0016), so a foreign company's client id
      -- can never match even before the path-prefix check above is
      -- considered -- two independent reasons the same insert is denied.
      (
        (storage.foldername(objects.name))[2] = 'clients'
        and exists (
          select 1 from public.clients c
          where c.id::text = (storage.foldername(objects.name))[3]
        )
      )
      or (
        (storage.foldername(objects.name))[2] = 'deals'
        and exists (
          select 1 from public.deals d
          where d.id::text = (storage.foldername(objects.name))[3]
        )
      )
      or (
        -- HR scope: your own folder, or an HR administrator's.
        (storage.foldername(objects.name))[2] = 'staff'
        and (
             (storage.foldername(objects.name))[3] = (select app.current_staff_id())::text
          or (select app.has_perm('users', true))
        )
      )
      or (
        -- Company-wide shelf. Library managers only.
        (storage.foldername(objects.name))[2] = 'company'
        and (storage.foldername(objects.name))[3] = 'shared'
        and (select app.has_perm('documents', true))
      )
    )
  );

drop policy documents_object_select on storage.objects;
create policy documents_object_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(objects.name))[1] = (select app.current_company_id())::text
    and exists (
      select 1
      from public.documents d
      where d.storage_bucket = 'documents'
        and d.storage_path   = objects.name
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

drop policy documents_object_update on storage.objects;
create policy documents_object_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(objects.name))[1] = (select app.current_company_id())::text
    and exists (
      select 1
      from public.documents d
      where d.storage_bucket = 'documents'
        and d.storage_path   = objects.name
        and d.deleted_at is null
        and (
             d.owner_staff_id = (select app.current_staff_id())
          or (select app.has_perm('documents', true))
        )
    )
  );

-- ---------------------------------------------------------------------
-- Re-issue grants. ALTER TABLE does not strip an existing table-level
-- grant, so this is not repairing damage from part A -- it is the same
-- insurance 0009 stated at its own foot: table grants and view grants
-- are asserted explicitly here rather than assumed to survive, because a
-- blanket `revoke all on all tables in schema public` anywhere in this
-- file would have taken the four view grants with it (0009_grants.sql:190).
-- This file contains no such revoke; these lines are the belt, not a
-- repair for a missing brace.
-- ---------------------------------------------------------------------
grant select, insert, update on public.company_billing_profile to authenticated;
grant select on public.vaults_expanded             to authenticated;
grant select on public.storage_agreements_expanded to authenticated;
grant select on public.calendar_events_expanded    to authenticated;
grant select on public.roles_expanded              to authenticated;
