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
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <Sidebar
          title={title}
          items={items}
          isOpen={isSidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex min-h-screen flex-1 flex-col">
          <TopNavbar
            sectionTitle={title}
            userEmail={userEmail}
            onMenuClick={() => setSidebarOpen(true)}
            onSignOut={signOut}
          />
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
