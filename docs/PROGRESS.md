# Progress

What the archived plans produced. One entry per completed effort, newest
first. The plans themselves are in `docs/archive/`; nothing there is current.

## 2026-09-05 — Design system sync, and repairs to the working-pages branch

The shadcn library in `src/components` now syncs to a Claude Design project
as 64 root components across nine groups, each with an authored preview, a
hand-written doc, and a prop contract extracted from the source. Config and
regeneration live in `.design-sync/`, documented in its own `NOTES.md`.

Repaired what the 2026-09-02 fleet left half-migrated. Warehouse, Documents,
and Settings had live queries written but their pages still imported deleted
fixtures; the invoice draft form model had been removed out from under six
components; `ClientFormSheet` and `CompanyPanel` had no call site and no file
respectively. The branch went from thirty type errors to a clean build.

Applied migrations `0024` and `0025`, which had never reached the live
database. Six code-minting RPCs did not exist there, so creating a client,
deal, calendar event, storage agreement, or vault, and self-serve signup,
were failing in production. Both guards pass and `verify-minters.sql` returns
all seven expected probes.

Patched `fast-uri` and `qs` for five Dependabot alerts.

Added `0026`, the 47 composite foreign-key covering indexes `0015` never
created. Generated from `pg_constraint`, applied, verified 0 of 48 missing.

## 2026-09-02 — Working pages

Nine parallel streams moved Clients, Sales, Calendar, Warehouse, Documents,
Invoices, Settings, the dashboard shell, and signup off static fixtures and
onto live tenant-scoped reads. Shipped as `c33c2e0`, reverted, reapplied as
`b8dba25`.

The reapply landed consumers whose data modules had changed shape, which is
the drift the 2026-09-05 session repaired. Calendar is the one screen that
still reads static arrays.

## 2026-08-27 to 08-28 — Multi-tenancy retrofit

Converted a single-company CRM into multi-tenant SaaS across migrations
`0012` through `0023`. Every business table carries a `NOT NULL company_id`
with composite foreign keys to its scoped parents, company-scoped uniqueness,
one RESTRICTIVE `tenant_isolation` policy, and an immutability trigger that
`service_role` cannot bypass. `create_company()` provisions a tenant's roles,
locations, rate card, tax rate, and Owner row; `claim_staff_for_current_user()`
binds an auth user to their staff row on sign-in.

Two claim defects were found and fixed in `0022`: a second membership could be
picked up silently, and a `'Pending invite'` Owner blocked every staff
administration call in their own company.

Three tenants exist, and the third is deliberate. `9999_security_guard.sql`
and `0021_tenancy_guard.sql` check the shape; `supabase/tests/verify-isolation.sql`
proves the semantics and last ran 39 of 39 green.

See `docs/TENANCY.md` for what is guaranteed and how to re-prove it.
