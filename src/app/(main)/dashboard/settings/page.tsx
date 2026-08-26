import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ProfilePanel } from "./_components/profile/profile-panel";
import { RolesPanel } from "./_components/roles/roles-panel";
import { roles } from "./_components/roles/roles-table/data";
import { users } from "./_components/users/data";
import { UsersPanel } from "./_components/users/users-panel";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-heading font-semibold text-xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Your profile, staff accounts, and roles.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList variant="line">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent className="pt-4" value="profile">
          <ProfilePanel />
        </TabsContent>

        <TabsContent className="pt-4" value="users">
          <UsersPanel users={users} />
        </TabsContent>

        <TabsContent className="pt-4" value="roles">
          <RolesPanel roles={roles} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
