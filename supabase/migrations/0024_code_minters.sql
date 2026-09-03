-- =====================================================================
-- 0024: code minters for clients, deals, and calendar events.
--
-- Evidence (2026-09-02, repo audit + 0010_seed.sql):
--   * The UI can create exactly one entity today: a quote. Client, deal,
--     and calendar-event creation have no write path because each table
--     has a NOT NULL `code` with a CHECK on its format (clients
--     '^CLT-[0-9]+$', deals '^DEAL-[0-9]+$', calendar_events
--     '^(JOB|SUR|OFF)-[0-9]+$') and no minter behind it.
--   * next_quote_code() / next_invoice_code() (0017, revised 0019) are
--     the established pattern: SECURITY DEFINER, permission check
--     byte-identical to the matching INSERT policy, one counter row per
--     (company_id, scope, period) in app.code_counters, minted inside
--     the caller's transaction so an abandoned insert releases the
--     number.
--   * These three code families are NOT year-scoped in the seed
--     (CLT-1001.., DEAL-3001.., JOB-4001.., SUR-5001.., OFF-6001..),
--     so their counter period is the literal 'all'.
--   * Seed high-water marks (Demo Movers only; SVM and Third Co hold
--     zero rows): CLT 1025, DEAL 3015, JOB 4006, SUR 5004, OFF 6011.
--     Section B seeds each company's counter from its own live max so
--     the next mint can never collide with an existing code.
--
-- Permission arrays below are copied by hand from 0008:
--   clients_insert          -> app.has_perm('clients', true)
--   deals_insert            -> app.has_any_perm(array['pipeline','leads'], true)
--   calendar_events_insert  -> app.has_any_perm(array['calendar','dispatch','jobs'], true)
-- If either side changes, change both.
-- =====================================================================
set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- A. The minters.
-- ---------------------------------------------------------------------
create or replace function public.next_client_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_value   bigint;
begin
  if not app.has_perm('clients', true) then
    raise exception 'insufficient privilege to mint a client code'
      using errcode = '42501';
  end if;

  v_company := app.current_company_id();
  if v_company is null then
    raise exception 'no active company for this session' using errcode = '42501';
  end if;

  insert into app.code_counters (company_id, scope, period, last_value)
  values (v_company, 'client', 'all', 1)
  on conflict (company_id, scope, period)
    do update set last_value = app.code_counters.last_value + 1
  returning last_value into v_value;

  return 'CLT-' || lpad(v_value::text, 4, '0');
end
$$;

comment on function public.next_client_code() is
  'Mints CLT-NNNN per company from app.code_counters (scope client, period all). Call inside the same transaction as the clients insert. The permission check must stay byte-identical to clients_insert in 0008.';

revoke all on function public.next_client_code() from public, anon;
grant execute on function public.next_client_code() to authenticated;


create or replace function public.next_deal_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_value   bigint;
begin
  if not app.has_any_perm(array['pipeline','leads'], true) then
    raise exception 'insufficient privilege to mint a deal code'
      using errcode = '42501';
  end if;

  v_company := app.current_company_id();
  if v_company is null then
    raise exception 'no active company for this session' using errcode = '42501';
  end if;

  insert into app.code_counters (company_id, scope, period, last_value)
  values (v_company, 'deal', 'all', 1)
  on conflict (company_id, scope, period)
    do update set last_value = app.code_counters.last_value + 1
  returning last_value into v_value;

  return 'DEAL-' || lpad(v_value::text, 4, '0');
end
$$;

comment on function public.next_deal_code() is
  'Mints DEAL-NNNN per company from app.code_counters (scope deal, period all). Call inside the same transaction as the deals insert. The permission array must stay byte-identical to deals_insert in 0008.';

revoke all on function public.next_deal_code() from public, anon;
grant execute on function public.next_deal_code() to authenticated;


create or replace function public.next_event_code(p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_value   bigint;
  v_prefix  text;
begin
  if not app.has_any_perm(array['calendar','dispatch','jobs'], true) then
    raise exception 'insufficient privilege to mint an event code'
      using errcode = '42501';
  end if;

  v_prefix := case p_kind
    when 'job'    then 'JOB'
    when 'survey' then 'SUR'
    when 'office' then 'OFF'
  end;
  if v_prefix is null then
    raise exception 'next_event_code: kind must be job, survey, or office (got %)', p_kind
      using errcode = '22023';
  end if;

  v_company := app.current_company_id();
  if v_company is null then
    raise exception 'no active company for this session' using errcode = '42501';
  end if;

  insert into app.code_counters (company_id, scope, period, last_value)
  values (v_company, 'event_' || p_kind, 'all', 1)
  on conflict (company_id, scope, period)
    do update set last_value = app.code_counters.last_value + 1
  returning last_value into v_value;

  return v_prefix || '-' || lpad(v_value::text, 4, '0');
end
$$;

comment on function public.next_event_code(text) is
  'Mints JOB-NNNN, SUR-NNNN, or OFF-NNNN per company from app.code_counters (scope event_<kind>, period all). Call inside the same transaction as the calendar_events insert. The permission array must stay byte-identical to calendar_events_insert in 0008.';

revoke all on function public.next_event_code(text) from public, anon;
grant execute on function public.next_event_code(text) to authenticated;


create or replace function public.next_storage_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_value   bigint;
begin
  if not app.has_any_perm(array['storage','vaults'], true) then
    raise exception 'insufficient privilege to mint a storage agreement code'
      using errcode = '42501';
  end if;

  v_company := app.current_company_id();
  if v_company is null then
    raise exception 'no active company for this session' using errcode = '42501';
  end if;

  insert into app.code_counters (company_id, scope, period, last_value)
  values (v_company, 'storage', 'all', 1)
  on conflict (company_id, scope, period)
    do update set last_value = app.code_counters.last_value + 1
  returning last_value into v_value;

  return 'STO-' || lpad(v_value::text, 4, '0');
end
$$;

comment on function public.next_storage_code() is
  'Mints STO-NNNN per company from app.code_counters (scope storage, period all). Call inside the same transaction as the storage_agreements insert. The permission array must stay byte-identical to storage_agreements_insert in 0008.';

revoke all on function public.next_storage_code() from public, anon;
grant execute on function public.next_storage_code() to authenticated;


create or replace function public.next_vault_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_value   bigint;
begin
  if not app.has_any_perm(array['storage','vaults'], true) then
    raise exception 'insufficient privilege to mint a vault code'
      using errcode = '42501';
  end if;

  v_company := app.current_company_id();
  if v_company is null then
    raise exception 'no active company for this session' using errcode = '42501';
  end if;

  insert into app.code_counters (company_id, scope, period, last_value)
  values (v_company, 'vault', 'all', 1)
  on conflict (company_id, scope, period)
    do update set last_value = app.code_counters.last_value + 1
  returning last_value into v_value;

  return 'V-' || lpad(v_value::text, 4, '0');
end
$$;

comment on function public.next_vault_code() is
  'Mints V-NNNN per company from app.code_counters (scope vault, period all). Call inside the same transaction as the vaults insert. The permission array must stay byte-identical to vaults_insert in 0008.';

revoke all on function public.next_vault_code() from public, anon;
grant execute on function public.next_vault_code() to authenticated;


-- ---------------------------------------------------------------------
-- B. Seed every company's counters from its own live high-water mark.
--    Idempotent: re-running can only raise a counter, never lower it.
-- ---------------------------------------------------------------------
insert into app.code_counters (company_id, scope, period, last_value)
select s.company_id, 'storage', 'all', max(substring(s.code from '[0-9]+$')::bigint)
  from public.storage_agreements s group by s.company_id
on conflict (company_id, scope, period)
  do update set last_value = greatest(app.code_counters.last_value, excluded.last_value);

insert into app.code_counters (company_id, scope, period, last_value)
select v.company_id, 'vault', 'all', max(substring(v.code from '[0-9]+$')::bigint)
  from public.vaults v group by v.company_id
on conflict (company_id, scope, period)
  do update set last_value = greatest(app.code_counters.last_value, excluded.last_value);

insert into app.code_counters (company_id, scope, period, last_value)
select c.company_id, 'client', 'all', max(substring(c.code from '[0-9]+$')::bigint)
  from public.clients c group by c.company_id
on conflict (company_id, scope, period)
  do update set last_value = greatest(app.code_counters.last_value, excluded.last_value);

insert into app.code_counters (company_id, scope, period, last_value)
select d.company_id, 'deal', 'all', max(substring(d.code from '[0-9]+$')::bigint)
  from public.deals d group by d.company_id
on conflict (company_id, scope, period)
  do update set last_value = greatest(app.code_counters.last_value, excluded.last_value);

insert into app.code_counters (company_id, scope, period, last_value)
select e.company_id, 'event_' || e.entity_type, 'all', max(substring(e.code from '[0-9]+$')::bigint)
  from public.calendar_events e group by e.company_id, e.entity_type
on conflict (company_id, scope, period)
  do update set last_value = greatest(app.code_counters.last_value, excluded.last_value);
