-- =====================================================================
-- 9999_security_guard.sql   (D13)
--
-- A RE-RUNNABLE ASSERTION SCRIPT. It creates nothing, changes nothing,
-- and RAISES on any deviation. Run it after this migration set and after
-- EVERY migration that follows. It is cheap; the failure it is looking
-- for is not.
--
-- WHY IT EXISTS. The catastrophic case measured on this project is
-- `forgot to enable RLS`, and no grant query catches it. The second
-- catastrophic case is a statement that reports success and does
-- nothing. Both of the security-critical statements in 0001 are of that
-- shape:
--
--   * `revoke usage on schema public from anon` succeeds and leaves anon
--     with USAGE, because the schema ACL carries `=U/pg_database_owner`
--     -- a grant to the PUBLIC pseudo-role that anon inherits. Measured:
--     revoke from anon -> still true; revoke from PUBLIC -> false.
--   * `alter default privileges in schema public revoke all on tables
--     from anon` silently no-ops when pg_default_acl.defaclrole is not
--     the executing role, and reports success either way.
--
-- Neither can be verified by reading the migration. That is why the
-- FIRST check below asserts the OUTCOME (`anon does not hold USAGE`) and
-- not the presence of the statement. A guard that checks that you wrote
-- the line is not a guard.
--
-- BREAK IT ON PURPOSE BEFORE YOU TRUST IT. A guard nobody has watched
-- fail is a guard with an unknown hole. The break list is at the foot of
-- this file, one statement per check.
--
-- COLLECTS, DOES NOT ABORT AT THE FIRST HIT. Every check below used to
-- `raise exception` the moment it found something wrong, which meant the
-- REST of the checks never ran that call -- a stale count in check 3
-- masked whatever checks 4 through 12 would have caught, for however
-- long it took someone to notice. Every check now appends its own
-- message to v_fail instead, and the block raises exactly once at the
-- end, naming every failing check in one message. The predicates
-- themselves are unchanged; only how a failure is reported changed.
-- =====================================================================

do $$
declare
  v_bad      text;
  v_n        integer;
  v_fail     text[] := array[]::text[];
  v_expected constant text[] := array[
    -- Every table and view in `public`, with the EXACT privilege list
    -- `authenticated` is meant to hold. This array is the contract; if
    -- you add a table you must add it here, and the guard is what makes
    -- that non-optional.
    --
    -- Written as 'object|PRIVILEGES' so it can be compared as a set in
    -- both directions: an unexpected grant AND a missing one both fail.
    'calendar_event_crew|DELETE, INSERT, SELECT, UPDATE',
    'calendar_events|DELETE, INSERT, SELECT, UPDATE',
    'clients|DELETE, INSERT, SELECT, UPDATE',
    'crew_rates|DELETE, INSERT, SELECT, UPDATE',
    'deals|DELETE, INSERT, SELECT, UPDATE',
    'document_folders|DELETE, INSERT, SELECT, UPDATE',
    'document_stars|DELETE, INSERT, SELECT, UPDATE',
    'fee_catalog|DELETE, INSERT, SELECT, UPDATE',
    'invoice_line_items|DELETE, INSERT, SELECT, UPDATE',
    'invoices|DELETE, INSERT, SELECT, UPDATE',
    'quote_line_items|DELETE, INSERT, SELECT, UPDATE',
    'quotes|DELETE, INSERT, SELECT, UPDATE',
    'rate_cards|DELETE, INSERT, SELECT, UPDATE',
    'staff_locations|DELETE, INSERT, SELECT, UPDATE',
    'staff_profiles|DELETE, INSERT, SELECT, UPDATE',
    'staff_profiles_sensitive|DELETE, INSERT, SELECT, UPDATE',
    'storage_agreements|DELETE, INSERT, SELECT, UPDATE',
    'tax_rates|DELETE, INSERT, SELECT, UPDATE',
    'vaults|DELETE, INSERT, SELECT, UPDATE',
    'warehouse_locations|DELETE, INSERT, SELECT, UPDATE',

    -- NO DELETE. 49 CFR 375.505(d) puts a one-year retention floor under
    -- every bill of lading, and the invoice From block must not be
    -- deletable out from under the invoices that print it.
    'company_billing_profile|INSERT, SELECT, UPDATE',
    'documents|INSERT, SELECT, UPDATE',

    -- SELECT ONLY. An UPDATE on roles.access_level or an INSERT into
    -- role_permission_sets is a promotion to every permission in the
    -- system that never touches the staff table.
    'permission_sets|SELECT',
    'role_permission_sets|SELECT',
    'roles|SELECT',

    -- SELECT ONLY at the table level. staff's two writable columns are a
    -- COLUMN grant and are asserted separately below, because
    -- role_table_grants cannot see them.
    'staff|SELECT',

    -- The two multi-tenancy tables added in 0012. SELECT ONLY: no
    -- switcher ships yet, so neither has a legitimate writer.
    'companies|SELECT',
    'user_active_company|SELECT',

    -- The four security_invoker views.
    'calendar_events_expanded|SELECT',
    'roles_expanded|SELECT',
    'storage_agreements_expanded|SELECT',
    'vaults_expanded|SELECT'
  ];
begin

  -- ===================================================================
  -- 1. anon must not hold USAGE on schema public.   *** FIRST ***
  --
  -- This is the outcome check, not a statement check, and it is first
  -- because everything else in the file is layered on top of it. Sign-in
  -- is GoTrue (/auth/v1/*), not PostgREST, so anon needs nothing in
  -- public and holding nothing is the whole posture.
  --
  -- It also neutralises the ONE pg_default_acl row this project cannot
  -- fix (check 2): a default grant of arwdDxtm to anon on a table in a
  -- schema anon cannot enter is inert.
  --
  -- If this fires, the cause is almost certainly that the revoke names
  -- `anon` instead of `public`. `revoke usage on schema public from
  -- anon` reports success and does nothing, because anon holds USAGE
  -- through the PUBLIC pseudo-role.
  -- ===================================================================
  if has_schema_privilege('anon', 'public', 'USAGE') then
    v_fail := array_append(v_fail, format(
      'CHECK 1 (anon schema USAGE): ANON HOLDS USAGE ON SCHEMA public. Revoking from `anon` is inert -- the grant is the `=U` PUBLIC entry in the schema ACL. Current ACL: %s',
      (select coalesce(nspacl::text, '(default: PUBLIC has USAGE)')
       from pg_namespace where nspname = 'public')));
  end if;

  -- ===================================================================
  -- 2. pg_default_acl must not hand anon or authenticated anything in
  --    public.
  --
  -- Parsed with aclexplode against the grantee OID rather than matched
  -- as a string: after 0001's ALTER DEFAULT PRIVILEGES the postgres row
  -- SURVIVES with anon and authenticated removed from its array, so
  -- "does a row exist" is the wrong question and would fail forever.
  --
  -- THE EXEMPTION, NAMED AND BOUNDED. There are two rows for schema
  -- public: defaclrole = postgres, which 0001 fixes, and defaclrole =
  -- supabase_admin, which grants anon and authenticated `arwdDxtm` and
  -- which a postgres-issued statement cannot reach. Measured on this
  -- project:
  --
  --   alter default privileges for role supabase_admin in schema ...
  --     -> 42501 : permission denied to change default privileges
  --   pg_has_role('postgres','supabase_admin','MEMBER') -> false
  --
  -- The exemption is therefore not a decision, it is a fact of the
  -- platform. What makes it safe to exempt is that a default ACL only
  -- fires for objects its defaclrole CREATES, so the exemption is
  -- guarded by check 2b: if supabase_admin ever owns a relation in
  -- public, the exemption is void and this raises. Under no
  -- circumstances may this exemption be widened to swallow the postgres
  -- row -- that row is ours and is fixable.
  -- ===================================================================
  select string_agg(format('%s(%s) grants %s to %s',
                           r.rolname, d.defaclobjtype, a.privilege_type, g.rolname),
                    '; ' order by r.rolname, g.rolname, a.privilege_type)
    into v_bad
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  join pg_roles r     on r.oid = d.defaclrole
  cross join lateral aclexplode(d.defaclacl) a
  join pg_roles g     on g.oid = a.grantee
  where n.nspname = 'public'
    and g.rolname in ('anon', 'authenticated')
    and r.rolname <> 'supabase_admin';   -- see the exemption note above

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 2 (default privileges): DEFAULT PRIVILEGES STILL OPEN in public -- every table created from now on lands granted: %s', v_bad));
  end if;

  -- 2b. The exemption's own guard. The unreachable supabase_admin
  --     default ACL can only fire for objects supabase_admin creates.
  select string_agg(c.relname, ', ' order by c.relname) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_roles r     on r.oid = c.relowner
  where n.nspname = 'public'
    and c.relkind in ('r','p','v','m','S')
    and r.rolname = 'supabase_admin';

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 2b (supabase_admin ownership): supabase_admin OWNS OBJECTS IN public (%s). Its pg_default_acl row grants anon and authenticated arwdDxtm and postgres cannot revoke it (measured 42501), so those objects are granted and the check-2 exemption is void.',
      v_bad));
  end if;

  -- ===================================================================
  -- 3. RLS enabled on every table -- all 29, public AND app.
  --
  -- app.code_counters is the 29th. It is deliberately scoped in here and
  -- deliberately scoped OUT of check 4. The count rose from 27 to 29 in
  -- 0012, which added public.companies and public.user_active_company.
  -- ===================================================================
  select string_agg(n.nspname || '.' || c.relname, ', ' order by n.nspname, c.relname)
    into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'app', 'dev_seed')
    and c.relkind in ('r','p')
    and not c.relrowsecurity;

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 3a (RLS enabled): RLS NOT ENABLED (readable by anyone holding a grant): %s', v_bad));
  end if;

  select count(*) into v_n
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'app', 'dev_seed') and c.relkind in ('r','p');

  if v_n <> 29 then
    v_fail := array_append(v_fail, format(
      'CHECK 3b (table count): EXPECTED 29 TABLES across public + app, found %s. A missing table means a migration did not land; an extra one means this guard has not been updated to cover it.',
      v_n));
  end if;

  -- ===================================================================
  -- 4. RLS on but NO POLICY = silent zero rows, the hardest symptom in
  --    this system to diagnose.
  --
  -- SCOPED TO public ON PURPOSE. app.code_counters has RLS on, no
  -- policy and no grant by design: it is written only by
  -- public.next_quote_code() / next_invoice_code(), which are SECURITY
  -- DEFINER and bypass both layers. A policy on it would be the defect.
  -- ===================================================================
  select string_agg(c.relname, ', ' order by c.relname) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','p')
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 4 (RLS with no policy): RLS ON BUT NO POLICY (every query returns 0 rows, no error): %s', v_bad));
  end if;

  -- ===================================================================
  -- 5. Every view must be security_invoker = true.
  --
  -- false is the POSTGRES DEFAULT, so a view created without the option
  -- is a silent RLS bypass: it reads as its owner. Measured, same
  -- caller, same instant -- invoker = true returned 1 row (matching a
  -- direct table read), invoker = false returned 2.
  -- ===================================================================
  select string_agg(c.relname, ', ' order by c.relname) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('v','m')
    and coalesce((select option_value
                  from pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'false') <> 'true';

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 5 (view security_invoker): VIEW BYPASSES RLS (security_invoker is not true, it reads as its owner): %s', v_bad));
  end if;

  -- ===================================================================
  -- 6. anon holds nothing. Table level and column level.
  -- ===================================================================
  select string_agg(distinct table_name || '.' || privilege_type, ', ') into v_bad
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon';

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 6a (anon table grants): anon STILL HOLDS TABLE PRIVILEGES in public: %s', v_bad));
  end if;

  select string_agg(distinct table_name || '.' || column_name || ':' || privilege_type, ', ') into v_bad
  from information_schema.column_privileges
  where table_schema = 'public' and grantee = 'anon';

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 6b (anon column grants): anon STILL HOLDS COLUMN PRIVILEGES in public (invisible to the table-level query): %s', v_bad));
  end if;

  -- ===================================================================
  -- 7. `authenticated` holds EXACTLY the expected set, per object.
  --
  -- This is the check the original design was missing. Proving anon
  -- holds nothing says nothing about authenticated, and the failure
  -- modes it catches are all silent: a DELETE on documents that dissolves
  -- the retention floor, DML on the role tables, a table created without
  -- grants that answers 42501 on the first read.
  --
  -- Compared as a SET IN BOTH DIRECTIONS. An unexpected grant fails, and
  -- so does a missing one.
  -- ===================================================================
  select string_agg(x.entry, E'\n    ' order by x.entry) into v_bad
  from (
    -- held but not expected
    select 'UNEXPECTED  ' || g.table_name || ' -> ' || g.privileges as entry
    from (
      select table_name,
             string_agg(distinct privilege_type, ', ' order by privilege_type) as privileges
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'authenticated'
      group by table_name
    ) g
    where (g.table_name || '|' || g.privileges) <> all (v_expected)

    union all

    -- expected but not held
    select 'MISSING     ' || e.entry as entry
    from unnest(v_expected) e(entry)
    where e.entry <> all (
      select g.table_name || '|' || g.privileges
      from (
        select table_name,
               string_agg(distinct privilege_type, ', ' order by privilege_type) as privileges
        from information_schema.role_table_grants
        where table_schema = 'public' and grantee = 'authenticated'
        group by table_name
      ) g
    )
  ) x;

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      E'CHECK 7 (authenticated grant set): authenticated GRANTS DO NOT MATCH THE EXPECTED SET:\n    %s', v_bad));
  end if;

  -- ===================================================================
  -- 8. The staff privilege escalation, named explicitly.
  --
  -- Redundant with checks 7 and 9 and kept anyway, because this is the
  -- one that has actually happened and the error message is the point.
  -- Measured: a Driver with a self-row UPDATE policy and a table-wide
  -- GRANT UPDATE promoted themselves to access_level 'Full' using only
  -- the publishable key and their own session.
  --
  -- column_privileges catches BOTH shapes -- a table-wide GRANT UPDATE
  -- expands to every column here, and an explicit column grant appears
  -- directly.
  -- ===================================================================
  select string_agg(column_name, ', ' order by column_name) into v_bad
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name   = 'staff'
    and grantee      = 'authenticated'
    and privilege_type in ('UPDATE','INSERT')
    and column_name in ('role_id','status','auth_user_id','work_email');

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 8 (staff escalation columns): PRIVILEGE ESCALATION: authenticated can write staff(%s). Those four columns move only through the SECURITY DEFINER RPCs in 0006. If you granted table-wide UPDATE to make the Profile screen work, the correct grant is `grant update (full_name, avatar_url) on public.staff to authenticated`.',
      v_bad));
  end if;

  -- ===================================================================
  -- 9. Column grants that no table grant accounts for.
  --
  -- Check 7 reads role_table_grants, which CANNOT SEE column-level
  -- grants -- measured: `grant update (full_name, avatar_url) on staff`
  -- shows up in column_privileges and nowhere in role_table_grants. So
  -- check 7 alone would pass a hand-placed `grant insert (role_id) on
  -- roles to authenticated`.
  --
  -- Every write column-privilege must be the projection of a table-level
  -- grant, with exactly two deliberate exceptions: staff's two
  -- self-editable columns.
  --
  -- Filtered to UPDATE/INSERT/DELETE deliberately. Unfiltered, this
  -- query also returns one SELECT row per column of each `grant select
  -- on <view>` -- 76 across the four views -- which is the expected
  -- column projection of a table-level grant, not a leak. Filtering
  -- removes it entirely, because a view can only ever carry SELECT, and
  -- makes the check independent of that count.
  -- ===================================================================
  select string_agg(distinct cp.table_name || '.' || cp.column_name || ':' || cp.privilege_type,
                    ', ' order by cp.table_name || '.' || cp.column_name || ':' || cp.privilege_type)
    into v_bad
  from information_schema.column_privileges cp
  where cp.table_schema = 'public'
    and cp.grantee      = 'authenticated'
    and cp.privilege_type in ('UPDATE','INSERT','DELETE')
    and not exists (
      select 1
      from information_schema.role_table_grants g
      where g.table_schema   = 'public'
        and g.grantee        = 'authenticated'
        and g.table_name     = cp.table_name
        and g.privilege_type = cp.privilege_type
    )
    and (cp.table_name || '.' || cp.column_name || ':' || cp.privilege_type) not in (
      'staff.full_name:UPDATE',
      'staff.avatar_url:UPDATE'
    );

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 9 (unaccounted column grants): UNACCOUNTED COLUMN GRANTS to authenticated (invisible to information_schema.role_table_grants): %s',
      v_bad));
  end if;

  -- ===================================================================
  -- 10. app.code_counters holds no grant.
  --
  -- `authenticated` has USAGE on schema app so it can call the predicate
  -- helpers, which makes this table nameable. The absence of a grant is
  -- doing real work.
  -- ===================================================================
  select string_agg(distinct grantee || ':' || privilege_type, ', ') into v_bad
  from information_schema.role_table_grants
  where table_schema = 'app' and table_name = 'code_counters'
    and grantee in ('anon','authenticated');

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 10 (code_counters grants): app.code_counters IS GRANTED to %s. It is written only by the SECURITY DEFINER code minters.', v_bad));
  end if;

  -- ===================================================================
  -- 11. D9: no sequence privileges, anywhere, for either role.
  --
  -- Codes are minted by SECURITY DEFINER functions over a counter TABLE,
  -- precisely so that no sequence grant is ever needed. A sequence grant
  -- appearing here means someone replaced a minting function with a
  -- serial and did not read D9.
  -- ===================================================================
  select string_agg(n.nspname || '.' || c.relname || ' -> ' || r.rolname, ', ') into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'),('authenticated')) as r(rolname)
  where n.nspname in ('public','app','dev_seed')
    and c.relkind = 'S'
    and ( has_sequence_privilege(r.rolname, c.oid, 'USAGE')
       or has_sequence_privilege(r.rolname, c.oid, 'SELECT')
       or has_sequence_privilege(r.rolname, c.oid, 'UPDATE') );

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 11 (sequence privileges): SEQUENCE PRIVILEGES GRANTED (D9 says never): %s', v_bad));
  end if;

  -- ===================================================================
  -- 12. Storage: the bucket is private and the retention floor is intact.
  --
  -- storage.objects has RLS enabled by Supabase and `authenticated`
  -- already holds table-level DELETE on it. The ONLY thing stopping a
  -- signed-in user from erasing a bill of lading is the ABSENCE of a
  -- DELETE policy, which makes that absence load-bearing rather than an
  -- omission -- and therefore something a guard has to assert.
  -- ===================================================================
  if not exists (select 1 from storage.buckets where id = 'documents') then
    v_fail := array_append(v_fail,
      'CHECK 12a (bucket exists): STORAGE BUCKET `documents` DOES NOT EXIST. Every Download button 404s.');
  end if;

  if exists (select 1 from storage.buckets where id = 'documents' and public) then
    v_fail := array_append(v_fail,
      'CHECK 12b (bucket private): STORAGE BUCKET `documents` IS PUBLIC. Every bill of lading is world-readable by URL.');
  end if;

  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    v_fail := array_append(v_fail,
      'CHECK 12c (storage.objects RLS): RLS IS OFF ON storage.objects and authenticated holds full DML on it.');
  end if;

  select string_agg(polname, ', ' order by polname) into v_bad
  from pg_policy
  where polrelid = 'storage.objects'::regclass
    and polcmd = 'd';

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 12d (no delete policy): A DELETE POLICY EXISTS ON storage.objects (%s). No policy is what enforces the 49 CFR 375.505(d) one-year bill-of-lading retention floor; hard delete is a service-role job.',
      v_bad));
  end if;

  select string_agg(e.want, ', ') into v_bad
  from unnest(array['documents_object_insert','documents_object_select','documents_object_update']) e(want)
  where not exists (
    select 1 from pg_policy p
    where p.polrelid = 'storage.objects'::regclass and p.polname = e.want
  );

  if v_bad is not null then
    v_fail := array_append(v_fail, format(
      'CHECK 12e (storage object policies): STORAGE OBJECT POLICIES MISSING (%s). Uploads and downloads will 403 for everyone.', v_bad));
  end if;

  -- ===================================================================
  -- Report every failure collected above, in one exception, or pass.
  -- ===================================================================
  if array_length(v_fail, 1) is not null then
    raise exception E'security guard: % of 12 checks failed:\n  - %',
      array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;

  raise notice 'security guard: all 12 checks passed.';
end
$$;


-- =====================================================================
-- BREAK IT ON PURPOSE. One statement per check, each of which MUST make
-- the block above raise. Run one, run the guard, watch it fire, undo it,
-- run the guard again and watch it pass. A guard nobody has seen fail is
-- a guard with an unknown hole.
--
--  1  grant usage on schema public to public;
--     undo: revoke usage on schema public from public;
--
--  2  alter default privileges in schema public grant select on tables to anon;
--     undo: alter default privileges in schema public revoke all on tables from anon;
--
--  2b (cannot be staged without superuser -- creating a relation in
--     public as supabase_admin. Exercise it by temporarily widening the
--     check-2 exemption to a role you CAN own objects as, and confirm it
--     names them.)
--
--  3  alter table public.clients disable row level security;
--     undo: alter table public.clients enable row level security;
--
--  4  drop policy clients_select on public.clients;   (then re-run 0008's statement)
--
--  5  create view public.v_break as select * from public.clients;
--     undo: drop view public.v_break;
--
--  6  grant select on public.clients to anon;
--     undo: revoke all on public.clients from anon;
--
--  7  grant delete on public.documents to authenticated;
--     undo: revoke delete on public.documents from authenticated;
--
--  8  grant update on public.staff to authenticated;
--     undo: revoke update on public.staff from authenticated;
--           grant update (full_name, avatar_url) on public.staff to authenticated;
--
--  9  grant insert (position) on public.role_permission_sets to authenticated;
--     undo: revoke insert (position) on public.role_permission_sets from authenticated;
--
-- 10  grant select on table app.code_counters to authenticated;
--     undo: revoke all on table app.code_counters from authenticated;
--
-- 11  (create a sequence in public and grant usage on it to authenticated)
--
-- 12  create policy documents_object_delete on storage.objects
--       for delete to authenticated using (bucket_id = 'documents');
--     undo: drop policy documents_object_delete on storage.objects;
--
-- ---------------------------------------------------------------------
-- WHAT THIS GUARD DOES NOT CATCH, stated so it is not mistaken for
-- coverage:
--
--   * It checks the SHAPE of access, not the SEMANTICS. A policy that
--     reads `using (true)` passes every check here. Exercising the
--     policy set as a real non-Full identity is the other half, and it
--     is not optional: verify as Elena Torres
--     (elena.torres@example.com, Dispatcher, Active), never as Morgan
--     Ellis or Grace Chen. Admin and Owner are access_level = 'Full',
--     and app.has_any_perm short-circuits on Full before it ever reads
--     role_permission_sets -- so every gate in the system passes for
--     them and every screen renders perfectly whether the policies are
--     right or not.
--
--   * It does not verify that seeded auth users exist. Until someone
--     signs in and public.claim_staff_for_current_user() runs, every
--     staff.auth_user_id is NULL, app.is_active_staff() is false for
--     everyone, and the entire app returns zero rows. That is correct
--     behaviour and it looks exactly like total failure.
-- =====================================================================
