-- =====================================================================
-- 0021_tenancy_guard.sql
--
-- The structural half of a re-runnable tenancy guard, in the same
-- collect-all-failures-then-raise-once style 9999_security_guard.sql was
-- just rewritten to use. 9999 proves the general access-control SHAPE;
-- this proves the tenancy-specific shape -- that every one of the 26
-- company-scoped tables (25 in public, plus app.code_counters) still has
-- its NOT NULL company_id, its FK pinning that company_id to a real
-- company, its composite FKs to sibling tenant tables, a company-scoped
-- unique/PK, the canonical RESTRICTIVE tenant_isolation policy, and the
-- immutability trigger -- and that service_role, which bypasses RLS
-- entirely, cannot defeat that last trigger by another route.
--
-- Task 10 proves the SEMANTICS (does the policy actually deny a foreign
-- company's row when exercised as a real, non-Full identity). Neither
-- half is trustworthy alone: this file would pass a policy that reads
-- `using (true)`.
--
-- Every check is driven off the catalog (pg_class / pg_constraint /
-- pg_index / pg_policy / pg_trigger), not off a hand-maintained table
-- list, and every exemption is a named array with a reason written next
-- to it. That is deliberate: a table added six months from now without
-- its company_id, its FK, its policy, or its trigger is covered BY
-- DEFAULT and fails loudly, and the only way to make it silent is the
-- visible edit of adding it to one of the arrays below.
-- =====================================================================

-- =====================================================================
-- Section A: close a real gap found while writing this guard.
--
-- company_billing_profile is the only one of the 26 scoped tables
-- without app.tg_company_id_immutable(). 0018 rekeyed it onto
-- company_id as its own primary key and gave it the FK to companies and
-- the tenant_isolation policy, but never added the trigger -- company_id
-- being the primary key does not make it immutable, Postgres allows
-- updating a primary key value like any other column.
--
-- Not yet exploitable: company_billing_profile_pkey means a service-role
-- UPDATE that re-parents this row to another company's id fails with a
-- unique violation as soon as that company already has its own billing
-- profile row, which both Demo Movers and Silicon Valley Moving &
-- Storage already do. It is still the one inconsistency among 26
-- identically-shaped tables, and it is the same class of omission 0015
-- already found and fixed once, for app.code_counters ("Step 1b: close
-- the gap the plan missed"). Section B does not exempt this table; it is
-- covered like the other 25, and this trigger is what makes it pass.
-- =====================================================================
create trigger trg_company_billing_profile_company_immutable
  before update on public.company_billing_profile
  for each row execute function app.tg_company_id_immutable();

-- =====================================================================
-- Section B: the assertions.
-- =====================================================================
do $$
declare
  v_bad  text;
  v_fail text[] := array[]::text[];

  -- Untenanted by design: the tenant root itself, and the global
  -- permission-set catalog shared by every company. Neither carries a
  -- company_id at all.
  v_root_tables text[] := array['companies','permission_sets'];

  -- Has company_id, but is not company-OWNED data: this row is a user's
  -- own active-company *selection*, keyed on auth_user_id. 0012 already
  -- writes the future policy for when a switcher ships and this row
  -- becomes writable, which means company_id here is meant to become
  -- MUTABLE -- the opposite of what checks 5 and 7 assert for every
  -- other table. Exempt on purpose, not by oversight.
  v_selector_tables text[] := array['user_active_company'];

  -- Named allowlist for check 5. All five are junction tables whose ONLY
  -- constraint is their primary key, over columns that are themselves
  -- globally-unique UUID foreign keys, each independently pinned to
  -- exactly one company by the composite FKs 0015 added, e.g.
  -- calendar_event_crew(company_id, staff_id) -> staff(company_id, id).
  -- Two UUIDs that already each belong to one company cannot jointly
  -- name a different one, so the PK needs no company_id column of its
  -- own. That reasoning is specific to these five and does not
  -- generalise -- a future junction table on non-UUID or non-tenant-
  -- pinned columns would need a real fix, not an entry here. Allowlisted
  -- by CONSTRAINT NAME, not table name, so replacing the constraint
  -- silently voids the exemption and the check starts firing again.
  v_pk_exempt text[] := array[
    'calendar_event_crew_pkey',
    'document_stars_pkey',
    'role_permission_sets_pkey',
    'staff_locations_pkey',
    'staff_profiles_sensitive_pkey'
  ];

  -- Named allowlist for check 4 (unique INDEXES, not constraints).
  -- documents_storage_path_key: the object-storage namespace this keys
  -- is global, not per-company (0015's note -- per-company uniqueness
  -- would let one company insert a documents row naming another
  -- company's real object key). companies_slug_key: slug IS the tenant
  -- key, so it is globally unique by definition. The companies table is
  -- already root-exempt above; this entry is kept anyway so the name
  -- stays traceable the way 0012's own comment promises.
  v_index_exempt text[] := array['documents_storage_path_key','companies_slug_key'];

  v_canonical constant text :=
    '(company_id = ( SELECT app.current_company_id() AS current_company_id))';
begin

  -- ===================================================================
  -- 1. Every non-root table, public AND app, has NOT NULL company_id.
  --    Catches: a new tenant table created without the column, or an
  --    ALTER TABLE ... DROP NOT NULL on an existing one.
  -- ===================================================================
  select string_agg(n.nspname||'.'||c.relname, ', ' order by 1) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','app') and c.relkind='r'
    and not (c.relname = any(v_root_tables))
    and not exists (select 1 from pg_attribute a
                     where a.attrelid=c.oid and a.attname='company_id'
                       and a.attnotnull and not a.attisdropped);
  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 1 (NOT NULL company_id): %s', v_bad));
  end if;

  -- ===================================================================
  -- 2. Every non-root table has a foreign key pinning company_id to
  --    public.companies(id). NOT NULL alone would pass a company_id that
  --    names nothing real. Scoped to public AND app so app.code_counters
  --    is covered and not exempted merely by living outside public --
  --    this is the check that closes that hole.
  -- ===================================================================
  select string_agg(n.nspname||'.'||c.relname, ', ' order by 1) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','app') and c.relkind='r'
    and not (c.relname = any(v_root_tables))
    and not exists (
      select 1 from pg_constraint fk
      where fk.conrelid = c.oid and fk.contype = 'f'
        and fk.confrelid = 'public.companies'::regclass
        and exists (select 1 from unnest(fk.conkey) k
                    join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k
                    where a.attname='company_id')
    );
  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 2 (FK to companies): %s', v_bad));
  end if;

  -- ===================================================================
  -- 3. Every FK between two scoped tables (public or app on both ends)
  --    includes company_id, so a row can never attach to a parent it
  --    does not share a tenant with, even if a policy is misconfigured
  --    or a service-role script has a bug. frel exemption mirrors check
  --    2's targets: an FK TO companies or permission_sets is a pointer
  --    at the root or a global catalog and is correctly single-column.
  -- ===================================================================
  select string_agg(c.conname, ', ' order by 1) into v_bad
  from pg_constraint c
  join pg_class rel on rel.oid=c.conrelid
  join pg_namespace reln on reln.oid = rel.relnamespace
  join pg_class frel on frel.oid=c.confrelid
  join pg_namespace freln on freln.oid = frel.relnamespace
  where c.contype='f' and reln.nspname in ('public','app')
    and freln.nspname in ('public','app')
    and not (frel.relname = any(v_root_tables))
    and not exists (select 1 from unnest(c.conkey) k
                    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k
                    where a.attname='company_id');
  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 3 (composite FK missing company_id): %s', v_bad));
  end if;

  -- ===================================================================
  -- 4. Every unique INDEX -- not a primary key, see check 5 for those --
  --    on a scoped table includes company_id, unless named-exempt.
  --    Reads pg_index, not pg_constraint: partial unique indexes such as
  --    rate_cards_single_default_idx and tax_rates_single_default_idx
  --    are not constraints and would be invisible to a pg_constraint-
  --    only sweep.
  -- ===================================================================
  select string_agg(ic.relname, ', ' order by 1) into v_bad
  from pg_index i
  join pg_class tc on tc.oid=i.indrelid
  join pg_namespace n on n.oid = tc.relnamespace
  join pg_class ic on ic.oid=i.indexrelid
  where i.indisunique and n.nspname in ('public','app')
    and not (tc.relname = any(v_root_tables))
    and not (ic.relname = any(v_index_exempt))
    and not i.indisprimary
    and not exists (select 1 from unnest(i.indkey::int[]) k
                    join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k
                    where a.attname='company_id');
  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 4 (unique index missing company_id): %s', v_bad));
  end if;

  -- ===================================================================
  -- 5. Every scoped table has AT LEAST ONE unique or primary-key
  --    constraint that includes company_id, unless its only qualifying
  --    constraint is named in v_pk_exempt.
  --
  --    contype IN ('u','p'), not just 'u'. A bare "unique" filter makes
  --    a table's PRIMARY KEY invisible, and for the five junction tables
  --    in v_pk_exempt the PK is the ONLY constraint they have. Check 4's
  --    "not indisprimary" shape would then have NOTHING LEFT TO INSPECT
  --    for those five and pass them by vacuous truth -- an index-level
  --    filter cannot tell "excluded because it's fine" from "excluded
  --    because there was nothing else to look at". That silent pass is
  --    the actual hole this check closes. Every other scoped table
  --    already carries a `(company_id, id)` (or equivalent) UNIQUE
  --    alongside its bare-id PK, so this passes them without requiring
  --    the PK itself to qualify.
  -- ===================================================================
  select string_agg(n.nspname||'.'||c.relname, ', ' order by 1) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','app') and c.relkind='r'
    and not (c.relname = any(v_root_tables))
    and not (c.relname = any(v_selector_tables))
    and not exists (
      select 1 from pg_constraint con
      where con.conrelid = c.oid and con.contype in ('u','p')
        and exists (select 1 from unnest(con.conkey) k
                    join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k
                    where a.attname='company_id')
    )
    and not exists (
      select 1 from pg_constraint con
      where con.conrelid = c.oid and con.contype = 'p'
        and con.conname = any(v_pk_exempt)
    );
  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 5 (no company-scoped unique/PK, and not in the named PK allowlist): %s', v_bad));
  end if;

  -- ===================================================================
  -- 6. Exactly one RESTRICTIVE tenant_isolation policy with the
  --    canonical body on every scoped table, except the selector table
  --    (own-row policy by design) and app.code_counters (RLS on, zero
  --    policies, zero grants, by design -- asserted directly by
  --    9999_security_guard.sql checks 4 and 10; a policy here would BE
  --    the defect, since only the SECURITY DEFINER minters may touch
  --    it, and they run as owner and bypass RLS entirely).
  -- ===================================================================
  select string_agg(n.nspname||'.'||c.relname, ', ' order by 1) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','app') and c.relkind='r'
    and not (c.relname = any(v_root_tables))
    and not (c.relname = any(v_selector_tables))
    and not (n.nspname = 'app' and c.relname = 'code_counters')
    and not exists (select 1 from pg_policy p
                     where p.polrelid=c.oid and not p.polpermissive
                       and p.polname='tenant_isolation'
                       and pg_get_expr(p.polqual, p.polrelid) = v_canonical);
  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 6 (missing canonical tenant policy): %s', v_bad));
  end if;

  -- ===================================================================
  -- 7. Every scoped table has the company_id immutability trigger,
  --    except the selector table (mutable by design -- see the
  --    v_selector_tables declaration above). company_billing_profile is
  --    deliberately NOT exempted: it was missing this trigger until
  --    Section A of this migration added it, and that prior omission is
  --    the reason this check exists, not a reason to carve out another
  --    exception.
  -- ===================================================================
  select string_agg(n.nspname||'.'||c.relname, ', ' order by 1) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','app') and c.relkind='r'
    and not (c.relname = any(v_root_tables))
    and not (c.relname = any(v_selector_tables))
    and not exists (select 1 from pg_trigger tg
                     where tg.tgrelid=c.oid and not tg.tgisinternal
                       and tg.tgfoid='app.tg_company_id_immutable()'::regprocedure);
  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 7 (missing immutability trigger): %s', v_bad));
  end if;

  -- ===================================================================
  -- 8. service_role cannot defeat the immutability triggers. Checks 1-7
  --    all rest on those triggers constraining service_role, the one
  --    role RLS does not touch (it holds BYPASSRLS). There are exactly
  --    two ways to defeat a trigger without dropping it: flip
  --    session_replication_role to 'replica' for the session (triggers
  --    stop firing), or ALTER TABLE ... DISABLE TRIGGER (needs
  --    ownership, not superuser). Measured on this project at the time
  --    of writing: session_replication_role has context 'superuser' with
  --    no pg_parameter_acl row naming it, and service_role has
  --    rolsuper=false, owns zero relations in public or app, and is a
  --    member of no role that does. Both sub-checks ask a CAPABILITY
  --    question (has_parameter_privilege, pg_has_role) rather than a
  --    catalog-shape question, so this keeps working if ownership or
  --    grants change shape without changing who can actually do this.
  -- ===================================================================
  if has_parameter_privilege('service_role', 'session_replication_role', 'SET') then
    v_fail := array_append(v_fail,
      'CHECK 8a (service_role GUC): service_role CAN SET session_replication_role. Setting it to ''replica'' silently stops every immutability trigger from firing for that session.');
  end if;

  if (select rolsuper from pg_roles where rolname = 'service_role') then
    v_fail := array_append(v_fail,
      'CHECK 8b (service_role superuser): service_role IS rolsuper. A superuser bypasses trigger enforcement entirely and every other part of this check is moot.');
  end if;

  select string_agg(distinct r.rolname, ', ' order by r.rolname) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_roles r on r.oid = c.relowner
  where n.nspname in ('public','app') and c.relkind = 'r'
    and ( r.rolname = 'service_role'
          or pg_has_role('service_role', r.rolname, 'USAGE') );
  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 8c (service_role ownership): service_role owns, or holds USAGE on the owning role of, a scoped table (%s). ALTER TABLE ... DISABLE TRIGGER needs only ownership, not superuser.',
      v_bad));
  end if;

  -- ===================================================================
  if array_length(v_fail, 1) is not null then
    raise exception E'tenancy guard: % of 8 checks failed:\n  - %',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;

  raise notice 'tenancy guard: all 8 checks passed.';
end $$;


-- =====================================================================
-- BREAK IT ON PURPOSE. One statement per check, each of which MUST make
-- the block above raise (or, for #3, must make the SEMANTIC half in
-- Task 10's supabase/tests/verify-isolation.sql raise instead -- see
-- its own note). Run one, run the guard, watch it fire, undo it, run
-- the guard again and watch it pass. A guard nobody has seen fail is a
-- guard with an unknown hole.
--
-- All six were run against this project (task-10-11-report.md has the
-- full transcript). Every check number below is what ACTUALLY fired,
-- confirmed empirically -- not assumed from reading the SQL. Two
-- differ from the brief that specified this task: the canonical-policy
-- check is CHECK 6 here, not 4, and the unique-index check is CHECK 4,
-- not 3, because a corrective provisioning migration took the 0020
-- slot this file would otherwise have had, shifting nothing in this
-- file's own numbering but apparently not in whoever wrote the brief's
-- memory of it either.
--
--  1  drop policy tenant_isolation on public.deals;
--     FIRES: CHECK 6 (missing canonical tenant policy) here, AND the
--     partition sum in verify-isolation.sql for public.deals (measured:
--     a Third Co identity, zero deals of its own, could suddenly count
--     all 15 of Demo's). deals_select's own permissive policy
--     (`using (is_active_staff())`) does not reference the ROW at all,
--     so with the restrictive policy gone there is nothing left to
--     stop it -- exactly the "using (true)"-shaped hole this guard's
--     own header warns it cannot see by itself.
--     undo: create policy tenant_isolation on public.deals as
--       restrictive for all to public
--       using (company_id = (select app.current_company_id()))
--       with check (company_id = (select app.current_company_id()));
--
--  2  as postgres (standing in for service_role -- see the file header
--     and the global note on why that substitution is equivalent):
--     update public.deals set company_id = '<svm>' where id = '<any demo deal>';
--     FIRES: 23514, raised by app.tg_company_id_immutable(). The
--     statement never succeeds, so there is nothing to undo.
--
--  3  create an orphan. A random uuid cannot be used directly: the FK
--     to companies (CHECK 2) rejects it before anything else can be
--     observed. Instead:
--       insert into public.companies (slug, name, status)
--         values ('orphan-co', 'Orphan Co (scratch)', 'Active');
--       insert into public.deals (company_id, code, client_name)
--         values ('<orphan-co id>', 'DEAL-8888888', 'Break Test Orphan Deal');
--     FIRES: nothing in THIS file. Checks 1, 2, 6, and 7 all stayed
--     green (measured) -- the orphan row has a real, valid company_id,
--     a real FK target, the canonical policy, and a working trigger; it
--     is structurally indistinguishable from a legitimate row. What
--     fires is the SUM half of Task 10's partition test: ground truth
--     for public.deals read total=16, demo=15, svm=0, thirdco=0, an
--     unaccounted remainder of 1. This is the exact case 0021's own
--     header names as the reason Task 10 exists at all, reproduced on
--     purpose. This break is the one place this task instructs you to
--     look for a check that does NOT fire -- and none of 0021's checks
--     did, by design; only the partition test catches it.
--     undo: delete from public.deals where code = 'DEAL-8888888';
--           delete from public.companies where slug = 'orphan-co';
--
--  4  insert into public.quote_line_items (company_id, quote_id, kind, description)
--       values ('<svm>', '<a demo quote id>', 'accessorial', 'Break Test Cross FK');
--     FIRES: 23503 on quote_line_items_quote_id_fkey (company_id,
--     quote_id) -> quotes(company_id, id). Never succeeds; nothing to
--     undo.
--
--  5  as a Demo Active identity holding `users` (Morgan Ellis or Grace
--     Chen -- no fixture needed):
--       select public.admin_set_staff_status('<svm staff uuid>', 'Deactivated');
--     FIRES: 22023 "no such staff member: <uuid>" -- confirms Task 6's
--     fix holds: the target is resolved within the caller's OWN
--     company, so a foreign uuid answers not-found rather than leaking
--     across the tenant wall or succeeding outright. Never succeeds;
--     nothing to undo.
--
--  6  alter table public.clients
--       drop constraint clients_company_code_key,
--       add constraint clients_code_key unique (code);
--     FIRES: CHECK 4 (unique index missing company_id: clients_code_key).
--     CHECK 5 stays green -- clients_company_id_key (company_id, id)
--     is a second, untouched company-scoped unique constraint on the
--     same table, so "at least one" is still satisfied. Both outcomes
--     were confirmed, not assumed.
--     undo: alter table public.clients
--       drop constraint clients_code_key,
--       add constraint clients_company_code_key unique (company_id, code);
--
-- All six were restored and both this guard and 9999_security_guard.sql
-- were re-run clean afterward. The database was left exactly as found
-- plus Third Co (select public.create_company('Third Co','third-co',
-- 'third@test.invalid','Third Owner')), which Task 10 needed and which
-- this project's working agreement keeps on purpose.
-- =====================================================================
