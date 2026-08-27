-- =====================================================================
-- 0003_crm.sql
-- clients, the pricing reference tables, deals, quotes, invoices.
--
-- D3 CYCLE: deals.accepted_quote_id -> quotes(id) and quotes.deal_id ->
-- deals(id) are a DDL cycle. `deals` is created with the COLUMN but no
-- FK; the constraint is added by ALTER TABLE in THIS SAME FILE once
-- quotes exists. Creation order in this file is authoritative.
--
-- D4: ON DELETE RESTRICT on deals.client_id, deals.accepted_quote_id and
-- quotes.deal_id. SET NULL on any of those three fires an UPDATE that
-- then violates a CHECK on the same row, surfacing as an opaque 23514
-- with the failing row printed and no mention of the delete that caused
-- it. RESTRICT is also the honest answer for a Won deal and an accepted
-- quote.
--
-- D12: RLS is enabled immediately after each create table.
--
-- Rollup, freeze and write-back TRIGGERS live in 0006. This file is DDL
-- and the one immutable pricing function the generated column needs.
-- =====================================================================

-- =====================================================================
-- clients
-- =====================================================================
create table public.clients (
  id                     uuid        not null default gen_random_uuid(),
  code                   text        not null,
  name                   text        not null,
  type                   text        not null,
  status                 text        not null,
  primary_contact_name   text        not null,

  -- Deliberately NOT unique: a client contact name/email can legitimately
  -- repeat, and one seeded contact collides with a staff member's name.
  email                  text        not null,
  phone                  text        not null,

  billing_street         text        not null,
  billing_city           text        not null,
  billing_state          text        not null,
  billing_zip            text        not null,

  origin_street          text,
  origin_city            text,
  origin_state           text,
  origin_zip             text,

  destination_street     text,
  destination_city       text,
  destination_state      text,
  destination_zip        text,

  -- Nullable, and the FK must NOT require active staff: one Deactivated
  -- rep owns five clients.
  account_owner_staff_id uuid,

  -- date, not timestamptz: the seed is 'yyyy-MM-dd' with no time, and a
  -- date column round-trips as the same string, so no render site
  -- changes shape.
  created_date           date        not null,
  last_activity_date     date        not null,

  notes                  text,
  is_seed                boolean     not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint clients_pkey primary key (id),
  constraint clients_code_key unique (code),
  constraint clients_code_format check (code ~ '^CLT-[0-9]+$'),
  constraint clients_account_owner_staff_id_fkey
    foreign key (account_owner_staff_id) references public.staff(id) on delete set null,
  constraint clients_type_check   check (type in ('Residential','Commercial')),
  constraint clients_status_check check (status in ('Lead','Active','In Storage','Past','Inactive')),

  -- All-or-nothing address groups, so formatAddress never renders
  -- 'undefined' against a half-populated block.
  constraint clients_origin_group_check check (
    (origin_street is null) = (origin_city is null)
    and (origin_city is null) = (origin_state is null)
    and (origin_state is null) = (origin_zip is null)),
  constraint clients_destination_group_check check (
    (destination_street is null) = (destination_city is null)
    and (destination_city is null) = (destination_state is null)
    and (destination_state is null) = (destination_zip is null)),

  constraint clients_activity_after_creation_check check (last_activity_date >= created_date)
);

alter table public.clients enable row level security;

comment on table public.clients is
  'The 25 client accounts. Broad read (any active staff member) per D1: a Driver opening a job must see the client name and address, and a permission-gated read would blank it silently through a LEFT JOIN rather than raise.';
comment on column public.clients.code is
  'The CLT-1001 identifier. Real UNIQUE constraint so /dashboard/clients/CLT-1001 resolves via .eq(''code'', id) and seeds can on_conflict (code) upsert.';
comment on column public.clients.billing_zip is
  'text, never integer, so leading zeros survive outside California.';
comment on column public.clients.origin_street is
  'Present on 17 of 25. The three origin-only rows encode "goods came from here and sit in a vault", which is real data, not a gap.';

create index clients_status_idx                 on public.clients (status);
create index clients_type_idx                   on public.clients (type);
create index clients_account_owner_staff_id_idx on public.clients (account_owner_staff_id);
create index clients_last_activity_date_idx     on public.clients (last_activity_date desc);

-- D14: schema-qualified opclass. pg_trgm installs WITH SCHEMA extensions
-- and the search_path in effect during apply is not pinned.
create index clients_name_trgm_idx
  on public.clients using gin (name extensions.gin_trgm_ops);

create trigger trg_clients_touch
  before update on public.clients
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- rate_cards
--
-- Effective-dated named cards. Effective dating is what makes "the rate
-- card changed later" a real scenario, and therefore what justifies
-- snapshotting rates onto the quote at all.
-- =====================================================================
create table public.rate_cards (
  id             uuid        not null default gen_random_uuid(),
  code           text        not null,
  name           text        not null,
  effective_from date        not null,
  effective_to   date,
  is_default     boolean     not null default false,
  is_seed        boolean     not null default false,
  created_at     timestamptz not null default now(),

  constraint rate_cards_pkey primary key (id),
  constraint rate_cards_code_key unique (code),
  constraint rate_cards_effective_range_check
    check (effective_to is null or effective_to >= effective_from)
);

alter table public.rate_cards enable row level security;

comment on column public.rate_cards.is_default is
  'Picks the card a new quote starts from without relying on array index order, which is exactly how the invoice tax default silently breaks today.';

create index rate_cards_effective_idx on public.rate_cards (effective_from, effective_to);

-- Partial by necessity, and NEVER an on_conflict target: `code` is.
create unique index rate_cards_single_default_idx
  on public.rate_cards (is_default) where is_default;

-- =====================================================================
-- crew_rates
--
-- Per-crew-size hourly rate, hour minimum and overtime rule for one card.
-- =====================================================================
create table public.crew_rates (
  id                    uuid          not null default gen_random_uuid(),
  rate_card_id          uuid          not null,
  crew_size             integer       not null,
  hourly_rate_per_mover numeric(12,2) not null,
  min_hours             numeric(12,2) not null default 3,
  ot_threshold_hours    numeric(12,2) not null default 8,
  ot_multiplier         numeric(12,2) not null default 1.5,
  is_seed               boolean       not null default false,
  created_at            timestamptz   not null default now(),

  constraint crew_rates_pkey primary key (id),
  constraint crew_rates_rate_card_id_fkey
    foreign key (rate_card_id) references public.rate_cards(id) on delete cascade,
  -- Real UNIQUE constraint: the on_conflict target for seeding.
  constraint crew_rates_card_crew_key unique (rate_card_id, crew_size),
  constraint crew_rates_crew_size_check     check (crew_size between 1 and 12),
  constraint crew_rates_hourly_rate_check   check (hourly_rate_per_mover >= 0),
  constraint crew_rates_min_hours_check     check (min_hours >= 0),
  constraint crew_rates_ot_threshold_check  check (ot_threshold_hours > 0),
  -- Overtime can never cost less than straight time.
  constraint crew_rates_ot_multiplier_check check (ot_multiplier >= 1)
);

alter table public.crew_rates enable row level security;

comment on column public.crew_rates.hourly_rate_per_mover is
  'Per-mover rather than per-crew so one card scales without a row per combination; the quote multiplies by crew_size.';
comment on column public.crew_rates.min_hours is
  'The hour minimum. Below it you still bill the minimum -- implemented as the greatest() branch of app.calc_labor_total.';

create index crew_rates_rate_card_id_idx on public.crew_rates (rate_card_id);

-- =====================================================================
-- fee_catalog
--
-- Presets for accessorials: stairs, long carry, shuttle, packing
-- materials, specialty items, fuel surcharge.
-- =====================================================================
create table public.fee_catalog (
  id           uuid          not null default gen_random_uuid(),
  code         text          not null,
  name         text          not null,
  category     text          not null,
  pricing_mode text          not null,
  default_rate numeric(12,2) not null default 0,
  unit_label   text,
  taxable      boolean       not null default true,
  is_active    boolean       not null default true,
  sort_order   integer       not null default 0,
  is_seed      boolean       not null default false,
  created_at   timestamptz   not null default now(),

  constraint fee_catalog_pkey primary key (id),
  constraint fee_catalog_code_key unique (code),
  -- Deliberately excludes valuation: that is one exclusive choice on the
  -- quote header, and a line-item kind for it would land in
  -- accessorials_total and be counted twice.
  constraint fee_catalog_category_check
    check (category in ('accessorial','materials','specialty','surcharge')),
  -- One unit_price column cannot express all four shapes: stairs is
  -- flat, packing materials per unit, shuttle per hour, fuel surcharge a
  -- percentage of labor.
  constraint fee_catalog_pricing_mode_check
    check (pricing_mode in ('flat','per_unit','per_hour','percent_of_labor')),
  constraint fee_catalog_default_rate_check check (default_rate >= 0),
  -- D10: bound percent pricing at the catalog too, or a rep typing 750
  -- makes a 7.5x-labor fuel surcharge.
  constraint fee_catalog_percent_bound_check
    check (pricing_mode <> 'percent_of_labor' or default_rate <= 100)
);

alter table public.fee_catalog enable row level security;

comment on column public.fee_catalog.default_rate is
  'A dollar amount for flat/per_unit/per_hour and a PERCENT (7.50 meaning 7.5%) for percent_of_labor. numeric(12,2) app-wide rather than a wider scale, for consistency.';
comment on column public.fee_catalog.is_active is
  'Retires a preset from the picker without deleting it, keeping the FK on historical quote lines intact.';

create index fee_catalog_picker_idx on public.fee_catalog (is_active, category, sort_order);

-- =====================================================================
-- tax_rates
--
-- Replaces the hardcoded two-entry invoiceTaxOptions array.
-- =====================================================================
create table public.tax_rates (
  id           uuid          not null default gen_random_uuid(),
  code         text          not null,
  name         text          not null,
  rate_percent numeric(12,2) not null default 0,
  is_active    boolean       not null default true,
  is_default   boolean       not null default false,
  is_seed      boolean       not null default false,
  created_at   timestamptz   not null default now(),

  constraint tax_rates_pkey primary key (id),
  constraint tax_rates_code_key unique (code),
  constraint tax_rates_rate_percent_check check (rate_percent between 0 and 100)
);

alter table public.tax_rates enable row level security;

comment on column public.tax_rates.rate_percent is
  'A percent (8.75), not a fraction, matching the existing rate field and the /100 in getInvoiceTax.';
comment on column public.tax_rates.is_default is
  'Replaces the index-based invoiceTaxOptions[0].id default, where reordering the array silently changes which tax a new invoice gets.';

-- Partial; `code` is the upsert target.
create unique index tax_rates_single_default_idx
  on public.tax_rates (is_default) where is_default;

-- =====================================================================
-- app.calc_labor_total
--
-- The single most important piece of arithmetic in the schema. Used in
-- TWO places that must never disagree:
--   1. the STORED generated column quotes.labor_total, and
--   2. the header recompute trigger in 0006, which needs the labor
--      figure BEFORE the generated column has been evaluated (generated
--      columns are computed after BEFORE triggers, so NEW.labor_total is
--      not available there).
-- Putting the expression in one immutable function is what stops those
-- two from drifting. If you edit it, you are editing both.
--
-- Note that CREATE OR REPLACE does NOT rewrite already-stored
-- labor_total values -- that is the point of a snapshot, not a bug.
--
-- MEASURED on PG 17.6 against this exact expression, crew 4 at $75/mover,
-- min 3h, threshold 8h, multiplier 1.5:
--     2h  ->   900.00   (the 3-hour minimum applies)
--     5h  ->  1500.00   (straight time)
--    10h  ->  3300.00   (8h straight + 2h at 1.5x)
--    12h  ->  4200.00   (DEAL-3012, pure labor)
--   crew 6, 16h at $125 -> 15000.00 (DEAL-3013 labor; straight-line
--                          multiplication gives 12000 and is wrong)
-- 15000 + 1900 accessorials = 16900, + 4200 = 21100, which is the
-- booked-revenue figure the dashboard hardcodes today.
-- =====================================================================
create or replace function app.calc_labor_total(
  p_estimated_hours numeric,
  p_crew_size       integer,
  p_hourly_rate     numeric,
  p_min_hours       numeric,
  p_ot_threshold    numeric,
  p_ot_multiplier   numeric
) returns numeric
language sql
immutable
parallel safe
as $$
  select round(
    greatest(
      -- straight time up to the overtime threshold
      least(p_estimated_hours, p_ot_threshold) * p_hourly_rate * p_crew_size
      -- plus every hour past it, at the multiplier
      + greatest(p_estimated_hours - p_ot_threshold, 0) * p_hourly_rate * p_crew_size * p_ot_multiplier,
      -- but never less than the hour minimum
      p_min_hours * p_hourly_rate * p_crew_size
    ), 2)
$$;

comment on function app.calc_labor_total(numeric, integer, numeric, numeric, numeric, numeric) is
  'Crew-size hourly labor with an hour minimum and an overtime multiplier. IMMUTABLE, so it is legal inside the quotes.labor_total generated column; also called by the header recompute trigger, which cannot read the generated column from a BEFORE trigger.';

-- GRANTED to authenticated, at the foot of 0006. Not because the app
-- calls it directly -- it never does -- but because BOTH paths that
-- reach it are invoker-rights: the STORED generated column
-- quotes.labor_total, and the body of app.tg_quotes_recompute(), which
-- is a plain plpgsql trigger function and not SECURITY DEFINER.
-- Measured: with EXECUTE revoked, an authenticated INSERT into
-- public.quotes fails with `42501 permission denied for function
-- calc_labor_total`. Safe to grant: IMMUTABLE, PARALLEL SAFE, pure
-- arithmetic over six numerics with no table access.

-- =====================================================================
-- deals  (created WITHOUT the accepted_quote_id FK -- D3)
-- =====================================================================
create table public.deals (
  id                     uuid          not null default gen_random_uuid(),
  code                   text          not null,

  -- NULLABLE by necessity: 5 of 15 seeded deals have no Client row, and
  -- forcing NOT NULL would mean inventing five clients.
  client_id              uuid,
  -- Retained alongside the FK as the display fallback for an unconverted
  -- prospect AND the historical record of what the lead called itself.
  client_name            text          not null,

  stage                  text          not null default 'Discovery',
  priority               text          not null default 'Medium',

  -- STORED, not derived: a Discovery deal is a human guess with no quote
  -- behind it (all 15 seeded rows are exactly this), and a generated
  -- column cannot read another table.
  estimated_value        numeric(12,2) not null default 0,
  estimated_value_source text          not null default 'manual',
  accepted_quote_id      uuid,

  move_date              date,
  origin_city            text,
  destination_city       text,
  owner_staff_id         uuid,

  -- Card order within a stage is persisted nowhere today. Plain integer
  -- with no UNIQUE so a drag rewrites only the affected column; the board
  -- orders by (stage, board_position, created_at).
  board_position         integer       not null default 0,

  is_seed                boolean       not null default false,
  created_at             timestamptz   not null default now(),
  updated_at             timestamptz   not null default now(),

  constraint deals_pkey primary key (id),
  constraint deals_code_key unique (code),
  constraint deals_code_format check (code ~ '^DEAL-[0-9]+$'),

  -- D4: RESTRICT, not SET NULL. SET NULL fires an UPDATE that then
  -- violates deals_won_needs_client on the same row.
  constraint deals_client_id_fkey
    foreign key (client_id) references public.clients(id) on delete restrict,
  constraint deals_owner_staff_id_fkey
    foreign key (owner_staff_id) references public.staff(id) on delete set null,

  constraint deals_stage_check check (
    stage in ('Discovery','Qualified','Proposal Sent','Negotiation','Won','Lost')),
  constraint deals_priority_check check (priority in ('High','Medium','Low')),
  constraint deals_estimated_value_source_check
    check (estimated_value_source in ('manual','quote')),

  -- Must stay Won-only. Extending it to Negotiation would reject a
  -- seeded row. Verified satisfiable: both Won deals match a client.
  constraint deals_won_needs_client check (stage <> 'Won' or client_id is not null),
  constraint deals_quote_sourced_needs_quote
    check (estimated_value_source = 'manual' or accepted_quote_id is not null),
  constraint deals_estimated_value_check check (estimated_value >= 0)
);

alter table public.deals enable row level security;

comment on table public.deals is
  'The 15 pipeline deals: the board and the Leads table over one list.';
comment on column public.deals.estimated_value_source is
  'Discriminates a rep''s guess from a figure written back by quote acceptance, so the UI can label the number and the sync trigger knows what it may overwrite.';
comment on column public.deals.accepted_quote_id is
  'The quote whose total populated estimated_value, and the link target that keeps the pipeline figure openable rather than a dead end. FK added by ALTER at the foot of this file (D3 cycle).';
comment on column public.deals.owner_staff_id is
  'Must NOT require active staff: one Deactivated rep owns three deals.';

create index deals_stage_idx             on public.deals (stage);
create index deals_owner_staff_id_idx    on public.deals (owner_staff_id);
create index deals_client_id_idx         on public.deals (client_id);
create index deals_accepted_quote_id_idx on public.deals (accepted_quote_id);
create index deals_board_idx             on public.deals (stage, board_position, created_at);
create index deals_move_date_idx         on public.deals (move_date);

create trigger trg_deals_touch
  before update on public.deals
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- quotes
--
-- THE SNAPSHOT IS THE POINT. Every pricing input the labor figure is
-- computed from lives on THIS row, not on the rate card: crew_size,
-- estimated_hours, hourly_rate_per_mover, min_hours, ot_threshold_hours,
-- ot_multiplier, valuation_fee, tax_rate_percent, discount, deposit.
-- rate_card_id and tax_rate_id are PROVENANCE ONLY and are never read
-- for math. Raise the standard hourly rate next year and every accepted
-- quote keeps the number the customer agreed to.
--
-- The snapshot works at two levels and both are needed. Freezing only
-- the header would let a stairs-fee price change re-price an accepted
-- quote through the line join; freezing only lines would let a rate-card
-- change do the same through labor.
-- =====================================================================
create table public.quotes (
  id                    uuid          not null default gen_random_uuid(),

  -- Minted by public.next_quote_code() (0006), a SECURITY DEFINER
  -- function, so no sequence grant is ever needed (D9).
  code                  text          not null,

  deal_id               uuid,
  client_id             uuid,
  client_name           text          not null,

  status                text          not null default 'Draft',

  -- D6: a real date column, defaulted in Pacific. The obvious
  -- `CHECK (valid_until >= created_at::date)` rejects any quote raised
  -- after 5pm Pacific, because the database TimeZone is UTC. Never
  -- compare a date against a timestamptz cast in a CHECK.
  issued_on             date          not null default (now() at time zone 'America/Los_Angeles')::date,
  valid_until           date,

  move_date             date,

  -- Full addresses are snapshotted onto the quote because they are
  -- PRICED inputs (stairs, long carry and shuttle all derive from them),
  -- unlike the client's current default address.
  origin_street         text,
  origin_city           text,
  origin_state          text,
  origin_zip            text,
  destination_street    text,
  destination_city      text,
  destination_state     text,
  destination_zip       text,

  rate_card_id          uuid,

  -- ---- the frozen labor surface -------------------------------------
  crew_size             integer       not null,
  estimated_hours       numeric(12,2) not null default 0,
  hourly_rate_per_mover numeric(12,2) not null,
  min_hours             numeric(12,2) not null default 3,
  ot_threshold_hours    numeric(12,2) not null default 8,
  ot_multiplier         numeric(12,2) not null default 1.5,

  labor_total           numeric(12,2) not null generated always as (
                          app.calc_labor_total(
                            estimated_hours, crew_size, hourly_rate_per_mover,
                            min_hours, ot_threshold_hours, ot_multiplier)
                        ) stored,

  -- ---- valuation: one exclusive choice, on the header ---------------
  valuation_type        text          not null default 'Released Value',
  valuation_fee         numeric(12,2) not null default 0,

  -- ---- D10: taxability of the two header-level charges --------------
  -- In California moving labor is generally not taxable and materials
  -- are. Without these two flags an 8.75% rate taxes the full labor bill
  -- and the per-line `taxable` column is decorative.
  labor_taxable         boolean       not null default false,
  valuation_taxable     boolean       not null default false,

  -- ---- discount / tax / deposit -------------------------------------
  discount_type         text          not null default 'fixed',
  discount_value        numeric(12,2) not null default 0,
  tax_rate_id           uuid,
  tax_rate_percent      numeric(12,2) not null default 0,

  -- ---- trigger-maintained aggregates (0006) -------------------------
  -- None of these can be GENERATED: they aggregate across rows, and
  -- Postgres additionally forbids a generated column referencing another
  -- generated column (subtotal would have to read labor_total).
  accessorials_total    numeric(12,2) not null default 0,
  subtotal              numeric(12,2) not null default 0,
  discount_amount       numeric(12,2) not null default 0,
  tax_amount            numeric(12,2) not null default 0,
  total_amount          numeric(12,2) not null default 0,

  deposit_type          text          not null default 'percent',
  deposit_value         numeric(12,2) not null default 0,
  deposit_amount        numeric(12,2) not null default 0,

  owner_staff_id        uuid,
  prepared_by_staff_id  uuid,
  notes                 text,
  terms                 text,

  sent_at               timestamptz,
  viewed_at             timestamptz,
  decided_at            timestamptz,

  is_seed               boolean       not null default false,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now(),

  constraint quotes_pkey primary key (id),
  constraint quotes_code_key unique (code),

  -- D4: RESTRICT. SET NULL here fires an UPDATE that violates
  -- quotes_accepted_needs_deal on the same row.
  constraint quotes_deal_id_fkey
    foreign key (deal_id) references public.deals(id) on delete restrict,
  constraint quotes_client_id_fkey
    foreign key (client_id) references public.clients(id) on delete set null,
  constraint quotes_rate_card_id_fkey
    foreign key (rate_card_id) references public.rate_cards(id) on delete set null,
  constraint quotes_tax_rate_id_fkey
    foreign key (tax_rate_id) references public.tax_rates(id) on delete set null,
  constraint quotes_owner_staff_id_fkey
    foreign key (owner_staff_id) references public.staff(id) on delete set null,
  constraint quotes_prepared_by_staff_id_fkey
    foreign key (prepared_by_staff_id) references public.staff(id) on delete set null,

  constraint quotes_status_check check (
    status in ('Draft','Sent','Viewed','Accepted','Declined','Expired')),
  constraint quotes_crew_size_check     check (crew_size between 1 and 12),
  constraint quotes_estimated_hours_check check (estimated_hours >= 0),
  constraint quotes_ot_threshold_check  check (ot_threshold_hours > 0),
  constraint quotes_ot_multiplier_check check (ot_multiplier >= 1),

  constraint quotes_valuation_type_check
    check (valuation_type in ('Released Value','Full Value Protection')),
  constraint quotes_valuation_fee_check check (valuation_fee >= 0),
  -- Released Value coverage is included, so it cannot carry a fee.
  constraint quotes_released_value_is_free_check
    check (valuation_type <> 'Released Value' or valuation_fee = 0),

  constraint quotes_discount_type_check check (discount_type in ('fixed','percent')),
  constraint quotes_discount_value_check check (discount_value >= 0),
  constraint quotes_tax_rate_percent_check check (tax_rate_percent between 0 and 100),
  constraint quotes_deposit_type_check  check (deposit_type in ('fixed','percent')),
  constraint quotes_deposit_value_check check (deposit_value >= 0),

  constraint quotes_discount_within_subtotal_check
    check (discount_amount >= 0 and discount_amount <= subtotal),
  constraint quotes_deposit_within_total_check
    check (deposit_amount >= 0 and deposit_amount <= total_amount),

  constraint quotes_sent_at_required_check
    check (status = 'Draft' or sent_at is not null),
  constraint quotes_decided_at_required_check
    check (status not in ('Accepted','Declined') or decided_at is not null),
  -- An accepted quote with no deal is a total that can never reach the
  -- pipeline, which is exactly the disconnection this schema exists to
  -- prevent.
  constraint quotes_accepted_needs_deal
    check (status <> 'Accepted' or deal_id is not null),

  -- D6: date against date, never date against a timestamptz cast.
  constraint quotes_valid_until_check
    check (valid_until is null or valid_until >= issued_on)
);

alter table public.quotes enable row level security;

comment on table public.quotes is
  'A moving quote: crew-size hourly labor with an hour minimum and overtime, accessorial fees, valuation coverage, discount, tax, deposit, lifecycle and validity date. Every pricing input is snapshotted on this row so an accepted quote never re-prices.';
comment on column public.quotes.rate_card_id is
  'PROVENANCE ONLY, never read for math. The rates the total is computed from are the snapshot columns on this row.';
comment on column public.quotes.tax_rate_id is
  'PROVENANCE ONLY. tax_rate_percent is what the math reads, which also removes today''s silent fallback where an unknown tax id charges 8.75%.';
comment on column public.quotes.labor_total is
  'STORED generated column. Safe because every input is on this same row and app.calc_labor_total is immutable. See that function for the measured values.';
comment on column public.quotes.labor_taxable is
  'Defaults false: moving labor is generally not taxable in California. The tax base sums only the components flagged taxable (D10).';
comment on column public.quotes.subtotal is
  'labor_total + accessorials_total + valuation_fee, trigger-maintained. Cannot be generated: it aggregates across rows AND Postgres forbids a generated column referencing another generated column.';
comment on column public.quotes.viewed_at is
  'Writable after the freeze: it is lifecycle, not pricing.';

create index quotes_deal_id_idx        on public.quotes (deal_id);
create index quotes_client_id_idx      on public.quotes (client_id);
create index quotes_status_idx         on public.quotes (status);
create index quotes_owner_staff_id_idx on public.quotes (owner_staff_id);
create index quotes_created_at_idx     on public.quotes (created_at desc);
-- Serves the expiry sweep that flips Sent/Viewed to Expired.
create index quotes_valid_until_idx
  on public.quotes (valid_until) where status in ('Sent','Viewed');

create trigger trg_quotes_touch
  before update on public.quotes
  for each row execute function app.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- D3: close the deals/quotes cycle now that both tables exist.
-- D4: RESTRICT -- SET NULL would null accepted_quote_id while
-- estimated_value_source stays 'quote', violating
-- deals_quote_sourced_needs_quote on the same row.
-- ---------------------------------------------------------------------
alter table public.deals
  add constraint deals_accepted_quote_id_fkey
  foreign key (accepted_quote_id) references public.quotes(id) on delete restrict;

-- =====================================================================
-- quote_line_items
--
-- Accessorial, materials, specialty and surcharge lines. Labor and
-- valuation are NOT line items: subtotal is labor + accessorials +
-- valuation_fee, so a 'valuation' line would land in accessorials_total
-- and be counted twice.
-- =====================================================================
create table public.quote_line_items (
  id             uuid          not null default gen_random_uuid(),
  quote_id       uuid          not null,

  -- Stable seed key so line items can on_conflict upsert. Nullable
  -- because app-created lines have no natural key, and UNIQUE tolerates
  -- many NULLs.
  external_key   text,

  kind           text          not null,
  fee_catalog_id uuid,
  description    text          not null,

  -- SNAPSHOT of the catalog mode: changing a preset from flat to
  -- per_unit would otherwise silently re-price historical lines.
  pricing_mode   text          not null default 'flat',
  quantity       numeric(12,2) not null default 1,
  unit_price     numeric(12,2) not null default 0,
  taxable        boolean       not null default true,

  -- Trigger-maintained, NOT generated: percent_of_labor must read
  -- quotes.labor_total, which is a different row.
  amount         numeric(12,2) not null default 0,

  position       integer       not null default 0,
  is_seed        boolean       not null default false,
  created_at     timestamptz   not null default now(),

  constraint quote_line_items_pkey primary key (id),
  constraint quote_line_items_quote_id_fkey
    foreign key (quote_id) references public.quotes(id) on delete cascade,
  constraint quote_line_items_fee_catalog_id_fkey
    foreign key (fee_catalog_id) references public.fee_catalog(id) on delete set null,
  constraint quote_line_items_external_key_key unique (external_key),

  constraint quote_line_items_kind_check
    check (kind in ('labor','accessorial','materials','specialty','surcharge')),
  constraint quote_line_items_pricing_mode_check
    check (pricing_mode in ('flat','per_unit','per_hour','percent_of_labor')),
  constraint quote_line_items_quantity_check   check (quantity >= 0),
  constraint quote_line_items_unit_price_check check (unit_price >= 0),
  constraint quote_line_items_amount_check     check (amount >= 0),

  -- D10: without this a rep typing 750 into a fuel surcharge produces a
  -- charge of 7.5x labor and nothing catches it.
  constraint quote_line_items_percent_bound_check
    check (pricing_mode <> 'percent_of_labor' or unit_price <= 100)
);

alter table public.quote_line_items enable row level security;

comment on column public.quote_line_items.unit_price is
  'SNAPSHOT of the rate. Carries a PERCENT (7.50 meaning 7.5%) when pricing_mode = percent_of_labor, bounded to 100 by quote_line_items_percent_bound_check.';
comment on column public.quote_line_items.taxable is
  'SNAPSHOT of fee_catalog.taxable at the moment the line was added. The tax base sums only amount WHERE taxable (D10).';
comment on column public.quote_line_items.kind is
  'Mirrors fee_catalog.category plus ''labor'', so there is ONE vocabulary. ''valuation'' is deliberately absent: it lives on the header.';

create index quote_line_items_quote_id_idx
  on public.quote_line_items (quote_id, position, created_at);
create index quote_line_items_fee_catalog_id_idx
  on public.quote_line_items (fee_catalog_id);

-- =====================================================================
-- company_billing_profile
--
-- Single-row replacement for the hardcoded movingCompanyFromDetails
-- constant. Reference data, but it carries a routing number, so it is
-- NOT world-readable.
-- =====================================================================
create table public.company_billing_profile (
  id                   integer     not null default 1,
  name                 text        not null default '',
  email                text        not null default '',
  phone                text        not null default '',
  -- Empty string today and still rendered, so default '' preserves the
  -- exact current output rather than printing 'null'.
  website              text        not null default '',
  address_line1        text        not null default '',
  address_line2        text        not null default '',
  -- Named issuer-side to disambiguate it from the tax-option id and the
  -- customer tax id: three different meanings of 'taxId' in one object
  -- graph today.
  tax_id               text        not null default '',
  payment_account_name text        not null default '',
  routing_number       text        not null default '',
  is_seed              boolean     not null default false,
  updated_at           timestamptz not null default now(),

  constraint company_billing_profile_pkey primary key (id),
  -- Forces exactly one row without a separate singleton guard table.
  constraint company_billing_profile_singleton check (id = 1)
);

alter table public.company_billing_profile enable row level security;

comment on column public.company_billing_profile.routing_number is
  'text not integer so leading zeros survive. Sensitive: this table must never be readable by anon and its read is permission-gated, not broad.';

create trigger trg_company_billing_profile_touch
  before update on public.company_billing_profile
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- invoices
--
-- Makes the currently ephemeral invoice real.
--
-- NOTE ON D10: labor_taxable / valuation_taxable are deliberately NOT on
-- this table. An invoice carries no labor column and no valuation column
-- -- its totals are purely line-item derived, and every line carries its
-- own `taxable`. A flag over a concept the table does not have would be
-- a column nothing reads. The invoice tax base is
-- sum(amount) where taxable, and that is the complete story.
-- =====================================================================
create table public.invoices (
  id                    uuid          not null default gen_random_uuid(),

  -- Minted by public.next_invoice_code() (0006). The current
  -- INV-${yyyyMMdd} reference cannot be unique: every invoice cut on the
  -- same day produces the identical string.
  code                  text          not null,

  -- NOT NULL, unlike deals/quotes: the invoice UI is reached only from a
  -- client record. RESTRICT because an AR document must not vanish with
  -- the account.
  client_id             uuid          not null,
  deal_id               uuid,
  -- NULLABLE by necessity: Invoice({client}) is client-scoped with no
  -- quote in sight, so invoice-without-quote must stay legal.
  quote_id              uuid,

  -- Void rather than delete, so the numbering keeps no holes.
  status                text          not null default 'Draft',

  -- `date`, not timestamptz: invoice-paper.tsx prints these two raw with
  -- no format() call. They are the only two dates in the app rendered
  -- that way. D6 default, in Pacific.
  issued_date           date          not null default (now() at time zone 'America/Los_Angeles')::date,
  payment_due_date      date          not null,

  -- SNAPSHOT: an issued invoice keeps the name it was addressed to even
  -- if the client is later renamed.
  bill_to_name          text          not null,
  bill_to_email         text,
  bill_to_address_line1 text,
  bill_to_address_line2 text,
  customer_tax_id       text,

  tax_rate_id           uuid,
  tax_rate_percent      numeric(12,2) not null default 0,
  discount_type         text          not null default 'fixed',
  discount_value        numeric(12,2) not null default 0,

  -- Trigger-maintained (0006); cross-row, so not generatable.
  subtotal              numeric(12,2) not null default 0,
  discount_amount       numeric(12,2) not null default 0,
  tax_amount            numeric(12,2) not null default 0,
  total_amount          numeric(12,2) not null default 0,

  amount_paid           numeric(12,2) not null default 0,
  -- Safely GENERATED: both inputs are plain columns on this row.
  balance_due           numeric(12,2) not null generated always as (total_amount - amount_paid) stored,

  issued_by_staff_id    uuid,
  notes                 text,
  is_seed               boolean       not null default false,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now(),

  constraint invoices_pkey primary key (id),
  constraint invoices_code_key unique (code),
  constraint invoices_client_id_fkey
    foreign key (client_id) references public.clients(id) on delete restrict,
  constraint invoices_deal_id_fkey
    foreign key (deal_id) references public.deals(id) on delete set null,
  constraint invoices_quote_id_fkey
    foreign key (quote_id) references public.quotes(id) on delete set null,
  constraint invoices_tax_rate_id_fkey
    foreign key (tax_rate_id) references public.tax_rates(id) on delete set null,
  constraint invoices_issued_by_staff_id_fkey
    foreign key (issued_by_staff_id) references public.staff(id) on delete set null,

  constraint invoices_status_check check (status in ('Draft','Sent','Paid','Void')),
  constraint invoices_tax_rate_percent_check check (tax_rate_percent between 0 and 100),
  constraint invoices_discount_type_check    check (discount_type in ('fixed','percent')),
  constraint invoices_discount_value_check   check (discount_value >= 0),
  constraint invoices_amount_paid_check      check (amount_paid >= 0),
  constraint invoices_due_after_issued_check check (payment_due_date >= issued_date),
  constraint invoices_discount_within_subtotal_check
    check (discount_amount >= 0 and discount_amount <= subtotal),
  constraint invoices_paid_needs_payment_check
    check (status <> 'Paid' or amount_paid >= total_amount)
);

alter table public.invoices enable row level security;

comment on column public.invoices.issued_by_staff_id is
  'Replaces the hardcoded issuerName ''Morgan Ellis'', which matches rootUser by string coincidence only. Nullable: the person can leave.';
comment on column public.invoices.amount_paid is
  'A running total, not a payments table. Enough for the current UI, which has an inert Record payment menu item and no payment history view anywhere. Split into payments(invoice_id, amount, method, received_at) when an audit trail is actually wanted.';

create index invoices_client_id_idx   on public.invoices (client_id);
create index invoices_quote_id_idx    on public.invoices (quote_id);
create index invoices_deal_id_idx     on public.invoices (deal_id);
create index invoices_status_idx      on public.invoices (status);
create index invoices_issued_date_idx on public.invoices (issued_date desc);
-- Serves AR aging.
create index invoices_open_balance_idx
  on public.invoices (payment_due_date) where status = 'Sent';

create trigger trg_invoices_touch
  before update on public.invoices
  for each row execute function app.tg_set_updated_at();

-- =====================================================================
-- invoice_line_items
-- =====================================================================
create table public.invoice_line_items (
  id                        uuid          not null default gen_random_uuid(),
  invoice_id                uuid          not null,
  external_key              text,

  -- Provenance when the invoice was pre-filled from a quote. Null for a
  -- line typed directly, which is every line today.
  source_quote_line_item_id uuid,

  description               text          not null,
  quantity                  numeric(12,2) not null default 1,
  unit_price                numeric(12,2) not null default 0,
  taxable                   boolean       not null default true,

  -- Safely GENERATED: both inputs are on this row. Replaces getLineAmount
  -- and its NaN guards.
  amount                    numeric(12,2) not null generated always as (round(quantity * unit_price, 2)) stored,

  position                  integer       not null default 0,
  is_seed                   boolean       not null default false,
  created_at                timestamptz   not null default now(),

  constraint invoice_line_items_pkey primary key (id),
  constraint invoice_line_items_invoice_id_fkey
    foreign key (invoice_id) references public.invoices(id) on delete cascade,
  constraint invoice_line_items_source_fkey
    foreign key (source_quote_line_item_id) references public.quote_line_items(id) on delete set null,
  constraint invoice_line_items_external_key_key unique (external_key),
  constraint invoice_line_items_quantity_check   check (quantity >= 0),
  constraint invoice_line_items_unit_price_check check (unit_price >= 0)
);

alter table public.invoice_line_items enable row level security;

comment on column public.invoice_line_items.source_quote_line_item_id is
  'ON DELETE SET NULL fires an UPDATE on this row. The freeze trigger in 0006 therefore checks only the PRICED columns, so deleting a draft quote cannot fail against an already-Sent invoice that was pre-filled from it.';
comment on column public.invoice_line_items.taxable is
  'Carried from the quote line so labor and materials can be taxed differently. The invoice tax base sums only amount WHERE taxable.';

create index invoice_line_items_invoice_id_idx
  on public.invoice_line_items (invoice_id, position, created_at);
create index invoice_line_items_source_idx
  on public.invoice_line_items (source_quote_line_item_id);
