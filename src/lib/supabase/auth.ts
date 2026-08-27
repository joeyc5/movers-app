import "server-only";

import { cache } from "react";

import { redirect } from "next/navigation";

import { createClient } from "./server";

/**
 * The authorization boundary. `proxy.ts` refreshes tokens; it is NOT the gate,
 * because a Server Action is a POST to the route that defines it and a matcher
 * change can silently remove proxy coverage. Every Server Action and every
 * protected layout calls in here.
 *
 * RLS is the third layer, and assumes both of the others can be bypassed.
 *
 * `cache()` dedupes across the layout and every page and component in a single
 * request, so this costs one verification per request, not one per caller.
 */
export const getClaims = cache(async () => {
  const supabase = await createClient();

  // getClaims() returns a THREE-way union, and the third branch is
  // { data: null, error: null } — signed out, with no error. `if (error)` does
  // not narrow `data`, so the check has to be on `data` itself. This project
  // uses asymmetric signing keys, so verification is local with no network hop.
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  return data.claims;
});

/** The signed-in auth user's id, or null. Note: `sub`, not `user.id`. */
export const getAuthUserId = cache(async () => {
  const claims = await getClaims();
  return typeof claims?.sub === "string" ? claims.sub : null;
});

/** Use in a layout or Server Action that must not run for a signed-out caller. */
export const requireAuth = cache(async () => {
  const claims = await getClaims();
  if (!claims) redirect("/auth/v1/login");
  return claims;
});

/**
 * The signed-in staff member, joined through staff.auth_user_id.
 *
 * Returns null when the caller is authenticated but has no staff row yet —
 * a real state, not an error: staff rows pre-exist their auth users and are
 * claimed on first login. Callers decide whether that means "onboard me" or
 * "you do not belong here".
 */
export const getCurrentStaff = cache(async () => {
  const authUserId = await getAuthUserId();
  if (!authUserId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, code:id, full_name, work_email, team, status, avatar_url, role_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) return null;
  return data;
});
