/**
 * Shared environment reading for the seed scripts.
 *
 * NOTHING IS HARDCODED AND NOTHING IS DEFAULTED. Every one of these is a
 * credential; a script that falls back to a built-in value is a script that
 * silently writes to the wrong project.
 *
 * .env.local carries only the two public values (URL and publishable key).
 * The secret key and the direct database URL are deliberately not in the repo
 * and must be exported in the shell that runs these scripts.
 */

export function required(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) return value.trim();
  }

  throw new Error(
    `Missing environment variable. Set one of: ${names.join(", ")}.\n` +
      `Export it in your shell; do not commit it. The secret key is at\n` +
      `Supabase dashboard -> Project Settings -> API Keys -> secret key,\n` +
      `and the database URL at Project Settings -> Database -> Connection string (session mode).`,
  );
}

/** Project REST URL, safe to publish. */
export const projectUrl = () => required("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");

/**
 * The secret (service_role) key. Server side only, never NEXT_PUBLIC_.
 * Needed for auth.admin.* and for creating a private Storage bucket.
 */
export const secretKey = () => required("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");

/**
 * The publishable (anon) key. Safe to publish; it is the same value the
 * browser ships. Scripts that need to act AS A SIGNED-IN USER -- exercising
 * RLS rather than bypassing it -- use this plus a real email/password,
 * never the secret key.
 */
export const publishableKey = () => required("SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

/**
 * A DIRECT Postgres connection string.
 *
 * Required rather than optional: dev_seed and app are not PostgREST-exposed
 * schemas and `service_role` holds no USAGE on either, which is exactly the
 * property that keeps the reseeder and the code minter off the public API.
 * The consequence is that their only caller is a real database connection.
 */
export const databaseUrl = () => required("SUPABASE_DB_URL", "DATABASE_URL");
