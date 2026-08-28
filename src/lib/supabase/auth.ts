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
 *
 * 0015 dropped `staff_auth_user_id_key`, so "one row per auth user" is now
 * an RLS-derived guarantee rather than a structural one. `.maybeSingle()`
 * returns { data: null, error: null } for zero rows — legitimate, "not
 * staff anywhere" — but a real query error (including PGRST116 for an
 * unexpected multi-row match) must not be folded into that same silent
 * null. This repo names silent-zero-rows as its hardest symptom to
 * diagnose, so an actual error is logged with enough detail to identify it.
 */
export const getCurrentStaff = cache(async () => {
  const authUserId = await getAuthUserId();
  if (!authUserId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select(
      "id, code:id, full_name, work_email, team, status, avatar_url, role_id, company_id, role:staff_role_id_fkey ( name, access_level )",
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    console.error("getCurrentStaff: staff lookup failed", {
      authUserId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }
  if (!data) return null;

  // PostgREST types a to-one embed as object-or-array; normalise once here.
  const role = Array.isArray(data.role) ? (data.role[0] ?? null) : data.role;
  return { ...data, role };
});

export type CompanyState = {
  state: "ok" | "revoked-selection" | "no-membership";
  company_id: string | null;
  company_name: string | null;
};

/**
 * The signed-in staff member's resolved company, from
 * public.current_company_state() (0012, folded to a single evaluation of
 * app.current_company_id() per call in 0023). Membership is revalidated
 * against `staff.status = 'Active'` on every call rather than read off a
 * JWT claim, so a revoked membership is denied immediately, not at token
 * expiry.
 *
 * `state` is load-bearing: `'revoked-selection'` means the caller's
 * selected company no longer has them as Active staff and must never
 * silently fall through to some other tenant; `'no-membership'` means
 * they are not staff anywhere. Callers must route both non-'ok' states to
 * /unauthorized rather than rendering a blank dashboard.
 *
 * The function always returns exactly one row, so unlike
 * getCurrentStaff()'s `.maybeSingle()` above, there is no legitimate empty
 * case here for `.single()` to hide — any error is a real failure and is
 * logged rather than folded into a silent null. The generated RPC return
 * type marks company_id/company_name as non-null, which is wrong for the
 * revoked-selection and no-membership states; the cast below corrects it
 * to what the SQL function actually returns.
 */
export const getCurrentCompany = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_company_state").single();

  if (error) {
    console.error("getCurrentCompany: current_company_state failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }
  if (!data) return null;

  return data as CompanyState;
});
