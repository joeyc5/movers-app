# Fleet brief, 2026-09-02: functioning pages

This file binds every agent dispatched today. Read it fully before touching
a file. It is also the session's record: the lead updates the status table
at the bottom as streams land.

## The goal

Joey's direction, in his words: "the priority is the app. nobody would pay
for this right now, not in the state that its in." Session scope: as much
development as possible, functioning working pages. Billing and Stripe are
out of scope today. Pricing is undecided; nothing you build may hardcode a
plan or tier.

Audit at session start: 2 of 9 dashboard screens fully live, 4 fully static
(Calendar, Documents, Warehouse, Settings), one writable entity (quotes), 55
inert template controls, no signup or invite UI, pipeline drag reverts on
refresh. Your stream turns one of those into a screen a moving company can
actually run on.

## Read first

1. `CLAUDE.md` and `AGENTS.md` at the repo root.
2. `docs/HANDOFF.md`: what is live, what is static, the landmines.
3. The SQL for your tables in `supabase/migrations/` (DDL, CHECK
   constraints, triggers, and the RLS policies in `0008_rls_policies.sql`
   and grants in `0009_grants.sql`). The database decides what a write can
   do; the UI has to agree with it.

## Hard constraints

- No git commits, no stash, no checkout, no branch changes, no `git add`.
  The lead commits.
- Do not start `npm run dev`. A shared dev server is already running at
  http://localhost:3000 with hot reload. Do not run `npm run build`; the
  lead runs it once at the end.
- Do not add migration files or run any SQL against the project. The
  schema is frozen for this session except `0024_code_minters.sql` and
  `0025_self_serve_signup.sql`, which are written but NOT YET APPLIED to
  the live database. If you need a schema change, write the exact SQL you
  need into your report under "Schema changes needed" and build the UI
  against it anyway.
- Do not edit `src/lib/supabase/database.types.ts`. The four new RPCs
  (`next_client_code`, `next_deal_code`, `next_event_code(p_kind)`,
  `signup_create_company(p_name, p_slug)`) are already typed there.
- Do not edit `src/components/ui/**` or `src/components/calendar/**`
  (AGENTS.md rule). Customize at the call site.
- Stay inside your file boundary. Other agents are editing the same tree
  right now. If you need a change outside your boundary, put it in your
  report; do not make it.
- Production data is live. Writes through the app's own signed-in paths
  while you test in the browser are allowed, in the Demo Movers tenant
  only. Name test records so they are obvious (prefix "TEST"), and delete
  or deactivate them when you are done if the UI you built allows it.
  Never sign in as the Silicon Valley Moving owner.

## Sign-in for browser verification

Demo credentials are in `.env.local` lines 5 to 7 (gitignored). Use
**Elena Torres** (`elena.torres@example.com`, Dispatcher, Scoped access)
for every semantic check: Admin and Owner short-circuit every permission
and render perfectly whether the policies are right or not. Use Morgan
Ellis (Admin) only for actions Elena's role cannot perform, and say so in
the report.

Browser tooling: try the chrome-devtools MCP tools
(`mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`). They were
disconnected at session start and retry on their own; if they are still
unavailable, verify with `curl` against http://localhost:3000 for renders
and report every interactive path as "built, not verified in browser".
Mobile check is `emulate` with `390x844x2,mobile,touch`; `resize_page`
lies below about 500px.

## Skills to load, in this order

1. `intent` to frame who the screen is for and what it must accomplish.
   Two sentences in your report; do not skip it.
2. `frontend-design` and `impeccable` to execute.
3. `stop-slop` for every word a person reads: labels, empty states,
   toasts, errors, dialogs.

## Design house rules (checkable)

- Tokens only. No `text-[Npx]`, no raw hex, RGB, HSL, or OKLCH.
- No colored `border-left` above 1px on a card, row, or callout.
- No page-load entrance animations. Interaction feedback is immediate.
- No eyebrow text: no explanatory subtext under a label, heading, or form
  field.
- Copy that only narrates state gets deleted, not reworded.
- A figure or count that cannot be opened is a dead end.
- No em dashes anywhere, in code comments included.
- Match the neighbouring screens in card density, borders, radius, spacing.

## Inert chrome policy

Delete every button, menu item, and link in your screen that has no real
action behind it. A control comes back only when a Server Action or a real
navigation stands behind it. No `onClick={() => {}}`, no `href="#"`, no
"coming soon". The audit counted 55 across the app; your screen's count is
in your stream section.

## Patterns to copy

- Server Actions: `src/server/quote-actions.ts` (auth via `requireAuth()`,
  `createClient()`, error mapping to a `{ error }` result, `revalidatePath`).
  One file per domain, `"use server"` at the top, every exported function
  validates its inputs with zod because every export is a public POST.
- Queries: `src/server/queries/*.ts` (`import "server-only"`, `cache()`,
  typed rows, PostgREST embed hints in constraint-name form on composite
  FKs, for example `deals!deals_client_id_fkey(...)`).
- Forms: `src/app/(main)/auth/_components/login-form.tsx` (react-hook-form
  + zod v4 + `Controller` + `Field`). Toasts via `sonner`.
- Code minting: `createQuote` in `quote-actions.ts` shows the RPC-then-
  insert shape. Same for `next_client_code`, `next_deal_code`,
  `next_event_code`.
- Permissions: RLS is the gate. The UI hides or disables write affordances
  for users who cannot write: `getCurrentStaff()` returns
  `role.access_level` (`'Full' | 'Scoped' | 'Read only'`). A Read-only user
  sees the record, not the buttons.
- Tables are TanStack Table v9 (`useTable`, `table.FlexRender`). Filter
  cells against `table.getVisibleLeafColumns()`; row-level visibility
  caches go stale.

## Verification duties before you report

1. `npx tsc --noEmit -p tsconfig.json` passes. If an error is in a file
   outside your boundary, note it and move on; if it is yours, fix it.
2. `npx biome check <your files>` is clean.
3. Every write path you built is exercised in the browser as Elena at
   http://localhost:3000, or listed as built-not-verified with the exact
   reason.
4. The screen renders at 1440, 1024, and 390 wide in light and dark with
   no horizontal overflow. Say what those passes caught.

## Report format

Under 500 words. Sections, in order: Framing (two sentences from
`intent`). Built (files, what each does). Verified in browser (steps and
what you saw). Built, not verified (with reasons). Deleted (chrome, with
counts). Schema changes needed (exact SQL, or "none"). Errors outside my
boundary. Nothing else.

---

## Streams

### S1 Calendar

Boundary: `src/app/(main)/dashboard/calendar/**`,
`src/server/queries/calendar.ts`, new `src/server/calendar-actions.ts`.
Read-only imports allowed from `src/server/queries/clients.ts` (`getClients`)
and `src/server/queries/warehouse.ts`.

Today: the screen renders `_components/events-data.ts` (191 static lines).
`src/server/queries/calendar.ts` already reads `calendar_events_expanded`
(`getDispatchEvents`, `getOfficeEvents`) and has zero importers. One inert
control.

Build: wire the live reads and delete the static file. Create event
dialog for the three shapes (`job`, `survey`, `office`) that respects
`calendar_events_shape_check` (office has no status and no client; job and
survey need a status), mints the code with `rpc('next_event_code',
{ p_kind })`, and writes `starts_at`/`ends_at` as real instants in the
company timezone. Status change on a job or survey. Reschedule by drag if
the calendar component exposes an event-drop callback (it is in
`src/components/calendar/`, read-only for you); otherwise an edit dialog.
Crew assignment through `calendar_event_crew` if time allows. Note the
trigger `app.tg_calendar_events_protect_job_type` in 0005.

Blocked until 0024 applies: the mint RPC will fail with "function not
found" in the browser. Build it, verify the dialog and validation, and
list the create as built-not-verified.

### S2 Warehouse

Boundary: `src/app/(main)/dashboard/warehouse/**`,
`src/server/queries/warehouse.ts`, new `src/server/warehouse-actions.ts`.
Read-only import of `getClients` allowed.

Today: both tabs render `_components/data.ts`. `queries/warehouse.ts`
already reads `storage_agreements_expanded` and `vaults_expanded` with zero
importers. Eight inert controls.

Build: wire the live reads and delete the static data. Storage agreement
status changes and edits, vault status changes and assignment to an
agreement, per the CHECK constraints in `0004_operations.sql`. Creating an
agreement or a vault needs a code (`STO-NNNN`, `V-NNNN`); the lead is
adding `next_storage_code()` and `next_vault_code()` to
`0024_code_minters.sql` and to the types file within minutes of your
start, same shape as `next_client_code`. Build the create paths against
those RPC names; re-run `tsc` if it complains before they land. Creates
are built-not-verified until the migration applies; everything else you
can verify live.

### S3 Settings

Boundary: `src/app/(main)/dashboard/settings/**`, new
`src/server/queries/staff.ts`, new `src/server/staff-actions.ts`, new
`src/server/company-actions.ts`. Read-only import of
`getCompanyBillingProfile` from `queries/company.ts` allowed.

Today: every tab is static (`profile/profile-data.ts`, `users/data.tsx`,
`roles/roles-table/data.ts`). 23 inert controls, the most in the app.

Build: Users from `staff` joined through `staff_role_id_fkey`, with invite
(`admin_invite_staff`), edit (`admin_update_staff`), role change
(`admin_set_staff_role`), status change (`admin_set_staff_status`); these
RPCs exist and gate internally, and the company must keep an Owner. Roles
read-only from `roles_expanded`, `role_permission_sets`,
`permission_sets`; no role editing exists in the schema, so no role
editing in the UI. Profile from the current staff row; `full_name` and
`avatar_url` are the only two columns `authenticated` may update. Company
tab: edit `company_billing_profile` (name, email, phone, website, address,
tax ID); render the two banking fields only for `access_level = 'Full'`.
Nothing here needs an unapplied migration; verify everything live as
Elena and, for the admin actions Elena cannot perform, as Morgan.

### S4 Clients

Boundary: `src/app/(main)/dashboard/clients/**` EXCEPT
`src/app/(main)/dashboard/clients/[id]/_components/invoice/**` (S7 owns
that), `src/server/queries/clients.ts`, new `src/server/client-actions.ts`.
You own `clients/[id]/page.tsx`; keep the existing `<Invoice client=...
from=...>` mount and its props exactly as they are.

Today: list and detail read live. Zero write paths. Seven inert controls
on the list, four on the detail.

Build: new client (sheet or dialog) that mints with `rpc('next_client_code')`
and satisfies the all-or-nothing address groups and NOT NULL contact
fields in `0003_crm.sql`; edit client; status change across
`Lead / Active / In Storage / Past / Inactive`; notes. Deleting is
RESTRICT-blocked by deals and calendar events, so offer Inactive, not
delete. Creates are built-not-verified until 0024 applies; edits and
status changes you can verify live on an existing Demo client.

### S5 Sales

Boundary: `src/app/(main)/dashboard/sales/**`, `src/server/queries/deals.ts`,
new `src/server/deal-actions.ts`. Do not edit `src/server/quote-actions.ts`
or `src/server/queries/quotes.ts`; the quote builder on `sales/[id]` is
finished and verified. Read-only import of `getClients` allowed.

Today: board and stats read live. `pipeline-board.tsx:63-67` restores
state on cancel and never writes; drags revert on refresh. `lead-flow.tsx`
is a hardcoded 12-month array. `data.ts` has a static `dealOwners` avatar
map. One inert control.

Build: persist drag (stage plus `board_position`, ordered by
`(stage, board_position, created_at)`), honouring `deals_won_needs_client`
(a Won drop without a client gets a clear error and snaps back) and the
quote-sourced value rule. New deal dialog with `rpc('next_deal_code')`:
client optional, `client_name` required, stage, priority, estimated value,
move date, origin and destination city, owner. Edit those fields from the
deal detail header on `sales/[id]` without touching the quote builder
components. Mark Lost. Lead flow chart from real deals grouped by month of
`created_at`; owners from `staff`. Drag persistence and edits verify live;
the create is built-not-verified until 0024 applies.

### S6 Documents

Boundary: `src/app/(main)/dashboard/documents/**`, new
`src/server/queries/documents.ts`, new `src/server/document-actions.ts`.

Today: fully static (`_components/data.ts`). Nine inert controls. No bytes
exist in the `documents` bucket; every Download 404s.

Build: live list from `documents`, `document_folders`, `document_stars`.
Upload from the browser client (`src/lib/supabase/client.ts`) into bucket
`documents` at a path whose first folder segment is the company id, which
is what `documents_object_insert` in `0018_storage_grants.sql` checks
(read that policy and `0005_documents.sql`'s storage_path convention
before choosing the path), then insert the `documents` row (`kind`,
`mime_type`, `visibility`, `owner_staff_id`, folder). Download through a
signed URL minted in a Server Action. New folder. Star toggle. Move to
trash sets `deleted_at`; there is no delete grant. The company id comes
from `getCurrentCompany()` in `src/lib/supabase/auth.ts`. Everything here
verifies live; uploading a small TEST file as Elena is the acceptance test.

### S7 Invoices

Boundary: `src/app/(main)/dashboard/clients/[id]/_components/invoice/**`,
new `src/server/invoice-actions.ts`, new `src/server/queries/invoices.ts`.
The page mounts `<Invoice client={client} from={invoiceFrom} />` from
`invoice/invoice.tsx`; keep that export name and props signature. Fetch
everything else you need inside your own components. Do not edit
`clients/[id]/page.tsx` (S4 owns it).

Today: an invoice paper with a hardcoded tax option (`data.ts:133`) and
items that default to `[]`; nothing saves.

Build: list this client's invoices; create one (optionally from a Won deal
or an accepted quote) with `rpc('next_invoice_code')`, which already
exists and works; line items; tax from live `tax_rates`; the database
computes totals through the triggers in `0006_functions.sql` (`freeze`,
`recompute`, `rollup`), so write inputs only, never totals; status moves
`Draft` to `Sent` to `Paid`, and `Void` instead of delete. Read the
`invoices` and `invoice_line_items` DDL and the freeze trigger before
designing edits: a sent invoice is frozen. Verifies live end to end as
Elena if her role holds `invoices` write; otherwise as Morgan, and say so.

### S8 Dashboard and shell

Boundary: `src/app/(main)/dashboard/default/**`,
`src/app/(main)/dashboard/_components/**`, `src/server/queries/dashboard.ts`,
`src/navigation/**`. Do not edit `src/app/(main)/dashboard/layout.tsx`
(S9 has one line in it).

Today: metric cards and recent clients are live; `performance-overview.tsx`
draws a PRNG series. The sidebar "Quick Create" and the header search open
nothing. Layout controls expose the template's preset and variant switches.

Build: the overview chart from real monthly series (deals created and won,
quoted value) via `queries/dashboard.ts`. Delete Quick Create. Make the
header search real: clients and deals by name or code, navigate on select,
or delete it. In the header, keep the light and dark toggle and remove the
template preset and layout-variant controls (content width, sidebar
variant); this is the first step of killing the template feel and it is
approved. Account menu items must navigate or go.

### S9 Signup and onboarding

Boundary: `src/app/(main)/auth/**`, new `src/app/(main)/onboarding/**`,
`src/server/auth-actions.ts`, new `src/server/signup-actions.ts`,
`src/proxy.ts` (only to add the register route to the signed-in redirect),
`src/app/(main)/unauthorized/page.tsx` (copy only), and exactly one change
in `src/app/(main)/dashboard/layout.tsx`: when `staff` is null and
`company.state === 'no-membership'`, redirect to `/onboarding` instead of
`/unauthorized`.

Today: password login only. Copy says accounts are created by an
administrator. `create_company` is service-role only.

Build: `/auth/v1/register` with full name, email, password; call
`supabase.auth.signUp` with `options.data.full_name` and
`emailRedirectTo` = `<origin>/auth/callback?next=/onboarding` (origin from
the request headers, never hardcoded). If a session comes back
(confirmations off), redirect to `/onboarding`; otherwise show a "check
your email" state on the same page. `/onboarding`: `requireAuth()`; if
`getCurrentCompany()` is `'ok'` redirect to the dashboard; else a form for
company name and a slug derived from it (editable, validated
`^[a-z0-9]+(-[a-z0-9]+)*$`, 3 to 40), calling `rpc('signup_create_company')`
and mapping its error codes (28000 not verified, 42501 already a member,
22023 bad input, 23505 slug taken) to plain copy. Login page gets a
"Create your company" link and loses the administrator sentence.

Do not exercise `signUp` against production: it creates a real auth user
and sends a real email. Verify rendering, validation, and the redirect
logic; list the RPC call as built-not-verified (0025 is unapplied). Report
the two Supabase Auth settings Joey must add: the callback URL for
production and localhost in Redirect URLs, and leaked-password protection.

---

## Status (lead updates)

| Stream | State | Verified |
|---|---|---|
| S1 Calendar | dispatched | |
| S2 Warehouse | dispatched | |
| S3 Settings | dispatched | |
| S4 Clients | dispatched | |
| S5 Sales | dispatched | |
| S6 Documents | dispatched | |
| S7 Invoices | dispatched | |
| S8 Dashboard and shell | dispatched | |
| S9 Signup | dispatched | |
