"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requireAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type RegisterState = { error: string } | { status: "check-email"; email: string } | null;
export type CreateCompanyState = { error: string } | null;

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(80, "Keep your name under 80 characters."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});

const createCompanySchema = z.object({
  name: z.string().trim().min(2, "Enter a company name.").max(80, "Keep the name under 80 characters."),
  slug: z
    .string()
    .trim()
    .min(3, "Use 3 to 40 characters.")
    .max(40, "Use 3 to 40 characters.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers, and single hyphens only."),
});

/**
 * The public origin, read from the request rather than an env var so the
 * confirmation link points back at whatever host served the page: the Vercel
 * production domain in production, localhost in dev.
 */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Self-serve registration.
 *
 * `redirect()` throws to signal control flow, so it stays outside any
 * try/catch. When email confirmations are off, signUp returns a session and we
 * send the new owner straight to onboarding. When they are on, no session comes
 * back and the caller shows a "check your email" state instead; the link in
 * that email lands on /auth/callback?next=/onboarding.
 */
export async function registerAccount(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { fullName, email, password } = parsed.data;
  const origin = await requestOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return { error: "We could not create your account. Try again in a moment." };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/onboarding");
  }

  return { status: "check-email", email };
}

const RPC_ERROR_COPY: Record<string, string> = {
  // Signed in but the email is not verified yet.
  "28000": "Confirm your email address first, then create your company.",
  // Already an active member of a company.
  "42501": "This account already belongs to a company.",
  // Name or slug failed the server-side rules.
  "22023": "Check the company name and URL, then try again.",
  // Slug is taken.
  "23505": "That company URL is already taken. Choose another.",
};

/**
 * Provision a tenant for the signed-in owner via signup_create_company, which
 * creates the company, its roles and reference data, and binds this caller as
 * the Active owner in one transaction. On success the caller now resolves to a
 * company, so the dashboard renders.
 */
export async function createCompany(_prev: CreateCompanyState, formData: FormData): Promise<CreateCompanyState> {
  await requireAuth();

  const parsed = createCompanySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("signup_create_company", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });

  if (error) {
    const mapped = error.code && RPC_ERROR_COPY[error.code];
    if (mapped) return { error: mapped };
    console.error("createCompany: signup_create_company failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { error: "We could not create your company. Try again in a moment." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard/default");
}
