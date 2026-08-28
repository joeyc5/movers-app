# movers-app

Read docs/HANDOFF.md first. It is the state of record: what reads live data,
what is still static, and the landmines already fixed.

- `.env` is tracked on purpose. It holds only public Supabase values and
  Vercel builds read it. Never add `.env*` to .gitignore; the Vercel CLI
  tries to append that line and it silently breaks deploys. Secrets and
  demo sign-ins live in the gitignored `.env.local`.
- Vercel: project `movers-app` under team jcmedia, production
  https://movers-app-gilt.vercel.app, auto-deploys on push to main.
  No dashboard env vars by design.
- Tables are TanStack Table v9 (`useTable`, `table.FlexRender`). v8 idioms
  do not compile, and row-level visibility caches go stale after
  `columnVisibility` changes (see HANDOFF landmines).
- Mobile verification: chrome-devtools `emulate` with `390x844x2,mobile,touch`.
  `resize_page` cannot go below about 500px and lies about 390.
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
