-- =====================================================================
-- supabase/tests/verify-isolation.sql
--
-- HOW TO RUN. Paste this entire file into ONE call to the Supabase MCP
-- `execute_sql` tool (project ref jannhzvqrsumtscidtkx), or into ONE
-- psql session with `\i supabase/tests/verify-isolation.sql`. It must
-- run as a single connection/session: it uses `pg_temp` helper objects
-- and `SET LOCAL ROLE`, both of which are session- and
-- transaction-scoped and do NOT survive across separate connections.
-- (Measured on this project: a second, separate `execute_sql` call
-- cannot see a `pg_temp` function created by an earlier call, because
-- each call is its own connection.)
--
-- Run as the `postgres` role (what MCP `execute_sql` connects as).
-- `postgres` owns every table and bypasses RLS, which is exactly what
-- lets it compute GROUND TRUTH counts and impersonate other identities
-- via `SET ROLE authenticated` -- see 0021_tenancy_guard.sql's own
-- comment on why `SET ROLE` is essential and `postgres` is safe to use
-- in place of a service-role key this project does not have.
--
-- WHAT THIS PROVES. For every scoped table, the row sets visible to
-- three real personas -- Demo Movers, Silicon Valley Moving & Storage,
-- and Third Co -- PARTITION the table: every persona's own count
-- equals the ground-truth count of rows that actually belong to it,
-- and nothing else. That is a stronger claim than "A cannot see B's
-- rows": it also catches ORPHANS (rows whose company_id resolves to
-- nobody), which a one-directional leak test cannot see and which
-- this codebase's own retros name as its hardest symptom to diagnose
-- (silent zero rows, no error). Third Co exists so a bug shaped like
-- `using (company_id is not null)` cannot pass by coincidence of equal
-- counts -- with only two companies, a leak FROM one INTO the other
-- can still balance the arithmetic; a third independent company makes
-- that arithmetically impossible to hide.
--
-- PREREQUISITE (already done, once, permanently -- not part of this
-- script): Third Co exists (`select public.create_company('Third Co',
-- 'third-co','third@test.invalid','Third Owner')`) and its Owner is
-- claimed by a real, impersonation-only auth.users row with no usable
-- password. That is permanent fixture data, on purpose: it is the
-- "plus Third Co" this project's tenancy work is meant to leave
-- behind. Nothing else this script touches is permanent -- see next.
--
-- SIDE EFFECTS: NONE. Every fixture this script needs beyond Third Co
-- is created or reused INSIDE the one transaction below and the
-- transaction ends in ROLLBACK. If SVM's Owner has already signed in
-- (the live account exists in auth.users and the staff row is Active),
-- the script reuses that identity instead of inserting a new one.
-- Nothing written here survives the script. Demo Movers, SVM, and
-- Third Co's pre-existing data are read-only throughout except for two
-- deliberate, asserted-then-rolled-back writes (assertions 2 and 3
-- below), which is why they too live inside the same transaction.
--
-- OUTPUT: one row per check via the final SELECT, with a `status`
-- column of PASS / FAIL / VACUOUS / INFO. VACUOUS means the table had
-- zero ground-truth rows across all three companies at run time --
-- SVM and Third Co are both nearly empty by design, so a naive "0 = 0"
-- would look like a pass without proving anything. A vacuous row is
-- not a failure, but it is not evidence either, and is reported as
-- its own status so the two are never conflated when reading results.
-- =====================================================================

begin;

create table pg_temp.results (
  seq        bigint generated always as identity,
  section    text not null,
  check_name text not null,
  status     text not null,
  detail     text
);

-- ---------------------------------------------------------------------
-- Self-contained RLS-count helper. Does its own role switch and its
-- own reset, entirely within its own body, so it never depends on
-- calling another pg_temp object while impersonated (which would raise
-- its own EXECUTE-privilege question). Catches the ONE expected
-- exception shape in this schema -- app.code_counters holds zero
-- grants for `authenticated` by design (9999_security_guard.sql check
-- 10), so counting it as an impersonated persona must raise 42501, not
-- return a number, and that is recorded as data, not as a script
-- failure.
-- ---------------------------------------------------------------------
create function pg_temp.rls_count(p_schema text, p_table text, p_uid uuid)
returns table(cnt bigint, errcode text, errmsg text)
language plpgsql
as $fn$
declare
  v_cnt bigint;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);

  begin
    execute format('select count(*) from %I.%I', p_schema, p_table) into v_cnt;
  exception when others then
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    return query select null::bigint, sqlstate, sqlerrm;
    return;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return query select v_cnt, null::text, null::text;
end;
$fn$;

do $test$
declare
  v_demo_id   uuid := 'a6a3540a-9a94-4ce8-a9a3-43808cf1ab9a';
  v_svm_id    uuid := 'b1db8df0-ed44-42a4-823e-5b0bfa7902f6';
  v_third_id  uuid := 'e17fa3f5-9666-46aa-9469-b0ccaf30e6e0';

  -- Demo persona: Morgan Ellis, Admin, access_level Full, already
  -- claimed and permanent -- no fixture needed.
  v_demo_uid  uuid := '132f4d05-1afd-47de-8374-56cdc8c9fb0d';
  -- Third Co persona: the permanent Owner fixture created outside this
  -- script (see header).
  v_third_uid uuid := '3d1bd6b5-0c25-4c73-a101-3f0e7685bf34';
  -- SVM persona: SVM's real Owner (Joey Childs). If an auth user
  -- for joey@siliconvalleymoving.com already exists (the live account),
  -- reuse it; otherwise create a transient fixture row. Either way the
  -- whole transaction rolls back, so nothing persists.
  v_svm_uid   uuid;
  v_joey_staff_id uuid := 'ebb4b433-940c-4a6a-b367-110fe5751691';

  -- Dual-membership tester: write permission in Demo, read-only in
  -- SVM. Built by direct staff-table DML, not the claim RPC -- 0022
  -- fixed the claim path so a caller can never legitimately hold two
  -- active memberships, which is exactly why this persona can no
  -- longer arise from product use and has to be constructed directly
  -- to prove the boundary still holds if it ever did.
  v_dual_uid  uuid;
  v_dual_demo_role  uuid;
  v_dual_svm_role   uuid := '42bda26b-f87b-46ab-94ee-e623659c0995'; -- svm read-only

  -- Zero-membership tester: no staff row anywhere.
  v_zero_uid  uuid;

  r           record;
  v_gt_total  bigint;
  v_gt_a      bigint;
  v_gt_b      bigint;
  v_gt_c      bigint;
  v_gt_other  bigint;
  v_pa        bigint; v_pa_err text;
  v_pb        bigint; v_pb_err text;
  v_pc        bigint; v_pc_err text;
  v_status    text;
  v_detail    text;

  v_root_tables     text[] := array['companies','permission_sets'];
  v_selector_tables text[] := array['user_active_company'];

  v_demo_client_id uuid;
  v_rowcount       int;
  v_state          text;
  v_sqlstate_seen  text;
  v_sqlerrm_seen   text;
  v_uid_seen       uuid;
  v_company_seen   uuid;
begin
  -- ===================================================================
  -- FIXTURE SETUP (all rolled back with the rest of this transaction)
  -- ===================================================================

  -- SVM impersonation target: reuse the live auth user if one exists
  -- for joey@siliconvalleymoving.com (the real account), otherwise
  -- create a transient fixture row. Then claim the staff row only if
  -- it is still unclaimed (0022 blocks a second membership, so calling
  -- the claim RPC on an already-Active owner would fail).
  select id into v_svm_uid
    from auth.users
   where email = 'joey@siliconvalleymoving.com'
   limit 1;

  if v_svm_uid is null then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      'joey@siliconvalleymoving.com', '', now(), '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"seeded":true,"fixture":true,"note":"verify-isolation.sql transient impersonation target, rolled back"}'::jsonb,
      null, now(), now(), false, false
    ) returning id into v_svm_uid;
  end if;

  if not exists (
    select 1 from public.staff
     where id = v_joey_staff_id
       and auth_user_id is not null
       and status = 'Active'
  ) then
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_svm_uid, 'role', 'authenticated')::text, true);
    perform public.claim_staff_for_current_user();
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  else
    select auth_user_id into v_svm_uid
      from public.staff where id = v_joey_staff_id;
  end if;

  insert into pg_temp.results (section, check_name, status, detail)
  select 'harness', 'svm persona claimed', case when s.auth_user_id = v_svm_uid and s.status = 'Active'
           then 'PASS' else 'FAIL' end,
         format('joey staff row: auth_user_id=%s status=%s', s.auth_user_id, s.status)
  from public.staff s where s.id = v_joey_staff_id;

  -- Dual-membership tester.
  select id into v_dual_demo_role from public.roles where company_id = v_demo_id and slug = 'sales-rep';

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'fixture.dualwrite.isolationtest@example.com', '', now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"seeded":true,"fixture":true,"note":"verify-isolation.sql dual-membership tester, rolled back"}'::jsonb,
    null, now(), now(), false, false
  ) returning id into v_dual_uid;

  -- Built directly, not via claim_staff_for_current_user(): post-0022
  -- that RPC will not create this state from a real sign-in. Proving
  -- the boundary still holds if this state existed anyway is the
  -- point of assertion 4 below.
  insert into public.staff (company_id, full_name, work_email, role_id, team, status, auth_user_id, joined_at)
  values (v_demo_id, 'Isolation Test Dual', 'fixture.dualwrite.isolationtest@example.com'::extensions.citext,
          v_dual_demo_role, 'Sales', 'Active', v_dual_uid, now());

  insert into public.staff (company_id, full_name, work_email, role_id, team, status, auth_user_id, joined_at)
  values (v_svm_id, 'Isolation Test Dual', 'fixture.dualwrite.isolationtest@example.com'::extensions.citext,
          v_dual_svm_role, 'Sales', 'Active', v_dual_uid, now());

  -- Pin the active company to SVM so current_company_id() resolves
  -- deterministically to SVM rather than "oldest Active membership".
  insert into public.user_active_company (auth_user_id, company_id)
  values (v_dual_uid, v_svm_id);

  -- Zero-membership tester: an auth user with no staff row anywhere.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'fixture.zeromember.isolationtest@example.com', '', now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"seeded":true,"fixture":true,"note":"verify-isolation.sql zero-membership tester, rolled back"}'::jsonb,
    null, now(), now(), false, false
  ) returning id into v_zero_uid;

  -- ===================================================================
  -- HARNESS SANITY: prove impersonation actually lands before trusting
  -- any count built on top of it. This is the repo's own named hardest
  -- symptom (silent zero rows) turned into a check on the test harness
  -- itself, not just on the schema.
  -- ===================================================================
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_demo_uid, 'role','authenticated')::text, true);
  select auth.uid(), app.current_company_id() into v_uid_seen, v_company_seen;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  insert into pg_temp.results (section, check_name, status, detail)
  values ('harness', 'demo identity lands',
    case when v_uid_seen = v_demo_uid and v_company_seen = v_demo_id then 'PASS' else 'FAIL' end,
    format('auth.uid()=%s current_company_id()=%s', v_uid_seen, v_company_seen));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_svm_uid, 'role','authenticated')::text, true);
  select auth.uid(), app.current_company_id() into v_uid_seen, v_company_seen;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  insert into pg_temp.results (section, check_name, status, detail)
  values ('harness', 'svm identity lands',
    case when v_uid_seen = v_svm_uid and v_company_seen = v_svm_id then 'PASS' else 'FAIL' end,
    format('auth.uid()=%s current_company_id()=%s', v_uid_seen, v_company_seen));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_third_uid, 'role','authenticated')::text, true);
  select auth.uid(), app.current_company_id() into v_uid_seen, v_company_seen;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  insert into pg_temp.results (section, check_name, status, detail)
  values ('harness', 'thirdco identity lands',
    case when v_uid_seen = v_third_uid and v_company_seen = v_third_id then 'PASS' else 'FAIL' end,
    format('auth.uid()=%s current_company_id()=%s', v_uid_seen, v_company_seen));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_dual_uid, 'role','authenticated')::text, true);
  select auth.uid(), app.current_company_id() into v_uid_seen, v_company_seen;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  insert into pg_temp.results (section, check_name, status, detail)
  values ('harness', 'dual identity lands (pinned to svm)',
    case when v_uid_seen = v_dual_uid and v_company_seen = v_svm_id then 'PASS' else 'FAIL' end,
    format('auth.uid()=%s current_company_id()=%s', v_uid_seen, v_company_seen));

  -- ===================================================================
  -- THE PARTITION CHECK. Iterate pg_class, not a hardcoded list, so a
  -- table added later is covered automatically. 'companies',
  -- 'permission_sets' (no company_id -- root of the tenant tree / a
  -- global shared catalog) and 'user_active_company' (a user's own
  -- selection row, keyed on auth_user_id, not company-owned data) are
  -- excluded from the generic company_id loop for the SAME reasons
  -- 0021_tenancy_guard.sql names them as v_root_tables /
  -- v_selector_tables, and are each given their own targeted assertion
  -- below the loop instead of being silently skipped.
  -- ===================================================================
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public','app') and c.relkind = 'r'
      and not (c.relname = any(v_root_tables))
      and not (c.relname = any(v_selector_tables))
    order by 1, 2
  loop
    execute format(
      'select count(*), count(*) filter (where company_id = %L), count(*) filter (where company_id = %L), count(*) filter (where company_id = %L) from %I.%I',
      v_demo_id, v_svm_id, v_third_id, r.schema_name, r.table_name)
      into v_gt_total, v_gt_a, v_gt_b, v_gt_c;
    v_gt_other := v_gt_total - v_gt_a - v_gt_b - v_gt_c;

    select cnt, errcode into v_pa, v_pa_err from pg_temp.rls_count(r.schema_name, r.table_name, v_demo_uid);
    select cnt, errcode into v_pb, v_pb_err from pg_temp.rls_count(r.schema_name, r.table_name, v_svm_uid);
    select cnt, errcode into v_pc, v_pc_err from pg_temp.rls_count(r.schema_name, r.table_name, v_third_uid);

    v_detail := format(
      'ground truth: total=%s demo=%s svm=%s thirdco=%s other=%s | persona counts: demo=%s(%s) svm=%s(%s) thirdco=%s(%s)',
      v_gt_total, v_gt_a, v_gt_b, v_gt_c, v_gt_other,
      coalesce(v_pa::text, 'ERR'), coalesce(v_pa_err, 'ok'),
      coalesce(v_pb::text, 'ERR'), coalesce(v_pb_err, 'ok'),
      coalesce(v_pc::text, 'ERR'), coalesce(v_pc_err, 'ok'));

    if r.schema_name = 'app' and r.table_name = 'code_counters' then
      -- Zero grants for `authenticated` by design. All three personas
      -- must be DENIED (42501), not return a count.
      if v_pa_err = '42501' and v_pb_err = '42501' and v_pc_err = '42501' then
        v_status := 'PASS';
      else
        v_status := 'FAIL';
      end if;
    elsif v_gt_total = 0 then
      v_status := 'VACUOUS';
    elsif v_gt_other <> 0 then
      -- Rows belonging to some company outside the three known ones --
      -- should not exist at this point in the run; flag loudly rather
      -- than let it silently distort the sum check below.
      v_status := 'FAIL';
    elsif v_pa is not distinct from v_gt_a and v_pb is not distinct from v_gt_b and v_pc is not distinct from v_gt_c
          and (v_gt_a + v_gt_b + v_gt_c) = v_gt_total then
      v_status := 'PASS';
    else
      v_status := 'FAIL';
    end if;

    insert into pg_temp.results (section, check_name, status, detail)
    values ('partition', r.schema_name || '.' || r.table_name, v_status, v_detail);
  end loop;

  -- ===================================================================
  -- The three excluded tables, each with its own targeted check.
  -- ===================================================================

  -- companies: no company_id column; the tenant root itself. Each
  -- persona must see EXACTLY its own row (companies_select: `using (id
  -- = current_company_id())`) and nothing else. Disjoint by
  -- construction (keyed on id, three different ids) and the sum must
  -- equal the total row count (3, at this point in the run).
  select count(*) into v_gt_total from public.companies;
  select cnt into v_pa from pg_temp.rls_count('public', 'companies', v_demo_uid);
  select cnt into v_pb from pg_temp.rls_count('public', 'companies', v_svm_uid);
  select cnt into v_pc from pg_temp.rls_count('public', 'companies', v_third_uid);
  insert into pg_temp.results (section, check_name, status, detail)
  values ('excluded-table', 'public.companies (root, keyed on id)',
    case when v_pa = 1 and v_pb = 1 and v_pc = 1 and v_gt_total >= 3 then 'PASS' else 'FAIL' end,
    format('total=%s demo_sees=%s svm_sees=%s thirdco_sees=%s', v_gt_total, v_pa, v_pb, v_pc));

  -- permission_sets: global shared catalog, no company_id, every
  -- persona should see the SAME full set (SELECT-only, no isolation
  -- policy at all -- it is not tenant data).
  select count(*) into v_gt_total from public.permission_sets;
  select cnt into v_pa from pg_temp.rls_count('public', 'permission_sets', v_demo_uid);
  select cnt into v_pb from pg_temp.rls_count('public', 'permission_sets', v_svm_uid);
  select cnt into v_pc from pg_temp.rls_count('public', 'permission_sets', v_third_uid);
  insert into pg_temp.results (section, check_name, status, detail)
  values ('excluded-table', 'public.permission_sets (global catalog)',
    case when v_pa = v_gt_total and v_pb = v_gt_total and v_pc = v_gt_total then 'PASS' else 'FAIL' end,
    format('total=%s demo_sees=%s svm_sees=%s thirdco_sees=%s', v_gt_total, v_pa, v_pb, v_pc));

  -- user_active_company: own-row selector, keyed on auth_user_id, not
  -- company-owned. At this point in the run exactly one row exists
  -- (the dual-membership tester's). Demo/SVM/ThirdCo personas must see
  -- ZERO rows (none of them is that auth_user_id); the dual persona
  -- must see exactly its own one row.
  select count(*) into v_gt_total from public.user_active_company;
  select cnt into v_pa from pg_temp.rls_count('public', 'user_active_company', v_demo_uid);
  select cnt into v_pb from pg_temp.rls_count('public', 'user_active_company', v_svm_uid);
  select cnt into v_pc from pg_temp.rls_count('public', 'user_active_company', v_third_uid);
  select cnt into v_gt_a from pg_temp.rls_count('public', 'user_active_company', v_dual_uid);
  insert into pg_temp.results (section, check_name, status, detail)
  values ('excluded-table', 'public.user_active_company (own-row selector)',
    case when v_pa = 0 and v_pb = 0 and v_pc = 0 and v_gt_a = 1 and v_gt_total = 1 then 'PASS' else 'FAIL' end,
    format('total=%s demo_sees=%s svm_sees=%s thirdco_sees=%s dual_sees_own=%s', v_gt_total, v_pa, v_pb, v_pc, v_gt_a));

  -- ===================================================================
  -- ADDITIONAL ASSERTIONS
  -- ===================================================================

  select id into v_demo_client_id from public.clients where company_id = v_demo_id limit 1;

  -- 1. Cross-tenant UPDATE affects zero rows (RLS `using`, not an
  --    error -- the row is simply invisible to a foreign persona).
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_third_uid, 'role','authenticated')::text, true);
  update public.clients set name = name where id = v_demo_client_id;
  get diagnostics v_rowcount = row_count;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  insert into pg_temp.results (section, check_name, status, detail)
  values ('assertion', '1. cross-tenant UPDATE affects zero rows',
    case when v_rowcount = 0 then 'PASS' else 'FAIL' end,
    format('Third Co persona updated a Demo client (id=%s): %s row(s) affected', v_demo_client_id, v_rowcount));

  -- 2. Setting company_id to another tenant raises 23514 (the
  --    immutability trigger), as postgres/service_role -- proving the
  --    trigger, not RLS, is what stops this.
  v_sqlstate_seen := null; v_sqlerrm_seen := null;
  begin
    update public.clients set company_id = v_svm_id where id = v_demo_client_id;
  exception when others then
    v_sqlstate_seen := sqlstate;
    v_sqlerrm_seen := sqlerrm;
  end;
  insert into pg_temp.results (section, check_name, status, detail)
  values ('assertion', '2. re-parenting company_id raises 23514',
    case when v_sqlstate_seen = '23514' then 'PASS' else 'FAIL' end,
    format('sqlstate=%s message=%s', coalesce(v_sqlstate_seen,'(none raised)'), coalesce(v_sqlerrm_seen,'')));

  -- 3. Creating an SVM deal pointing at a Demo client raises 23503
  --    (the composite FK deals_client_id_fkey (company_id, client_id)
  --    -> clients(company_id, id)), not the RLS policy.
  v_sqlstate_seen := null; v_sqlerrm_seen := null;
  begin
    insert into public.deals (company_id, code, client_name, client_id)
    values (v_svm_id, 'DEAL-9999999', 'Isolation Test Cross FK', v_demo_client_id);
  exception when others then
    v_sqlstate_seen := sqlstate;
    v_sqlerrm_seen := sqlerrm;
  end;
  insert into pg_temp.results (section, check_name, status, detail)
  values ('assertion', '3. SVM deal referencing a Demo client raises 23503',
    case when v_sqlstate_seen = '23503' then 'PASS' else 'FAIL' end,
    format('sqlstate=%s message=%s', coalesce(v_sqlstate_seen,'(none raised)'), coalesce(v_sqlerrm_seen,'')));

  -- 4. Write permission in Demo + read-only in SVM cannot write in
  --    SVM. current_company_id() is pinned to SVM via the
  --    user_active_company row inserted above.
  v_sqlstate_seen := null; v_sqlerrm_seen := null;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_dual_uid, 'role','authenticated')::text, true);
  begin
    insert into public.clients (
      company_id, code, name, type, status, primary_contact_name, email, phone,
      billing_street, billing_city, billing_state, billing_zip,
      created_date, last_activity_date)
    values (
      v_svm_id, 'CLT-9999999', 'Isolation Test Client', 'Commercial', 'Lead', 'Test Contact',
      'isolationtest@example.invalid', '555-0100',
      '1 Test St', 'Testville', 'CA', '00000',
      current_date, current_date);
  exception when others then
    v_sqlstate_seen := sqlstate;
    v_sqlerrm_seen := sqlerrm;
  end;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  insert into pg_temp.results (section, check_name, status, detail)
  values ('assertion', '4. Demo-write/SVM-read-only cannot write in SVM',
    case when v_sqlstate_seen = '42501' then 'PASS' else 'FAIL' end,
    format('sqlstate=%s message=%s', coalesce(v_sqlstate_seen,'(none raised -- INSERT SUCCEEDED, this is the failure)'), coalesce(v_sqlerrm_seen,'')));

  -- 5. current_company_state() returns 'no-membership' for a
  --    zero-membership user.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_zero_uid, 'role','authenticated')::text, true);
  select state into v_state from public.current_company_state();
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  insert into pg_temp.results (section, check_name, status, detail)
  values ('assertion', '5. current_company_state() = no-membership for zero-membership user',
    case when v_state = 'no-membership' then 'PASS' else 'FAIL' end,
    format('state=%s', coalesce(v_state, '(null)')));

end;
$test$;

-- ===================================================================
-- FINAL REPORT. This is the last statement before ROLLBACK, so it is
-- what the MCP tool / psql actually returns.
-- ===================================================================
select
  seq, section, check_name, status, detail
from pg_temp.results
order by
  case section when 'harness' then 0 when 'partition' then 1 when 'excluded-table' then 2
                when 'assertion' then 3 else 9 end,
  seq;

rollback;
