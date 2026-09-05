import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

/**
 * Session refresh on every matched request.
 *
 * This is NOT the authorization gate. A Server Action is a POST to the route
 * that defines it, and a matcher edit can silently remove coverage here, so
 * the gate is `requireAuth()` in the protected layouts and actions, and RLS
 * below that. This file's one job is refreshing an expired access token and
 * writing the rotated cookies onto both the request and the response.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // Rebuild the response from the mutated request so Server
          // Components downstream see the refreshed token this same request.
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Verifies locally (asymmetric signing keys) and refreshes via the refresh
  // token when the access token has expired. Do not run other code between
  // client creation and this call; the refresh must happen before anything
  // reads the session.
  const { data } = await supabase.auth.getClaims();

  // A signed-in caller has no business on the login or register screens.
  const authPath = request.nextUrl.pathname;
  if (data?.claims && (authPath.startsWith("/auth/v1/login") || authPath.startsWith("/auth/v1/register"))) {
    return NextResponse.redirect(new URL("/dashboard/default", request.url));
  }

  return response;
}

export const config = {
  // Everything except static assets. The gate does not live here, so the
  // matcher only needs to be broad enough that tokens never go stale.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
