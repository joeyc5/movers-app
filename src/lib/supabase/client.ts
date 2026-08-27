import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * The publishable key is safe in the client bundle by design — RLS is what
 * protects the data, not the secrecy of this key. The secret key must never
 * appear here or in any NEXT_PUBLIC_ variable.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
  );
}
