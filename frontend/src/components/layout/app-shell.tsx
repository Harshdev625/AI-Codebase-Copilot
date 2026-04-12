"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { TopNavbar } from "@/components/layout/top-navbar";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

interface AppShellProps {
  title: string;
  items: NavItem[];
  children: React.ReactNode;
  /** fullBleed — no padding wrapper, used for Chat full-viewport layout */
  variant?: "default" | "fullBleed";
}

export function AppShell({ title, items, children, variant = "default" }: AppShellProps): React.JSX.Element {
  const [mounted, setMounted] = React.useState(false);
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const { user, logout } = useAuthStore();
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => { setMounted(true); }, []);
  React.useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const signOut = React.useCallback(() => {
    logout();
    router.push("/login");
  }, [logout, router]);

  const isHackerMode = mounted && theme === "hacker";

  return (
    <div className={cn(
      "flex h-screen w-full overflow-hidden bg-[hsl(240,18%,4%)] transition-colors duration-300",
      isHackerMode && "font-mono"
    )}>
      {/* Hacker Mode CRT scanline overlay */}
      {isHackerMode && (
        <div className="pointer-events-none fixed inset-0 z-[100] opacity-[0.03] overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
        </div>
      )}

      {/* Global ambient glow - desktop only */}
      {!isHackerMode && (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute -right-1/4 -top-1/4 h-[700px] w-[700px] rounded-full bg-violet-500/4 blur-[150px]" />
          <div className="absolute -left-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-indigo-500/3 blur-[120px]" />
        </div>
      )}

      <Sidebar
        title="AI Copilot"
        items={items}
        isOpen={isSidebarOpen}
        collapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <TopNavbar
          sectionTitle={title}
          userEmail={user?.email}
          onMenuClick={() => setSidebarOpen(true)}
          onSidebarToggle={() => setSidebarCollapsed((prev) => !prev)}
          isSidebarCollapsed={isSidebarCollapsed}
          onSignOut={signOut}
        />

        <main className={cn("flex-1 overflow-auto scroll-smooth", variant === "default" && "p-0")}>
          {variant === "default" ? (
            <div className="flex min-h-full flex-col p-6 md:p-8 max-w-7xl mx-auto w-full">
              {children}
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
