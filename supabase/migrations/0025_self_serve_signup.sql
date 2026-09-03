-- =====================================================================
-- 0025: self-serve company creation.
--
-- Evidence (2026-09-02, repo audit):
--   * public.create_company() (0019, redefined 0020) is the only path by
--     which a tenant exists, and it is granted to service_role only. No
--     signup, register, or invite route exists under src/app. A mover
--     other than the three seeded tenants cannot get into the app.
--   * claim_staff_for_current_user() (0022) already encodes the
--     one-person-one-company rule: a caller holding an Active membership
--     claims nothing further. This function keeps that rule.
--
-- Shape: a thin SECURITY DEFINER wrapper callable by `authenticated`.
-- It validates, provisions through create_company() (so every company
-- gets the same roles, rate card, tax rate, folder, billing profile,
-- and counters), then binds the freshly minted Owner row to the caller
-- and flips it Active in the same transaction. Nothing here touches
-- another tenant's rows: the only staff UPDATE is pinned to the company
-- this call just created.
--
-- Error codes are load-bearing for the UI (src/server/signup-actions.ts
-- maps them to copy):
--   28000  not signed in, or email not verified
--   42501  caller already belongs to a company
--   22023  bad name or slug
--   23505  slug taken
-- =====================================================================
set check_function_bodies = off;

create or replace function public.signup_create_company(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid;
  v_email   text;
  v_name    text;
  v_company uuid;
  v_staff   uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select lower(u.email),
         coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1))
    into v_email, v_name
    from auth.users u
   where u.id = v_uid and u.email_confirmed_at is not null;

  if v_email is null then
    raise exception 'email not verified' using errcode = '28000';
  end if;

  -- One person, one company. 'Pending invite' is deliberately NOT in
  -- this list: an admin elsewhere inviting this address must not block
  -- the address from starting its own business. Locked and Suspended
  -- are: a fresh company is not an exit from a suspension.
  if exists (
    select 1 from public.staff s
     where s.auth_user_id = v_uid
       and s.status in ('Active','Locked','Suspended')
  ) then
    raise exception 'this account already belongs to a company' using errcode = '42501';
  end if;

  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 80 then
    raise exception 'company name must be 2 to 80 characters' using errcode = '22023';
  end if;

  if p_slug is null
     or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or length(p_slug) < 3
     or length(p_slug) > 40 then
    raise exception 'slug must be 3 to 40 lowercase letters, digits, and single hyphens'
      using errcode = '22023';
  end if;

  if exists (select 1 from public.companies c where c.slug = p_slug) then
    raise exception 'that company URL is already taken' using errcode = '23505';
  end if;

  -- Runs as this function's owner (postgres), which holds execute on
  -- create_company(); `authenticated` still cannot call it directly.
  v_company := public.create_company(btrim(p_name), p_slug, v_email, v_name);

  -- Bind and activate the Owner row create_company() just wrote. Pinned
  -- to v_company so this UPDATE can never reach another tenant's row.
  update public.staff s
     set auth_user_id = v_uid,
         status = 'Active'
   where s.company_id = v_company
     and s.auth_user_id is null
     and lower(s.work_email::text) = v_email
  returning s.id into v_staff;

  if v_staff is null then
    raise exception 'provisioning did not produce an owner row to bind' using errcode = 'P0001';
  end if;

  return v_company;
end
$$;

comment on function public.signup_create_company(text, text) is
  'Self-serve tenant creation for a signed-in, email-verified caller who holds no Active/Locked/Suspended membership anywhere. Provisions through create_company() and binds the new Owner row to the caller as Active in the same transaction. Error codes 28000/42501/22023/23505 are mapped to copy by the signup Server Action.';

revoke all on function public.signup_create_company(text, text) from public, anon;
grant execute on function public.signup_create_company(text, text) to authenticated;
