-- =====================================================================
-- verify-minters.sql: prove 0024 and 0025 behave, then roll back.
--
-- Run as ONE call (MCP execute_sql, or
--   supabase db query --linked --project-ref jannhzvqrsumtscidtkx -f supabase/tests/verify-minters.sql
-- ). It uses pg_temp and SET LOCAL ROLE, both session-scoped, and ends
-- with rollback, so nothing it mints persists and no counter advances.
--
-- Expected (Demo Movers, seeded high-water marks CLT 1025, DEAL 3015,
-- JOB 4006, SUR 5004, OFF 6011, STO/V per seed):
--   elena  next_client_code   -> CLT-1026
--   elena  next_deal_code     -> 42501 (Dispatcher holds neither pipeline nor leads)
--   elena  next_event_code    -> JOB-4007 (Dispatcher holds dispatch)
--   morgan next_deal_code     -> DEAL-3016 (Admin is Full)
--   morgan next_storage_code  -> STO-<max+1>
--   morgan next_vault_code    -> V-<max+1>
--   signup_create_company as elena -> 42501 (already an Active member)
-- =====================================================================
begin;

create or replace function pg_temp.mint_as(p_email text, p_fn text, p_arg text default null)
returns text language plpgsql as $$
declare v_uid uuid; v_out text;
begin
  select s.auth_user_id into v_uid from public.staff s
   where lower(s.work_email::text) = lower(p_email) and s.auth_user_id is not null
   order by s.created_at limit 1;
  if v_uid is null then return 'NO-AUTH-USER for ' || p_email; end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  begin
    if p_arg is null then
      execute format('select public.%I()', p_fn) into v_out;
    else
      execute format('select public.%I(%L)', p_fn, p_arg) into v_out;
    end if;
  exception when others then
    v_out := 'ERR ' || sqlstate || ': ' || sqlerrm;
  end;
  reset role;
  return v_out;
end $$;

create or replace function pg_temp.signup_as(p_email text)
returns text language plpgsql as $$
declare v_uid uuid; v_out text;
begin
  select s.auth_user_id into v_uid from public.staff s
   where lower(s.work_email::text) = lower(p_email) and s.auth_user_id is not null limit 1;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  begin
    v_out := public.signup_create_company('Probe Movers', 'probe-movers')::text;
  exception when others then
    v_out := 'ERR ' || sqlstate || ': ' || sqlerrm;
  end;
  reset role;
  return v_out;
end $$;

select 'elena next_client_code'   as probe, pg_temp.mint_as('elena.torres@example.com', 'next_client_code')  as result
union all select 'elena next_deal_code',     pg_temp.mint_as('elena.torres@example.com', 'next_deal_code')
union all select 'elena next_event_code job', pg_temp.mint_as('elena.torres@example.com', 'next_event_code', 'job')
union all select 'morgan next_deal_code',    pg_temp.mint_as('morgan.ellis@example.com', 'next_deal_code')
union all select 'morgan next_storage_code', pg_temp.mint_as('morgan.ellis@example.com', 'next_storage_code')
union all select 'morgan next_vault_code',   pg_temp.mint_as('morgan.ellis@example.com', 'next_vault_code')
union all select 'elena signup_create_company', pg_temp.signup_as('elena.torres@example.com');

rollback;
