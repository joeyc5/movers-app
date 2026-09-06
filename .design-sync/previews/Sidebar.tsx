import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuBadge,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Calendar, FileText, LayoutDashboard, Truck, Users } from "lucide-react";

export function AppShell() {
  return (
    <SidebarProvider className="border-border h-96 min-h-0 w-full overflow-hidden rounded-md border">
      <Sidebar collapsible="none" className="h-full">
        <SidebarHeader className="px-3 py-2 text-sm font-semibold">Movers CRM</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <LayoutDashboard /> Dashboard
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Users /> Clients
                  </SidebarMenuButton>
                  <SidebarMenuBadge>27</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Truck /> Dispatch
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <FileText /> Invoices
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Calendar /> Calendar
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="text-muted-foreground px-3 py-2 text-xs">
          Dana Ramos — dispatcher
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="p-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <span className="text-sm font-medium">Dashboard</span>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
