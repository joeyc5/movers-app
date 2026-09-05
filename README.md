# movers-app

A multi-tenant CRM for moving companies. Each company is a tenant with its
own clients, sales pipeline, quotes, invoices, calendar, warehouse, documents,
and staff. Isolation is enforced in the database, not in application code.

Production: https://movers-app-gilt.vercel.app

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- Supabase Postgres 17 with row-level security, project `jannhzvqrsumtscidtkx`
- Vercel, auto-deploys on push to `main`

## Run it locally

```bash
npm install
npm run dev
```

`.env` is tracked and holds only the public Supabase URL and publishable
key. `.env.local` is gitignored and holds secrets and the demo sign-ins.

## Checks before you push

```bash
npx tsc --noEmit
npm run check
npm run build
```

## Database

Migrations live in `supabase/migrations/` and apply in filename order. After
any migration, run both guards: `9999_security_guard.sql` checks the access
control shape and `0021_tenancy_guard.sql` checks the tenancy shape. Then run
`supabase/tests/verify-isolation.sql` in a single session; it proves that
three tenants partition every scoped table and rolls itself back.

Regenerate types after a schema change:

```bash
npm run gen:types
```

## Read next

- `docs/TENANCY.md` is what the database guarantees, how to re-prove it, and
  what is still open.
- `docs/PROGRESS.md` logs what shipped and when.
- `CLAUDE.md` holds the operational rules for working in this repo.
