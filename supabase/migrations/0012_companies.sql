set check_function_bodies = off;

create table public.companies (
  id          uuid not null default gen_random_uuid(),
  slug        text not null,
  name        text not null,
  status      text not null default 'Active',
  timezone    text not null default 'America/Los_Angeles',
  code_prefix text not null default '',
  is_seed     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint companies_pkey primary key (id),
  -- Globally unique on purpose: the slug IS the tenant key. Named in the
  -- 0020 guard as a permanent exemption from the company_id rule.
  constraint companies_slug_key unique (slug),
  constraint companies_status_check check (status in ('Active','Suspended','Closed'))
);
alter table public.companies enable row level security;

create table public.user_active_company (
  auth_user_id uuid not null,
  company_id   uuid not null,
  updated_at   timestamptz not null default now(),
  constraint user_active_company_pkey primary key (auth_user_id),
  constraint user_active_company_user_fkey
    foreign key (auth_user_id) references auth.users(id) on delete cascade,
  constraint user_active_company_company_fkey
    foreign key (company_id) references public.companies(id) on delete cascade
);
alter table public.user_active_company enable row level security;

create trigger trg_companies_touch before update on public.companies
  for each row execute function app.tg_set_updated_at();

-- The resolver. Membership is re-validated on every call, so revoking
-- someone takes effect immediately rather than at JWT expiry. That is the
-- reason this is a table lookup and not a JWT claim.
--
-- The two NULL cases are deliberately different:
--   * a selection row that no longer matches an Active membership -> NULL.
--     A revocation must read as a denial, never as a silent tenant switch.
--   * no selection row at all -> oldest Active membership. Every candidate
--     is already authorized, so choosing among them is not an escalation,
--     and this phase ships no switcher to recover from a NULL.
create or replace function app.current_company_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    ( select uac.company_id
        from public.user_active_company uac
        join public.staff s on s.company_id = uac.company_id
                           and s.auth_user_id = uac.auth_user_id
                           and s.status = 'Active'
       where uac.auth_user_id = (select auth.uid()) ),
    ( select s.company_id
        from public.staff s
       where s.auth_user_id = (select auth.uid())
         and s.status = 'Active'
         and not exists ( select 1 from public.user_active_company u
                           where u.auth_user_id = (select auth.uid()) )
       order by s.created_at, s.id
       limit 1 )
  )
$$;

comment on function app.current_company_id() is
  'The caller''s active company, revalidated against Active membership on every call. NULL means deny.';

-- NULL must be legible. is_active_staff() going false renders the whole app
-- blank with no error, which 9999_security_guard.sql names as this system''s
-- hardest symptom. The layout calls this to tell the states apart.
create or replace function public.current_company_state()
returns table (state text, company_id uuid, company_name text)
language sql stable security definer set search_path = '' as $$
  with memberships as (
    select s.company_id from public.staff s
     where s.auth_user_id = (select auth.uid()) and s.status = 'Active'
  )
  select case
           when (select count(*) from memberships) = 0 then 'no-membership'
           when app.current_company_id() is null       then 'revoked-selection'
           else 'ok'
         end,
         app.current_company_id(),
         (select c.name from public.companies c where c.id = app.current_company_id())
$$;

-- service_role has BYPASSRLS, so `with check` does not constrain it.
-- Triggers do. This is the only thing between a service-role script bug and
-- a silently re-tenanted row.
create or replace function app.tg_company_id_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'company_id is immutable on %.% (% -> %)',
      tg_table_schema, tg_table_name, old.company_id, new.company_id
      using errcode = '23514';
  end if;
  return new;
end $$;

create policy companies_select on public.companies
  for select to authenticated
  using ( id = (select app.current_company_id()) );

create policy user_active_company_select on public.user_active_company
  for select to authenticated
  using ( auth_user_id = (select auth.uid()) );

-- No switcher ships this phase, so this table has no legitimate writer.
-- When it does, the predicate is already written:
--   create policy user_active_company_write on public.user_active_company
--     for all to authenticated
--     using      ( auth_user_id = (select auth.uid()) )
--     with check ( exists (select 1 from public.staff s
--                           where s.auth_user_id = (select auth.uid())
--                             and s.company_id = user_active_company.company_id
--                             and s.status = 'Active') );

revoke all on public.companies, public.user_active_company from public, anon, authenticated;
grant select on public.companies            to authenticated;
grant select on public.user_active_company  to authenticated;

revoke all on function app.current_company_id(), app.tg_company_id_immutable()
  from public, anon, authenticated;
grant execute on function app.current_company_id() to authenticated;
revoke all on function public.current_company_state() from public, anon, authenticated;
grant execute on function public.current_company_state() to authenticated;

reset check_function_bodies;
