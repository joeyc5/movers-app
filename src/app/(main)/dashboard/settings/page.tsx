import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentCompany, getCurrentStaff } from "@/lib/supabase/auth";
import { getCompanyBillingProfile } from "@/server/queries/company";
import { getCurrentStaffAccess, getRoleSummaries, getStaffMembers } from "@/server/queries/staff";

import { CompanyPanel } from "./_components/company/company-panel";
import { ProfilePanel } from "./_components/profile/profile-panel";
import { RolesPanel } from "./_components/roles/roles-panel";
import { UsersPanel } from "./_components/users/users-panel";

export default async function Page() {
  const [staff, roles, access, currentStaff, company, billing] = await Promise.all([
    getStaffMembers(),
    getRoleSummaries(),
    getCurrentStaffAccess(),
    getCurrentStaff(),
    getCurrentCompany(),
    getCompanyBillingProfile(),
  ]);

  const roleOptions = roles.map((role) => ({ slug: role.slug, name: role.name }));
  const canManageUsers = access?.canManageUsers ?? false;
  const canEditSettings = access?.canEditSettings ?? false;
  const isFullAccess = access?.accessLevel === "Full";

  const profile = {
    fullName: currentStaff?.full_name ?? "",
    workEmail: currentStaff?.work_email ?? "",
    roleName: currentStaff?.role?.name ?? "",
    accessLevel: currentStaff?.role?.access_level ?? "Read only",
    team: currentStaff?.team ?? "",
    status: currentStaff?.status ?? "",
    avatarUrl: currentStaff?.avatar_url ?? null,
    companyName: company?.company_name ?? "",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-heading font-semibold text-xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Your profile, staff accounts, roles, and company details.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList variant="line">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
        </TabsList>

        <TabsContent className="pt-4" value="profile">
          <ProfilePanel profile={profile} />
        </TabsContent>

        <TabsContent className="pt-4" value="users">
          <UsersPanel
            staff={staff}
            roleOptions={roleOptions}
            canManageUsers={canManageUsers}
            currentStaffId={access?.staffId ?? null}
          />
        </TabsContent>

        <TabsContent className="pt-4" value="roles">
          <RolesPanel roles={roles} />
        </TabsContent>

        <TabsContent className="pt-4" value="company">
          <CompanyPanel billing={billing} canEdit={canEditSettings} showBanking={isFullAccess} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
