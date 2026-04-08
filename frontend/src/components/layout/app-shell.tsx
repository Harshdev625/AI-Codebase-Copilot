"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { TopNavbar } from "@/components/layout/top-navbar";
import { clearAuthSession, getStoredUser } from "@/lib/auth";

interface AppShellProps {
  title: string;
  items: NavItem[];
  children: React.ReactNode;
}

export function AppShell({ title, items, children }: AppShellProps): React.JSX.Element {
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    setUserEmail(getStoredUser()?.email);
  }, []);

  const signOut = React.useCallback(() => {
    clearAuthSession();
    router.push("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen bg-background transition-ui">
      <Sidebar
        title={title}
        items={items}
        isOpen={isSidebarOpen}
        collapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((previous) => !previous)}
        onClose={() => setSidebarOpen(false)}
      />
      
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopNavbar
          sectionTitle={title}
          userEmail={userEmail}
          onMenuClick={() => setSidebarOpen(true)}
          onSidebarToggle={() => setSidebarCollapsed((previous) => !previous)}
          isSidebarCollapsed={isSidebarCollapsed}
          onSignOut={signOut}
        />
        
        <main className="flex-1 overflow-hidden animate-in fade-in duration-500">
          <div className="flex h-full flex-col overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
