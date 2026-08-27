import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth and email-confirmation landing point.
 *
 * Supabase redirects here with a `code`; exchanging it is what actually creates
 * the session cookie. A Route Handler can write cookies (unlike a Server
 * Component render), which is why the exchange lives here.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Only ever redirect to a path on this origin. Taking the raw parameter would
  // make this an open redirect: ?next=https://evil.example lands the freshly
  // signed-in user on someone else's site.
  const nextParam = searchParams.get("next") ?? "/dashboard/default";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard/default";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/v1/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/v1/login?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
