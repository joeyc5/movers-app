import "server-only";

import { cache } from "react";

import { getCurrentStaff } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Settings data access: the company's staff and its roles.
 *
 * Reads are broad (any active staff member sees the directory and the role
 * catalog). Writes live in staff-actions.ts and run through the audited
 * SECURITY DEFINER RPCs; RLS is the real gate. The UI hides the write
 * affordances a caller's role cannot use, computed once in
 * getCurrentStaffAccess().
 */

export type StaffMember = {
  id: string;
  fullName: string;
  workEmail: string;
  team: string;
  status: string;
  avatarUrl: string | null;
  roleName: string;
  roleSlug: string;
  accessLevel: string;
  joinedAt: string;
  lastActiveAt: string | null;
};

type RoleRef = { name: string; slug: string; access_level: string };
type RoleEmbed = RoleRef | RoleRef[] | null;

interface StaffRow {
  id: string;
  full_name: string;
  work_email: string;
  team: string;
  status: string;
  avatar_url: string | null;
  joined_at: string;
  last_active_at: string | null;
  role: RoleEmbed;
}

/** PostgREST types a to-one embed as object-or-array; normalise once. */
function role(ref: RoleEmbed): RoleRef {
  const value = Array.isArray(ref) ? (ref[0] ?? null) : ref;
  return value ?? { name: "", slug: "", access_level: "Read only" };
}

const STAFF_COLUMNS = `
  id, full_name, work_email, team, status, avatar_url, joined_at, last_active_at,
  role:staff_role_id_fkey ( name, slug, access_level )
`;

export const getStaffMembers = cache(async (): Promise<StaffMember[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("staff").select(STAFF_COLUMNS).order("joined_at", { ascending: false });

  if (error) throw new Error(`Failed to load staff: ${error.message}`);

  return (data as unknown as StaffRow[]).map((row) => {
    const r = role(row.role);
    return {
      id: row.id,
      fullName: row.full_name,
      workEmail: row.work_email,
      team: row.team,
      status: row.status,
      avatarUrl: row.avatar_url,
      roleName: r.name,
      roleSlug: r.slug,
      accessLevel: r.access_level,
      joinedAt: row.joined_at,
      lastActiveAt: row.last_active_at,
    };
  });
});

export type RoleSummary = {
  id: string;
  name: string;
  slug: string;
  accessLevel: string;
  isSystem: boolean;
  status: string;
  ownerName: string | null;
  staffCount: number;
  permissionSetNames: string[];
  lastReviewedOn: string | null;
};

export const getRoleSummaries = cache(async (): Promise<RoleSummary[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles_expanded")
    .select(
      "id, name, slug, access_level, is_system, status, owner_name, staff_count, permission_set_names, last_reviewed_on",
    )
    .order("access_level", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load roles: ${error.message}`);

  return (data ?? [])
    .filter((row): row is typeof row & { id: string; slug: string; name: string } =>
      Boolean(row.id && row.slug && row.name),
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      accessLevel: row.access_level ?? "Read only",
      isSystem: row.is_system ?? false,
      status: row.status ?? "Active",
      ownerName: row.owner_name,
      staffCount: row.staff_count ?? 0,
      permissionSetNames: row.permission_set_names ?? [],
      lastReviewedOn: row.last_reviewed_on,
    }));
});

export type StaffAccess = {
  staffId: string;
  accessLevel: string;
  canWrite: boolean;
  canManageUsers: boolean;
  canEditSettings: boolean;
};

/**
 * What the signed-in staff member is allowed to do in Settings, resolved the
 * same way the RLS gate does: access_level 'Full' satisfies every permission
 * set (an Owner or Admin), otherwise the role must hold the specific set. A
 * 'Read only' role can write nothing. This only decides which controls render;
 * the database re-checks every write regardless.
 */
export const getCurrentStaffAccess = cache(async (): Promise<StaffAccess | null> => {
  const staff = await getCurrentStaff();
  if (!staff) return null;

  const accessLevel = staff.role?.access_level ?? "Read only";
  const isFull = accessLevel === "Full";
  const canWrite = accessLevel !== "Read only";

  let slugs: string[] = [];
  if (canWrite && !isFull) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("roles_expanded")
      .select("permission_set_slugs")
      .eq("id", staff.role_id)
      .maybeSingle();
    slugs = data?.permission_set_slugs ?? [];
  }

  return {
    staffId: staff.id,
    accessLevel,
    canWrite,
    canManageUsers: canWrite && (isFull || slugs.includes("users")),
    canEditSettings: canWrite && (isFull || slugs.includes("settings")),
  };
});
