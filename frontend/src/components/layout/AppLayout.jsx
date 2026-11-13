import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { DesktopSidebar, MobileSidebarDrawer } from "@/components/layout/Sidebar";
import TopNavbar from "@/components/layout/TopNavbar";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile drawer automatically whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar />
      <MobileSidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <TopNavbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
