import "server-only";

import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Server-side Supabase client, for Server Components, Server Actions and Route
 * Handlers. Reads the caller's session cookie, so every query runs as that
 * staff member and RLS decides what comes back.
 *
 * `cookies()` is async in Next 15+, so this factory is async and every call
 * site awaits it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
            // `headers` carries the no-store cache directives that keep a CDN
            // from caching a response that sets auth cookies — serving one
            // user's token to another. The response headers are written by
            // proxy.ts, which owns the refresh; nothing to apply here.
            void headers;
          } catch {
            // Next.js forbids cookie writes during a Server Component render.
            // Swallowing is only correct because proxy.ts performs the real
            // token refresh on every request. Removing this try/catch crashes
            // every authenticated page render.
          }
        },
      },
    },
  );
}
