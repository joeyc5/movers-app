The app shell's left navigation. Wrap the whole layout in `SidebarProvider`, then place `Sidebar` and `SidebarInset` as siblings inside it.

`SidebarTrigger` toggles collapse and reads state from the provider, so it must be inside it. Mark the current route with `isActive` on its `SidebarMenuButton`.
