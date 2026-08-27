-- =====================================================================
-- 0011_pin_calc_labor_total_search_path.sql
--
-- Supabase's security linter flagged app.calc_labor_total as having a
-- role-mutable search_path. Every other function in the app schema
-- already pins one; this is the single omission.
--
-- It is also the one function that could not simply follow the others,
-- because it is referenced by a STORED generated column
-- (quotes.labor_total) and therefore has to stay IMMUTABLE. Setting
-- search_path does not change volatility, so the generated column stays
-- legal. It does make the function non-inlinable, which is irrelevant
-- here: the column is computed on write, not per read.
--
-- Lower severity than a SECURITY DEFINER helper would be, because this
-- one is invoker-rights and is pure arithmetic over its arguments. It
-- reads no tables, so there is no object for a hostile search_path to
-- shadow. Pinned anyway: "reads no tables" is a property of the body as
-- written today, not a guarantee about the next edit.
--
-- Verified after applying: provolatile still 'i', and the labor math is
-- unchanged at every measured point -- crew 4 at $75 with a 3h minimum,
-- 8h overtime threshold and 1.5x gives 900 at 2h, 1500 at 5h, 3300 at
-- 10h; DEAL-3012 4200.00; DEAL-3013 15000.00; booked revenue 21100.00.
-- =====================================================================
alter function app.calc_labor_total(
  p_estimated_hours numeric,
  p_crew_size integer,
  p_hourly_rate numeric,
  p_min_hours numeric,
  p_ot_threshold numeric,
  p_ot_multiplier numeric
) set search_path = '';
