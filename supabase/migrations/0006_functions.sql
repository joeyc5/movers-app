-- =====================================================================
-- 0006_functions.sql
-- Code minting, the quote/invoice money machinery, the caller-facing
-- RPCs, and the calendar reseed helper.
--
-- WHY THE TRIGGERS ARE SHAPED THE WAY THEY ARE
--
-- The header aggregates (subtotal, discount_amount, tax_amount,
-- total_amount, deposit_amount, accessorials_total) are recomputed in a
-- BEFORE INSERT OR UPDATE trigger that writes into NEW, not in an AFTER
-- trigger that issues a second UPDATE. Three things fall out of that:
--
--   * D7 is satisfied structurally. A plain `insert into quotes` runs
--     the same code path as an update, so a seeded labor-only quote with
--     zero line items lands with its real total instead of 0. An
--     AFTER UPDATE-only rollup is what makes booked revenue read $16,900
--     where the dashboard hardcodes $21,100.
--   * There is no header-write cascade to guard against, because the
--     trigger never issues an UPDATE of its own.
--   * labor_total cannot be read. A STORED generated column is evaluated
--     AFTER before-triggers, so NEW.labor_total is not populated there.
--     The trigger calls app.calc_labor_total directly -- the same
--     immutable function the generated column uses, which is exactly why
--     that expression lives in a function.
--
-- The only cross-table cascade is: quotes labor inputs change ->
-- percent_of_labor line amounts are rewritten -> the line rollup touches
-- the quote -> the header BEFORE trigger recomputes. It terminates
-- because the rollup's UPDATE mentions only updated_at, and the reprice
-- trigger is `AFTER UPDATE OF <labor columns>`, which fires on column
-- MENTION. A pg_trigger_depth() bound is attached to both AFTER triggers
-- anyway, so a future Server Action that names a labor column and a
-- derived column in one SET list gets a bounded chain rather than an
-- infinite one.
--
-- D8 SEED ORDERING IS LOAD-BEARING. quote_line_items_freeze rejects line
-- writes once the parent quote has left Draft, so the two Won deals MUST
-- be seeded in this order and nobody may "simplify" it:
--     1. insert the quote with status 'Draft'
--     2. insert its line items
--     3. UPDATE the quote to 'Accepted', stamping sent_at and decided_at
-- Inserting the quote at 'Accepted' first is legal (the header freeze is
-- BEFORE UPDATE only) and then every line insert raises.
-- =====================================================================

-- =====================================================================
-- D9. Human codes come from SECURITY DEFINER minting functions.
--
-- Sequence privileges are revoked from anon and authenticated at
-- baseline and are never granted back. Minting inside a SECURITY DEFINER
-- function means no sequence grant is ever needed.
--
-- A counter table rather than a sequence, deliberately: a sequence does
-- not roll back, so an aborted insert leaves a hole in the invoice
-- numbering. `Void rather than delete` only keeps the numbering intact
-- if the minting is transactional too. The trade, stated rather than
-- hidden: this row-locks per (scope, year) and serializes concurrent
-- minters until commit. That is the correct price for gapless invoice
-- numbers at this scale.
-- =====================================================================
create table app.code_counters (
  scope      text   not null,
  period     text   not null,
  last_value bigint not null default 0,

  constraint code_counters_pkey primary key (scope, period),
  constraint code_counters_last_value_check check (last_value >= 0)
);

-- Belt and braces: `authenticated` holds no grant on this table and no
-- ALTER DEFAULT PRIVILEGES entry can give it one, but RLS makes the
-- deny explicit.
alter table app.code_counters enable row level security;

comment on table app.code_counters is
  'Gapless per-year counters for quote and invoice codes. Written only by the SECURITY DEFINER minting functions in public.';

create or replace function public.next_quote_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period text;
  v_value  bigint;
begin
  if not app.has_any_perm(array['proposals','pipeline'], true) then
    raise exception 'insufficient privilege to mint a quote number'
      using errcode = '42501';
  end if;

  v_period := to_char(now() at time zone 'America/Los_Angeles', 'YYYY');

  insert into app.code_counters (scope, period, last_value)
  values ('quote', v_period, 1)
  on conflict (scope, period)
    do update set last_value = app.code_counters.last_value + 1
  returning last_value into v_value;

  return 'QTE-' || v_period || '-' || lpad(v_value::text, 4, '0');
end
$$;

comment on function public.next_quote_code() is
  'Mints QTE-YYYY-NNNN. Call it inside the same transaction as the quote insert: an abandoned transaction releases the number, which is what keeps the series gapless.';

create or replace function public.next_invoice_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period text;
  v_value  bigint;
begin
  if not app.has_any_perm(array['invoices','billing'], true) then
    raise exception 'insufficient privilege to mint an invoice number'
      using errcode = '42501';
  end if;

  v_period := to_char(now() at time zone 'America/Los_Angeles', 'YYYY');

  insert into app.code_counters (scope, period, last_value)
  values ('invoice', v_period, 1)
  on conflict (scope, period)
    do update set last_value = app.code_counters.last_value + 1
  returning last_value into v_value;

  return 'INV-' || v_period || '-' || lpad(v_value::text, 4, '0');
end
$$;

comment on function public.next_invoice_code() is
  'Mints INV-YYYY-NNNN. Replaces INV-${format(today, ''yyyyMMdd'')}, which produces the identical string for every invoice cut on the same day.';

revoke all on function public.next_quote_code(), public.next_invoice_code()
  from public, anon, authenticated;
grant execute on function public.next_quote_code(), public.next_invoice_code()
  to authenticated;

-- =====================================================================
-- QUOTES: freeze, then recompute.
--
-- Trigger names carry a numeric prefix because Postgres fires triggers
-- of the same timing in NAME order: 10_freeze runs before 20_recompute,
-- and both run before trg_quotes_touch.
-- =====================================================================

-- ---------------------------------------------------------------------
-- The freeze needs to exist at BOTH levels, not one.
--
-- Rejecting quote_line_items writes after Draft is insufficient on its
-- own, because labor_total is generated over columns that live on
-- `quotes`: `update quotes set hourly_rate_per_mover = 80` would
-- silently re-price an accepted quote with the line-item guard looking
-- the other way.
--
-- status, viewed_at, decided_at, sent_at and the derived aggregates stay
-- writable. So do rate_card_id and tax_rate_id, which are provenance.
-- ---------------------------------------------------------------------
create or replace function app.tg_quotes_freeze()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'Draft' then
    return new;
  end if;

  if new.crew_size             is distinct from old.crew_size
  or new.estimated_hours       is distinct from old.estimated_hours
  or new.hourly_rate_per_mover is distinct from old.hourly_rate_per_mover
  or new.min_hours             is distinct from old.min_hours
  or new.ot_threshold_hours    is distinct from old.ot_threshold_hours
  or new.ot_multiplier         is distinct from old.ot_multiplier
  or new.valuation_type        is distinct from old.valuation_type
  or new.valuation_fee         is distinct from old.valuation_fee
  or new.labor_taxable         is distinct from old.labor_taxable
  or new.valuation_taxable     is distinct from old.valuation_taxable
  or new.discount_type         is distinct from old.discount_type
  or new.discount_value        is distinct from old.discount_value
  or new.tax_rate_percent      is distinct from old.tax_rate_percent
  or new.deposit_type          is distinct from old.deposit_type
  or new.deposit_value         is distinct from old.deposit_value
  then
    raise exception
      'quote % has left Draft (status: %); its pricing is frozen. Issue a revision instead of editing it.',
      old.code, old.status
      using errcode = '23514';
  end if;

  return new;
end
$$;

comment on function app.tg_quotes_freeze() is
  'Rejects any change to the quote''s pricing surface once status has left Draft. Without it, updating a header rate re-prices an accepted quote straight through the generated labor_total.';

create trigger trg_quotes_10_freeze
  before update on public.quotes
  for each row execute function app.tg_quotes_freeze();

-- ---------------------------------------------------------------------
-- The header recompute. Runs on INSERT as well as UPDATE (D7).
--
-- D10 TAX BASE. The base sums only the components flagged taxable:
-- labor if labor_taxable, valuation_fee if valuation_taxable, and each
-- line's amount where that line is taxable. The discount is then
-- apportioned across the base in the same proportion it bears to the
-- subtotal, which preserves the discount-then-tax ORDER the invoice
-- getters use. When everything is taxable this reduces EXACTLY to
-- (subtotal - discount_amount) * rate / 100, so the change is backward
-- compatible with getInvoiceTax; when labor is not taxable -- the normal
-- California case -- it stops an 8.75% rate from taxing the whole labor
-- bill.
-- ---------------------------------------------------------------------
create or replace function app.tg_quotes_recompute()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_labor         numeric(12,2);
  v_accessorials  numeric(12,2);
  v_taxable_lines numeric(12,2);
  v_subtotal      numeric(12,2);
  v_discount      numeric(12,2);
  v_taxable_base  numeric(12,2);
  v_taxable_net   numeric(12,2);
  v_tax           numeric(12,2);
  v_total         numeric(12,2);
  v_deposit       numeric(12,2);
begin
  -- NEW.labor_total is NOT available here: a STORED generated column is
  -- evaluated after before-triggers. Same function, same answer.
  v_labor := app.calc_labor_total(
               new.estimated_hours, new.crew_size, new.hourly_rate_per_mover,
               new.min_hours, new.ot_threshold_hours, new.ot_multiplier);

  -- percent_of_labor lines are valued against the labor figure this
  -- statement is producing, not the one stored a moment ago, so an
  -- hours edit and its fuel surcharge settle in a single pass.
  select
    coalesce(sum(
      case when li.pricing_mode = 'percent_of_labor'
           then round(li.quantity * v_labor * li.unit_price / 100, 2)
           else li.amount end), 0),
    coalesce(sum(
      case when li.taxable then
        case when li.pricing_mode = 'percent_of_labor'
             then round(li.quantity * v_labor * li.unit_price / 100, 2)
             else li.amount end
      else 0 end), 0)
    into v_accessorials, v_taxable_lines
  from public.quote_line_items li
  where li.quote_id = new.id;

  v_subtotal := v_labor + v_accessorials + new.valuation_fee;

  v_discount := case when new.discount_type = 'percent'
                     then round(v_subtotal * new.discount_value / 100, 2)
                     else new.discount_value end;
  v_discount := least(greatest(v_discount, 0), v_subtotal);

  v_taxable_base := (case when new.labor_taxable     then v_labor            else 0 end)
                  + (case when new.valuation_taxable then new.valuation_fee  else 0 end)
                  + v_taxable_lines;

  v_taxable_net := case
                     when v_subtotal > 0
                       then greatest(v_taxable_base
                                     - round(v_discount * v_taxable_base / v_subtotal, 2), 0)
                     else 0
                   end;

  v_tax   := round(v_taxable_net * new.tax_rate_percent / 100, 2);
  v_total := v_subtotal - v_discount + v_tax;

  v_deposit := case when new.deposit_type = 'percent'
                    then round(v_total * new.deposit_value / 100, 2)
                    else new.deposit_value end;
  v_deposit := least(greatest(v_deposit, 0), v_total);

  new.accessorials_total := v_accessorials;
  new.subtotal           := v_subtotal;
  new.discount_amount    := v_discount;
  new.tax_amount         := v_tax;
  new.total_amount       := v_total;
  new.deposit_amount     := v_deposit;

  return new;
end
$$;

comment on function app.tg_quotes_recompute() is
  'BEFORE INSERT OR UPDATE: recomputes every header aggregate into NEW. Firing on INSERT is D7 -- an UPDATE-only rollup lands a labor-only quote at subtotal 0.';

create trigger trg_quotes_20_recompute
  before insert or update on public.quotes
  for each row execute function app.tg_quotes_recompute();

-- ---------------------------------------------------------------------
-- Reprice percent_of_labor lines when the labor surface moves.
--
-- `AFTER UPDATE OF <labor columns>` fires on column MENTION, so the
-- header rollup's `set updated_at = now()` cannot re-trigger this and
-- the chain terminates. The depth bound is belt: it turns a future
-- SET list that names a labor column alongside a derived one into a
-- bounded chain instead of an unbounded one.
-- ---------------------------------------------------------------------
create or replace function app.tg_quotes_reprice_percent_lines()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.quote_line_items li
     set amount = round(li.quantity * new.labor_total * li.unit_price / 100, 2)
   where li.quote_id = new.id
     and li.pricing_mode = 'percent_of_labor';
  return null;
end
$$;

comment on function app.tg_quotes_reprice_percent_lines() is
  'Keeps stored percent_of_labor line amounts consistent after an hours or rate edit. The header aggregates are already correct without this -- app.tg_quotes_recompute values percent lines itself -- so this exists so the LINE rows agree with the header when they are read directly.';

create trigger trg_quotes_30_reprice_percent_lines
  after update of estimated_hours, crew_size, hourly_rate_per_mover,
                  min_hours, ot_threshold_hours, ot_multiplier
  on public.quotes
  for each row
  when (pg_trigger_depth() < 5)
  execute function app.tg_quotes_reprice_percent_lines();

-- ---------------------------------------------------------------------
-- Quote acceptance writes back to the pipeline.
--
-- A generated column cannot read across tables, so a trigger is the only
-- mechanism. Setting estimated_value_source and accepted_quote_id in the
-- SAME statement is required: deals_quote_sourced_needs_quote rejects
-- source = 'quote' with a null accepted_quote_id.
--
-- Deliberately does NOT advance deals.stage to 'Won'. That would move
-- cards on the board without a human touching them, and the
-- Won-requires-client CHECK would then reject acceptance for a quote
-- whose deal has no client, surfacing as an opaque error at accept time.
-- ---------------------------------------------------------------------
create or replace function app.tg_quotes_writeback_to_deal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'Accepted' or new.deal_id is null then
    return null;
  end if;

  update public.deals d
     set estimated_value        = new.total_amount,
         estimated_value_source = 'quote',
         accepted_quote_id      = new.id
   where d.id = new.deal_id
     and ( d.accepted_quote_id      is distinct from new.id
        or d.estimated_value        is distinct from new.total_amount
        or d.estimated_value_source is distinct from 'quote' );

  return null;
end
$$;

comment on function app.tg_quotes_writeback_to_deal() is
  'Syncs deals.estimated_value from the accepted quote''s total and points accepted_quote_id at it, which is what keeps the pipeline figure openable instead of a dead end.';

create trigger trg_quotes_40_writeback
  after insert or update on public.quotes
  for each row
  when (pg_trigger_depth() < 5)
  execute function app.tg_quotes_writeback_to_deal();

-- =====================================================================
-- QUOTE LINE ITEMS: freeze, then amount, then rollup.
-- =====================================================================

create or replace function app.tg_quote_line_items_freeze()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_status   text;
  v_code     text;
begin
  v_quote_id := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;

  select q.status, q.code into v_status, v_code
  from public.quotes q where q.id = v_quote_id;

  -- v_status is NULL when the parent quote has already been deleted in
  -- this transaction, i.e. this is the ON DELETE CASCADE. Deleting a
  -- whole quote is a different operation from stripping a line off a
  -- sent one, and must not be blocked here.
  if v_status is null or v_status = 'Draft' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Past Draft, only the SYSTEM-maintained columns may move: `amount` is
  -- rewritten by the reprice trigger, and source provenance on the
  -- invoice side is nulled by ON DELETE SET NULL. Freezing those too
  -- would make an ordinary cascade fail with a confusing error.
  if tg_op = 'UPDATE'
     and new.kind         is not distinct from old.kind
     and new.description  is not distinct from old.description
     and new.pricing_mode is not distinct from old.pricing_mode
     and new.quantity     is not distinct from old.quantity
     and new.unit_price   is not distinct from old.unit_price
     and new.taxable      is not distinct from old.taxable
  then
    return new;
  end if;

  raise exception
    'quote % has left Draft (status: %); its line items are frozen.', v_code, v_status
    using errcode = '23514';
end
$$;

comment on function app.tg_quote_line_items_freeze() is
  'Rejects line inserts, priced-column updates and deletes once the parent quote has left Draft. This is the trigger that forces the D8 seed order: Draft -> lines -> UPDATE to Accepted.';

create trigger trg_quote_line_items_10_freeze
  before insert or update or delete on public.quote_line_items
  for each row execute function app.tg_quote_line_items_freeze();

create or replace function app.tg_quote_line_items_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_labor numeric(12,2);
begin
  if new.pricing_mode = 'percent_of_labor' then
    -- unit_price is a PERCENT here (7.50 meaning 7.5%), bounded to 100
    -- by quote_line_items_percent_bound_check.
    select q.labor_total into v_labor from public.quotes q where q.id = new.quote_id;
    new.amount := round(new.quantity * coalesce(v_labor, 0) * new.unit_price / 100, 2);
  else
    new.amount := round(new.quantity * new.unit_price, 2);
  end if;
  return new;
end
$$;

comment on function app.tg_quote_line_items_amount() is
  'amount is trigger-maintained rather than generated because percent_of_labor has to read quotes.labor_total, which is a different row, and a generated column cannot cross rows.';

create trigger trg_quote_line_items_20_amount
  before insert or update on public.quote_line_items
  for each row execute function app.tg_quote_line_items_amount();

create or replace function app.tg_quote_line_items_rollup()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_quote_id uuid;
begin
  v_quote_id := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;

  -- The UPDATE is the vehicle, not the payload: it fires the header's
  -- BEFORE trigger, which recomputes every aggregate from the line items
  -- as they now stand. The SET list deliberately mentions no pricing
  -- column, which is what stops trg_quotes_30_reprice_percent_lines from
  -- re-firing and closes the cascade.
  update public.quotes set updated_at = now() where id = v_quote_id;

  return null;
end
$$;

create trigger trg_quote_line_items_30_rollup
  after insert or update or delete on public.quote_line_items
  for each row
  when (pg_trigger_depth() < 5)
  execute function app.tg_quote_line_items_rollup();

-- =====================================================================
-- INVOICES
--
-- Same shape, minus labor and valuation. The invoice tax base is
-- sum(amount) where taxable, with the discount apportioned the same way
-- as on the quote, so a quote and the invoice cut from it cannot
-- disagree about the same job.
-- =====================================================================

create or replace function app.tg_invoices_freeze()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'Draft' then
    return new;
  end if;

  if new.discount_type         is distinct from old.discount_type
  or new.discount_value        is distinct from old.discount_value
  or new.tax_rate_percent      is distinct from old.tax_rate_percent
  or new.bill_to_name          is distinct from old.bill_to_name
  or new.bill_to_email         is distinct from old.bill_to_email
  or new.bill_to_address_line1 is distinct from old.bill_to_address_line1
  or new.bill_to_address_line2 is distinct from old.bill_to_address_line2
  or new.customer_tax_id       is distinct from old.customer_tax_id
  then
    raise exception
      'invoice % has been issued (status: %); its bill-to block and pricing are frozen.',
      old.code, old.status
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger trg_invoices_10_freeze
  before update on public.invoices
  for each row execute function app.tg_invoices_freeze();

create or replace function app.tg_invoices_recompute()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_subtotal     numeric(12,2);
  v_taxable_base numeric(12,2);
  v_discount     numeric(12,2);
  v_taxable_net  numeric(12,2);
  v_tax          numeric(12,2);
begin
  select coalesce(sum(li.amount), 0),
         coalesce(sum(li.amount) filter (where li.taxable), 0)
    into v_subtotal, v_taxable_base
  from public.invoice_line_items li
  where li.invoice_id = new.id;

  v_discount := case when new.discount_type = 'percent'
                     then round(v_subtotal * new.discount_value / 100, 2)
                     else new.discount_value end;
  v_discount := least(greatest(v_discount, 0), v_subtotal);

  v_taxable_net := case
                     when v_subtotal > 0
                       then greatest(v_taxable_base
                                     - round(v_discount * v_taxable_base / v_subtotal, 2), 0)
                     else 0
                   end;

  v_tax := round(v_taxable_net * new.tax_rate_percent / 100, 2);

  new.subtotal        := v_subtotal;
  new.discount_amount := v_discount;
  new.tax_amount      := v_tax;
  new.total_amount    := v_subtotal - v_discount + v_tax;

  return new;
end
$$;

comment on function app.tg_invoices_recompute() is
  'BEFORE INSERT OR UPDATE (D7). balance_due is a generated column over total_amount and amount_paid, and generated columns are evaluated after this trigger, so it picks up the new total automatically.';

create trigger trg_invoices_20_recompute
  before insert or update on public.invoices
  for each row execute function app.tg_invoices_recompute();

create or replace function app.tg_invoice_line_items_freeze()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_invoice_id uuid;
  v_status     text;
  v_code       text;
begin
  v_invoice_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;

  select i.status, i.code into v_status, v_code
  from public.invoices i where i.id = v_invoice_id;

  if v_status is null or v_status = 'Draft' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- source_quote_line_item_id is EXCLUDED from the frozen set on
  -- purpose. Its FK is ON DELETE SET NULL, so deleting a draft quote
  -- fires an UPDATE on this row; freezing it would make that delete fail
  -- with a check_violation on a table nobody was touching.
  if tg_op = 'UPDATE'
     and new.description is not distinct from old.description
     and new.quantity    is not distinct from old.quantity
     and new.unit_price  is not distinct from old.unit_price
     and new.taxable     is not distinct from old.taxable
  then
    return new;
  end if;

  raise exception
    'invoice % has been issued (status: %); its line items are frozen.', v_code, v_status
    using errcode = '23514';
end
$$;

create trigger trg_invoice_line_items_10_freeze
  before insert or update or delete on public.invoice_line_items
  for each row execute function app.tg_invoice_line_items_freeze();

create or replace function app.tg_invoice_line_items_rollup()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_invoice_id uuid;
begin
  v_invoice_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  update public.invoices set updated_at = now() where id = v_invoice_id;
  return null;
end
$$;

create trigger trg_invoice_line_items_20_rollup
  after insert or update or delete on public.invoice_line_items
  for each row
  when (pg_trigger_depth() < 5)
  execute function app.tg_invoice_line_items_rollup();

-- =====================================================================
-- D2. CALLER-FACING RPCs, in `public`.
--
-- PostgREST only exposes functions in its configured schemas, which is
-- `public`. An RPC in `app` cannot be reached by supabase.rpc() at all,
-- and the claim function is the one call that must work before the
-- caller has any staff row -- so putting it in `app` means no one can
-- ever claim a row and every query returns zero rows, permanently.
--
-- All of these are SECURITY DEFINER with `set search_path = ''` and gate
-- themselves internally. That is what lets staff.role_id, staff.status,
-- staff.auth_user_id and staff.work_email stay NON-writable at the grant
-- level: policies cannot express column granularity and grants can, and
-- a plain "staff may edit their own row" policy plus a table-wide GRANT
-- UPDATE lets a Scoped user promote themselves to Full.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Claim-on-first-login.
--
-- SECURITY DEFINER so it works for a caller who has no staff row yet.
-- The app calls it once immediately after sign-in, before rendering the
-- dashboard. A NULL return means "no staff row": route to /unauthorized,
-- which exists in the repo today with nothing routing to it.
--
-- PREREQUISITE (D15): every seeded work email is @example.com, which
-- RFC 2606 reserves and which cannot receive mail, so inviteUserByEmail
-- can never deliver. Seed the auth users from a Node script with
-- auth.admin.createUser({ email_confirm: true }) -- the
-- email_confirmed_at check below is not optional and will otherwise
-- reject every claim.
-- ---------------------------------------------------------------------
create or replace function public.claim_staff_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid;
  v_email    text;
  v_staff_id uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;

  if v_email is null then
    raise exception 'email not verified' using errcode = '28000';
  end if;

  -- work_email is citext, whose operators live in `extensions` and do
  -- NOT resolve under search_path = ''. Compare via lower(...::text).
  update public.staff s
     set auth_user_id = v_uid,
         status = case when s.status = 'Pending invite' then 'Active' else s.status end
   where lower(s.work_email::text) = v_email
     and s.auth_user_id is null
     and s.status in ('Active','Pending invite')   -- never Deactivated/Locked/Suspended
  returning s.id into v_staff_id;

  return v_staff_id;
end
$$;

comment on function public.claim_staff_for_current_user() is
  'Binds the signed-in auth user to their pre-existing staff row by verified email. Returns NULL when there is no matching row, which is the signal to route to /unauthorized.';

-- ---------------------------------------------------------------------
-- Shared guards for the admin RPCs.
-- ---------------------------------------------------------------------
create or replace function app.assert_can_manage_users()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := app.current_staff_id();
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not app.has_perm('users', true) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;
  return v_actor;
end
$$;

create or replace function app.assert_owner_remains()
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.staff s
    join public.roles r on r.id = s.role_id
    where r.slug = 'owner' and s.status = 'Active'
  ) then
    raise exception 'refusing to leave the company with no active Owner'
      using errcode = '23514';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- D15: the write path that does not exist today.
--
-- There is currently NO way to create a 28th employee: `authenticated`
-- holds no INSERT on staff, staff.team is NOT NULL with no default so an
-- admin cannot even correct a team, and work_email is non-writable with
-- no counterpart RPC. These three functions close that.
-- ---------------------------------------------------------------------
create or replace function public.admin_create_staff(
  p_full_name  text,
  p_work_email text,
  p_role_slug  text,
  p_team       text,
  p_status     text        default 'Pending invite',
  p_avatar_url text        default null,
  p_joined_at  timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_id  uuid;
  v_staff_id uuid;
begin
  perform app.assert_can_manage_users();

  if coalesce(btrim(p_full_name), '') = '' then
    raise exception 'full_name is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_work_email), '') = '' then
    raise exception 'work_email is required' using errcode = '22023';
  end if;

  select r.id into v_role_id from public.roles r where r.slug = p_role_slug;
  if v_role_id is null then
    raise exception 'unknown role: %', p_role_slug using errcode = '22023';
  end if;

  insert into public.staff (
    full_name, work_email, role_id, team, status, avatar_url, joined_at)
  values (
    btrim(p_full_name), btrim(p_work_email)::extensions.citext, v_role_id,
    p_team, p_status, p_avatar_url, p_joined_at)
  returning id into v_staff_id;

  return v_staff_id;
end
$$;

comment on function public.admin_create_staff(text, text, text, text, text, text, timestamptz) is
  'Creates a staff row, including team and work_email. The staff_team_check and staff_status_check constraints validate those two arguments, so an unknown label surfaces as a check violation naming the constraint rather than being silently accepted.';

create or replace function public.admin_update_staff(
  p_staff_id   uuid,
  p_full_name  text default null,
  p_work_email text default null,
  p_team       text default null,
  p_avatar_url text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.assert_can_manage_users();

  -- NULL means "leave unchanged". avatar_url therefore cannot be cleared
  -- through this function; clearing it is the self-service path, which
  -- is a column grant on staff(full_name, avatar_url).
  update public.staff s
     set full_name  = coalesce(btrim(p_full_name), s.full_name),
         work_email = coalesce(btrim(p_work_email)::extensions.citext, s.work_email),
         team       = coalesce(p_team, s.team),
         avatar_url = coalesce(p_avatar_url, s.avatar_url)
   where s.id = p_staff_id;

  if not found then
    raise exception 'no such staff member: %', p_staff_id using errcode = '22023';
  end if;
end
$$;

create or replace function public.admin_invite_staff(
  p_full_name  text,
  p_work_email text,
  p_role_slug  text,
  p_team       text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Deliberately thin. SQL cannot create an auth.users row, so the
  -- caller follows this with auth.admin.createUser({ email_confirm:
  -- true }) using the secret key server-side; the person then signs in
  -- and claim_staff_for_current_user() binds the two together and flips
  -- 'Pending invite' to 'Active'.
  return public.admin_create_staff(
    p_full_name, p_work_email, p_role_slug, p_team, 'Pending invite');
end
$$;

comment on function public.admin_invite_staff(text, text, text, text) is
  'Creates the staff row half of an invite. The auth user must be created out of band with the secret key: SQL cannot write auth.users, and every seeded address is @example.com, which cannot receive an invite mail.';

-- ---------------------------------------------------------------------
-- role and status: the two columns that are never directly writable.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_staff_role(p_staff_id uuid, p_role_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor   uuid;
  v_role_id uuid;
begin
  v_actor := app.assert_can_manage_users();

  if p_staff_id = v_actor then
    raise exception 'you cannot change your own role' using errcode = '42501';
  end if;

  select r.id into v_role_id from public.roles r where r.slug = p_role_slug;
  if v_role_id is null then
    raise exception 'unknown role: %', p_role_slug using errcode = '22023';
  end if;

  update public.staff set role_id = v_role_id where id = p_staff_id;
  if not found then
    raise exception 'no such staff member: %', p_staff_id using errcode = '22023';
  end if;

  perform app.assert_owner_remains();
end
$$;

create or replace function public.admin_set_staff_status(p_staff_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := app.assert_can_manage_users();

  if p_staff_id = v_actor then
    raise exception 'you cannot change your own status' using errcode = '42501';
  end if;

  update public.staff set status = p_status where id = p_staff_id;
  if not found then
    raise exception 'no such staff member: %', p_staff_id using errcode = '22023';
  end if;

  perform app.assert_owner_remains();
end
$$;

-- ---------------------------------------------------------------------
-- Grants. The ALTER DEFAULT PRIVILEGES in 0001 does not strip EXECUTE
-- from the PUBLIC pseudo-role, and PUBLIC EXECUTE on a SECURITY DEFINER
-- function is the escalation vector these are all built to avoid.
-- ---------------------------------------------------------------------
revoke all on function
    app.assert_can_manage_users(),
    app.assert_owner_remains()
  from public, anon, authenticated;

revoke all on function
    public.claim_staff_for_current_user(),
    public.admin_create_staff(text, text, text, text, text, text, timestamptz),
    public.admin_update_staff(uuid, text, text, text, text),
    public.admin_invite_staff(text, text, text, text),
    public.admin_set_staff_role(uuid, text),
    public.admin_set_staff_status(uuid, text)
  from public, anon, authenticated;

grant execute on function
    public.claim_staff_for_current_user(),
    public.admin_create_staff(text, text, text, text, text, text, timestamptz),
    public.admin_update_staff(uuid, text, text, text, text),
    public.admin_invite_staff(text, text, text, text),
    public.admin_set_staff_role(uuid, text),
    public.admin_set_staff_status(uuid, text)
  to authenticated;

-- =====================================================================
-- D19. The calendar reseed, and the policy it implements.
--
-- Every one of the 21 seeded event times is computed at module-eval from
-- startOfMonth(new Date()) today, so a literal INSERT freezes them to
-- migration day and the Calendar -- a headline screen -- renders empty
-- next month. This function moves the seeded rows forward while keeping
-- starts_at an honest instant: a demo row is indistinguishable in SHAPE
-- from a production row, which is the whole point of not storing day
-- offsets.
--
-- SCOPE (D11): every predicate is `where is_seed`, never
-- `code LIKE 'JOB-4%'`. Real app-created events mint codes in the same
-- namespace, so a real JOB-4007 sits squarely inside that prefix.
--
-- RE-ANCHORING POLICY, chosen explicitly rather than left open: shift
-- every seeded row by whole calendar months, preserving day-of-month and
-- local wall-clock time. Postgres `+ interval 'N months'` CLAMPS at the
-- end of a short month, so a row on the 30th lands on Feb 28 rather than
-- rolling into March 2 the way the JS setDate() it replaces would. That
-- is a deliberate behaviour change: a stand-up should not jump into the
-- next month.
--
-- CALLER: run it from `npm run seed:dev` with the secret key, before a
-- demo. pg_cron is available on this project but NOT installed, so
-- nothing is designed around it. A function with no caller is a
-- hand-wave; the npm script must land in the same change as the seed.
-- =====================================================================
create or replace function dev_seed.reseed_calendar(
  p_anchor date default null,
  p_tz     text default 'America/Los_Angeles'
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target  date;
  v_current date;
  v_months  integer;
  v_moved   integer := 0;
begin
  v_target := date_trunc('month', coalesce(p_anchor, (now() at time zone p_tz)::date))::date;

  select date_trunc('month', min(e.starts_at at time zone p_tz))::date
    into v_current
  from public.calendar_events e
  where e.is_seed;

  if v_current is null then
    -- Nothing seeded yet. The rows themselves come from the seed
    -- migration; this function only moves them.
    return 0;
  end if;

  v_months := (extract(year  from v_target)::integer - extract(year  from v_current)::integer) * 12
            + (extract(month from v_target)::integer - extract(month from v_current)::integer);

  if v_months = 0 then
    return 0;
  end if;

  -- Convert to local wall-clock, add whole months, convert back. Doing
  -- the arithmetic in UTC would land the 7:30 AM stand-up at 12:30 AM
  -- Pacific across a DST boundary.
  update public.calendar_events e
     set starts_at = ((e.starts_at at time zone p_tz) + make_interval(months => v_months)) at time zone p_tz,
         ends_at   = case
                       when e.ends_at is null then null
                       else ((e.ends_at at time zone p_tz) + make_interval(months => v_months)) at time zone p_tz
                     end
   where e.is_seed;

  get diagnostics v_moved = row_count;
  return v_moved;
end
$$;

comment on function dev_seed.reseed_calendar(date, text) is
  'Re-anchors the seeded calendar rows to the given month (default: the current Pacific month). Scoped on is_seed, never on a code prefix. No grants: reachable only with the secret key or as postgres.';

-- No grants, deliberately. `authenticated` has no USAGE on dev_seed, so
-- absent grants make this unreachable from the API -- the "a policy is
-- not a grant" rule working in our favour.
revoke all on function dev_seed.reseed_calendar(date, text)
  from public, anon, authenticated;


-- =====================================================================
-- CLOSE PUBLIC EXECUTE ACROSS SCHEMA app, THEN GRANT BACK THE FIVE
-- FUNCTIONS THAT ARE ACTUALLY CALLED BY A CALLER.
--
-- This runs at the foot of 0006 because by this line every function in
-- `app` exists: the four predicate helpers and tg_set_updated_at from
-- 0001, calc_labor_total from 0003, the two D5 assertion triggers from
-- 0005, and the eleven money triggers plus two assert_* helpers here.
--
-- THE HOLE IT CLOSES. 0001 revokes PUBLIC EXECUTE from the four
-- predicate helpers by name and 0006 does the same for its two assert_*
-- functions, and both files state there is "no grant to authenticated"
-- for the rest. That is not what the catalog said: proacl was NULL on
-- app.calc_labor_total and on every tg_* function, and a NULL proacl
-- means the built-in default -- EXECUTE to PUBLIC. ALTER DEFAULT
-- PRIVILEGES does not remove EXECUTE from the PUBLIC pseudo-role, so
-- nothing had ever taken it away.
--
-- Not an escalation vector as it stands: none of those functions is
-- SECURITY DEFINER, and a trigger function called directly raises
-- 0A000. But D13 requires the guard to assert an exact expected set,
-- "not currently exploitable" is not a security posture, and the
-- contradiction between the comments and the catalog is exactly the kind
-- of drift that gets read as intent later.
--
-- ORDER IS LOAD-BEARING. The blanket revoke names `authenticated`, so it
-- also strips the grant 0001 made on the four helpers. They have to be
-- re-granted below, after it, or every policy in 0008 fails with
-- `42501 permission denied for function is_active_staff` and the entire
-- app returns permission errors rather than rows.
-- =====================================================================
revoke all on all functions in schema app from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- The four predicate helpers. Called from policy predicates, which are
-- evaluated as the caller, so the caller needs EXECUTE.
-- ---------------------------------------------------------------------
grant execute on function
    app.current_staff_id(),
    app.is_active_staff(),
    app.has_any_perm(text[], boolean),
    app.has_perm(text, boolean)
  to authenticated;

-- ---------------------------------------------------------------------
-- app.calc_labor_total. THIS ONE IS NOT OPTIONAL, and the comment in
-- 0003 that says "No grant to authenticated" is superseded here.
--
-- MEASURED on this project, with a fixture of the same shape (a stored
-- generated column calling a schema-qualified function, plus a
-- non-SECURITY-DEFINER plpgsql BEFORE trigger whose body calls the same
-- function):
--
--   EXECUTE revoked  -> insert as `authenticated` fails with
--                       42501 : permission denied for function calc
--   EXECUTE granted  -> insert succeeds, both the trigger-written column
--                       and the generated column carry the right value
--
-- Two invoker-rights paths reach it and neither runs as postgres:
--   1. the STORED generated column quotes.labor_total, and
--   2. the body of app.tg_quotes_recompute(), which is a plain plpgsql
--      trigger function and NOT security definer.
-- Without this grant, every authenticated INSERT or UPDATE on
-- public.quotes dies at 42501 -- and it would look like a grant problem
-- on the quotes TABLE, which is the wrong place to go looking.
--
-- Safe to grant: it is IMMUTABLE, PARALLEL SAFE, pure arithmetic over
-- six numerics with no table access and no side effects.
--
-- The same measurement showed the other side, which is why the fourteen
-- tg_* functions stay revoked: TRIGGER FIRING DOES NOT CHECK EXECUTE.
-- With EXECUTE revoked from `authenticated`, the trigger still fired
-- normally; only a direct `perform app.tg_recompute()` raised 42501.
-- ---------------------------------------------------------------------
grant execute on function
    app.calc_labor_total(numeric, integer, numeric, numeric, numeric, numeric)
  to authenticated;
