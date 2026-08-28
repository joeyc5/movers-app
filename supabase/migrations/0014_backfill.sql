insert into public.companies (slug, name, code_prefix, is_seed)
values ('demo-movers', 'Demo Movers', 'QTE', true)
on conflict (slug) do nothing;

do $$
declare
  t text;
  v_demo uuid;
  v_tables text[] := array[
    'calendar_event_crew','calendar_events','clients','crew_rates','deals',
    'document_folders','document_stars','documents','fee_catalog',
    'invoice_line_items','invoices','quote_line_items','quotes','rate_cards',
    'role_permission_sets','roles','staff','staff_locations','staff_profiles',
    'staff_profiles_sensitive','storage_agreements','tax_rates','vaults',
    'warehouse_locations'
  ];
begin
  select id into strict v_demo from public.companies where slug = 'demo-movers';

  foreach t in array v_tables loop
    execute format('update public.%I set company_id = %L where company_id is null', t, v_demo);
    execute format('alter table public.%I alter column company_id set not null', t);
    execute format('alter table public.%I alter column company_id set default app.current_company_id()', t);
    execute format('alter table public.%I add constraint %I foreign key (company_id) '
                || 'references public.companies(id) on delete restrict', t, t || '_company_id_fkey');
    execute format('create index if not exists %I on public.%I (company_id)', t || '_company_id_idx', t);
    execute format('create trigger trg_%s_company_immutable before update on public.%I '
                || 'for each row execute function app.tg_company_id_immutable()', t, t);
  end loop;

  update app.code_counters set company_id = v_demo where company_id is null;
  alter table app.code_counters alter column company_id set not null;
end $$;
