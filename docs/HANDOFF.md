# Handoff: movers-app

Updated 2026-08-27, end of the auth + conversion + quote builder session.
Everything below was measured in a real browser against the live database,
not assumed. The previous handoff described the backend-only state; this one
replaces it.

## What this project is

A movers CRM, forked from the "Studio Admin" Next.js template, backed by
Supabase project `movers-app`, ref `jannhzvqrsumtscidtkx` (org JC Media,
us-west-1, Postgres 17.6). All data in the app is filler.

## What is DONE and verified in a browser

**Auth is on.** Three auth users exist (created via SQL because the classifier
blocks CLI secret-key retrieval; `scripts/seed-auth-users.ts` itself remains
unrun). Password login, `claim_staff_for_current_user`, sign-out, the
`/auth/v1/login` redirect for signed-in users, and the unauthorized page's
sign-out exit were all exercised. Credentials are in `.env.local` (gitignored).

- `src/proxy.ts` refreshes tokens; it is NOT the gate. `requireAuth()` in
  `dashboard/layout.tsx` is, with RLS beneath it.
- The dashboard shell shows the real signed-in staff member (name, role,
  avatar) in the header menu and sidebar footer. The fake account switcher,
  `src/data/users.ts`, the register routes, the `auth/v2` tree, and the dead
  Google button are deleted.

**Converted to live reads:** Dashboard metric cards (real aggregates,
verified to reproduce the seed's measured figures: $21,100 booked, 52%
occupancy, 4,110 of 7,900 ft³, 14 vaults), Recent Client Activity, Clients
list, Client detail, Sales KPI cards, Pipeline board, Leads table.

**The quote builder exists and works end to end.** `/dashboard/sales/[id]`
(deal code) with `?quote=` selecting among the deal's quotes.

- The DB computes every dollar. The builder writes inputs only; the summary
  rail renders the row Postgres returned. Draft edits autosave (600ms
  debounce) and were verified against the seed math: 3 movers x 10h = $2,310
  with overtime, fuel surcharge 3.2% of labor = $73.92, percent deposit
  bounded by total.
- Lifecycle exercised as Morgan: create (code minted by `next_quote_code`),
  edit, add/remove catalog line items, send (pricing freezes), accept
  (write-back set the deal to $2,633.92 / source quote), delete draft.
  QTE-2026-0003 on DEAL-3001 is the surviving artifact.
- Accepting a quote also moves the deal to Won (best effort, in
  `decideQuote`); the freeze/write-back triggers remain the DB's own.
- Read-only callers (verified as Elena) get the record view with NO write
  affordances; `canWriteQuotes()` in `src/server/queries/quotes.ts` mirrors
  `has_any_perm(['proposals','pipeline'], true)` read-side. RLS still
  enforces.

**Mobile pass at a real emulated 390px.** Every table that overflowed now
measures zero hidden pixels: clients, leads, storage customers, vaults,
settings users, settings roles, recent activity. The pattern is
breakpoint-synced `columnVisibility` plus a `max-w-* sm:max-w-none` clamp on
name cells (auto-layout tables never shrink below content min width).
Calendar defaults to the list view on phones (month grid one select away).
The invoice paper preview holds a 0.7 scale floor and pans instead of
rendering 5px text.

## Landmines fixed this session, do not reintroduce

- `overflow-x-hidden` on the dashboard layout's content wrapper silently
  killed `position:sticky` for every descendant. It is now `overflow-x-clip`.
  The builder's docked mobile total bar depends on this.
- TanStack v9's row-level `getVisibleCells()`/`getIsVisible()` caches do not
  track a visibility change made after the row model is built. The roles
  table filters cells against `table.getVisibleLeafColumns()` instead.
- Roles table `minWidth` now sums VISIBLE columns; `getTotalSize()` counted
  hidden ones and held the mobile table at desktop width.
- The `filters.accountOwner` / `leadsFilters.owner` hardcoded name lists are
  gone; owner options derive from the rows.

## What is NOT done

1. **Warehouse, Calendar, Documents, Settings still read static arrays.**
   Their query modules (warehouse, calendar) exist and are typed; documents
   and settings have none yet. Their mobile layout defects are fixed.
2. **Documents have no bytes.** `scripts/seed-documents.ts` is written and
   unrun (needs `SUPABASE_SECRET_KEY` + `SUPABASE_DB_URL` exported).
   Download and signed URLs 403 until it runs.
3. **All three seed scripts remain built, not verified.** The auth users were
   created via SQL instead.
4. **Inert chrome buttons remain on every screen**: Add Client, Export, Hide,
   Customize, Quick Create, calendar Add job/event, invoice Download PDF,
   row-menu items like Edit details / Log activity / Record payment. They are
   template capability markers; each should become real or be deleted when
   its screen converts.
5. **Lead Flow and Operations Volume charts are synthetic** (client-side
   literals). No activity-history table exists to back them.
6. **Pipeline drag does not persist**; the board is local state over real
   rows.
7. Known follow-ups carried forward: `company_billing_profile` broad read
   exposes `routing_number` (split the banking columns, D21); leaked-password
   protection is off in Auth settings (advisor WARN).

## Verify as Elena, not Morgan

Unchanged and still load-bearing: Admin/Owner are `access_level = 'Full'` and
short-circuit every permission check. Elena Torres (Dispatcher, Scoped) is
the account that exposes gaps. Reads are broad by design; a gated read ships
as a blank screen because the sidebar is static and no screen has an
access-denied state.

## Security advisor state (checked this session)

- `app.code_counters` RLS-no-policy INFO: intentional, both layers deny.
- Eight SECURITY DEFINER RPCs callable by `authenticated` WARN: the
  caller-facing API, each gates internally. Expected cost of the design.
- Leaked-password protection disabled WARN: enable in Auth settings when the
  app carries anything real.

## Rules that are load-bearing (carried forward)

- Reads are broad, writes are gated. Never filter a REFERENCED staff row by
  status (Sofia Marchetti is Deactivated and owns clients/deals).
- A policy is not a grant; check `role_table_grants` AND `column_privileges`.
- Never run the Supabase CLI push command; a PreToolUse hook denies it.
- The `0010_seed` parts pin `set search_path = public, extensions;` for
  citext. Do not strip.
- Run `9999_security_guard.sql` after any migration.
- The Next dev-tools badge at 390px is not a layout bug; it does not exist in
  production builds.

## Next steps, in order

1. Convert Warehouse (both tabs as one unit; `vaults-columns.tsx` still
   imports `storageCustomers` by value, replaced by `vaults_expanded`'s
   pre-joined columns).
2. Convert Calendar (prop contract changes: uniform `CalendarEvent[]`, ISO
   strings, office events gain ids).
3. Documents: run `seed-documents.ts`, then convert the screen.
4. Settings: users/roles from `staff` + `roles_expanded`; wire the admin_*
   RPCs that already exist.
5. Make or remove the inert chrome buttons per screen as each converts.
