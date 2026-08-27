"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthActionState = { error: string } | null;

/**
 * Password sign-in.
 *
 * `redirect()` throws by design — it signals control flow with a thrown value —
 * so it must stay outside any try/catch, or the catch swallows it and the
 * redirect silently does nothing.
 *
 * The error message is deliberately identical for "no such account" and "wrong
 * password". Distinguishing them turns the login form into an account-existence
 * oracle.
 */
export async function signIn(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  // Claim the pre-existing staff row for this auth user. Staff rows are seeded
  // and pre-date their auth users, so this runs on login rather than as an
  // after-insert trigger on auth.users — a trigger there runs inside the signup
  // transaction, where any failure surfaces as an opaque 500 that reads like a
  // Supabase outage instead of our own bug.
  const { error: claimError } = await supabase.rpc("claim_staff_for_current_user");
  if (claimError) {
    await supabase.auth.signOut();
    return { error: "This account is not linked to a staff record. Contact an administrator." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard/default");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/auth/v1/login");
}
