"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentStaff, requireAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Staff mutations for Settings. Invite, edit, role change, and status change
 * all run through the SECURITY DEFINER admin_* RPCs, each of which re-checks
 * has_perm('users', true), keeps the target inside the caller's own company,
 * refuses self role/status changes, and refuses to leave the company without
 * an active Owner. Profile edits are the one direct write: the column grant on
 * staff(full_name, avatar_url) plus the self branch of staff_update let anyone
 * fix their own name and photo.
 *
 * Actions return { error } rather than throwing: a denial or a validation
 * failure is an outcome the form must show, not a crash.
 */

export type StaffActionResult = { error: string } | { error?: undefined };

const SETTINGS_PATH = "/dashboard/settings";

export const STAFF_TEAMS = [
  "Dispatch",
  "Sales",
  "Warehouse",
  "Fleet & Maintenance",
  "Customer Service",
  "Billing",
  "HR & Admin",
  "Leadership",
] as const;

export const STAFF_STATUSES = ["Active", "Pending invite", "Deactivated", "Locked", "Suspended"] as const;

type DbError = { code?: string; message: string };

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Map an RPC SQLSTATE to copy a person can act on. */
function friendly(error: DbError, fallback: string): string {
  switch (error.code) {
    case "28000":
      return "Your session has expired. Sign in again.";
    case "42501":
      return /your own/i.test(error.message) ? `${capitalize(error.message.replace(/\.$/, ""))}.` : fallback;
    case "23514":
      return "The company must keep at least one active Owner.";
    case "23505":
      return "A staff member with that email already exists.";
    case "22023":
      return capitalize(error.message.replace(/\.$/, ""));
    default:
      return error.message;
  }
}

const inviteSchema = z.object({
  fullName: z.string().trim().min(1, "Enter a name."),
  email: z.email("Enter a valid email."),
  roleSlug: z.string().trim().min(1, "Choose a role."),
  team: z.enum(STAFF_TEAMS),
});

export async function inviteStaff(input: z.infer<typeof inviteSchema>): Promise<StaffActionResult> {
  await requireAuth();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_invite_staff", {
    p_full_name: parsed.data.fullName,
    p_work_email: parsed.data.email,
    p_role_slug: parsed.data.roleSlug,
    p_team: parsed.data.team,
  });
  if (error) return { error: friendly(error, "You do not have permission to add staff.") };

  revalidatePath(SETTINGS_PATH);
  return {};
}

const updateSchema = z.object({
  staffId: z.uuid(),
  fullName: z.string().trim().min(1, "Enter a name.").optional(),
  email: z.email("Enter a valid email.").optional(),
  team: z.enum(STAFF_TEAMS).optional(),
});

export async function updateStaff(input: z.infer<typeof updateSchema>): Promise<StaffActionResult> {
  await requireAuth();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_staff", {
    p_staff_id: parsed.data.staffId,
    p_full_name: parsed.data.fullName,
    p_work_email: parsed.data.email,
    p_team: parsed.data.team,
  });
  if (error) return { error: friendly(error, "You do not have permission to edit staff.") };

  revalidatePath(SETTINGS_PATH);
  return {};
}

const roleSchema = z.object({ staffId: z.uuid(), roleSlug: z.string().trim().min(1, "Choose a role.") });

export async function setStaffRole(input: z.infer<typeof roleSchema>): Promise<StaffActionResult> {
  await requireAuth();
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_staff_role", {
    p_staff_id: parsed.data.staffId,
    p_role_slug: parsed.data.roleSlug,
  });
  if (error) return { error: friendly(error, "You do not have permission to change roles.") };

  revalidatePath(SETTINGS_PATH);
  return {};
}

const statusSchema = z.object({ staffId: z.uuid(), status: z.enum(STAFF_STATUSES) });

export async function setStaffStatus(input: z.infer<typeof statusSchema>): Promise<StaffActionResult> {
  await requireAuth();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_staff_status", {
    p_staff_id: parsed.data.staffId,
    p_status: parsed.data.status,
  });
  if (error) return { error: friendly(error, "You do not have permission to change status.") };

  revalidatePath(SETTINGS_PATH);
  return {};
}

const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name."),
  // Empty clears the photo; the column stores NULL, never an empty string.
  avatarUrl: z.union([z.url("Enter a valid image URL."), z.literal("")]),
});

export async function updateOwnProfile(input: z.infer<typeof profileSchema>): Promise<StaffActionResult> {
  await requireAuth();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const staff = await getCurrentStaff();
  if (!staff) return { error: "Your staff record could not be found." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({ full_name: parsed.data.fullName, avatar_url: parsed.data.avatarUrl || null })
    .eq("id", staff.id);
  if (error) return { error: friendly(error, "Could not save your profile.") };

  revalidatePath(SETTINGS_PATH);
  return {};
}
