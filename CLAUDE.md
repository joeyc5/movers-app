# movers-app

Multi-tenant SaaS CRM for movers. `docs/TENANCY.md` is what the database
guarantees, how to re-prove it, and what is still open. `AGENTS.md` holds the
co-location structure, the screen-building checklist, and the Biome
conventions. `docs/PROGRESS.md` logs what shipped and when; `docs/archive/`
holds completed plans, none of them current.

## Commands

```bash
npm run dev          # sandbox must be disabled, see below
npm run build        # before calling any web work finished
npm run check:fix    # biome lint + format; the pre-commit hook runs this
npm run gen:types    # regenerate src/lib/supabase/database.types.ts; sandbox off, it calls the supabase CLI
npm run seed:dev     # reseed demo data
```

There is no test runner. Verification is `npm run build`, the two SQL guards
below, and a real browser.

- `.env` is tracked on purpose. It holds only public Supabase values and
  Vercel builds read it. Never add `.env*` to .gitignore; the Vercel CLI
  tries to append that line and it silently breaks deploys. Secrets and
  demo sign-ins live in the gitignored `.env.local`.
- Vercel: project `movers-app` under team jcmedia, production
  https://movers-app-gilt.vercel.app, auto-deploys on push to main.
  No dashboard env vars by design.
- Tables are TanStack Table v9 (`useTable`, `table.FlexRender`). v8 idioms
  do not compile, and row-level visibility caches go stale after
  `columnVisibility` changes.
- Mobile verification: chrome-devtools `emulate` with `390x844x2,mobile,touch`.
  `resize_page` cannot go below about 500px and lies about 390. The Next
  dev-tools badge at 390px is not a layout bug; it does not exist in
  production builds.
- The dashboard layout's content wrapper uses `overflow-x-clip`, not
  `overflow-x-hidden`. The latter silently kills `position:sticky` for every
  descendant.
- `npm run dev`, `npm run build`, and `git push` need the Bash sandbox
  disabled here (port bind EPERM, stalled build, SSH broken pipe). So does
  every `supabase` CLI call: sandboxed it dies on `EPERM` writing
  `~/.supabase/telemetry.json.tmp.*` behind a stack trace that looks like
  anything but a permissions problem. The CLI is logged in and
  `supabase gen types` works; only `supabase projects api-keys` is refused,
  by the classifier.
- Nothing here needs the secret key. To exercise RLS as a given user, call
  `set local role authenticated` and `set_config('request.jwt.claims', ...)`
  inside a `pg_temp` function via the MCP, and return a table: `raise notice`
  output never comes back through `execute_sql`.
- MCP `execute_sql` has no nested transactions. A bare, permanent statement
  followed later in the *same call* by an explicit `begin; ...; rollback;`
  block does not isolate the two; the trailing `rollback` undoes the earlier
  bare statement too, silently. This undid a restore mid-task once already.
  Keep every permanent DDL/DML statement in its own `execute_sql` call,
  separate from any `begin; ...; rollback;` probe.
- Deleting from `storage.objects` needs `storage.allow_delete_query` set
  first. Supabase's `storage.protect_delete()` trigger blocks a plain
  `DELETE` on that table even as `postgres`.
- Applying a migration: `supabase link --project-ref jannhzvqrsumtscidtkx`
  once, then `supabase db query --linked -f <path.sql>`. The same command runs
  the guards and the tests. Sandbox off, like every supabase call.
- Run both guards after any migration: `9999_security_guard.sql` (access
  control shape) and `0021_tenancy_guard.sql` (tenancy shape). Neither is
  optional; each catches a class of regression the other cannot.
- `supabase migration list --linked` cannot tell you what is applied here.
  Local files are `0001`-`9999`; the remote was applied through the MCP under
  timestamp names, so the two columns never line up and every migration reads
  as pending. To know whether something is really applied, query the object:
  `select conname from pg_constraint where conrelid = 'public.x'::regclass`,
  or `pg_proc` for a function. 0024 and 0025 sat unapplied for a week behind
  this; five features were broken in production and nothing caught it.
- `npm run gen:types` is a truth oracle. If a function or table vanishes from
  the regenerated file, it is missing from the live database. Diff the
  `Functions:` block against git before assuming the tool misbehaved.
- PostgREST embed hints on composite FKs must use constraint-name form
  (`deals!deals_client_id_fkey(...)`), not column-name form. Column-name
  hints break against composite FKs and return PGRST200. `supabase gen types`
  cannot resolve the hint either: it types the embed as `SelectQueryError`, so
  a correct query still needs `as unknown as Row[]`. The cast is the fix; the
  query is not wrong.
- `supabase/tests/verify-isolation.sql` proves tenant semantics. Run it
  as one MCP `execute_sql` call (it uses `pg_temp` and `SET LOCAL ROLE`,
  both session-scoped). It rolls back everything it touches.
- `.design-sync/` syncs `src/components` to the Claude Design project
  "Movers CRM". Read `.design-sync/NOTES.md` before touching it. Three
  things there look wrong and are not: `dist/` is a gitignored
  declarations-only tsc build, `package.json` carries a `"types"` field
  that only the converter reads, and `biome.json` excludes `.design-sync`
  because the converter requires PascalCase preview filenames.
