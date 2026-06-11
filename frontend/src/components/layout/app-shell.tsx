"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TopNavbar } from "@/components/layout/top-navbar";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

interface AppShellProps {
  title: string;
  children: React.ReactNode;
  /** fullBleed — no padding wrapper, used for Chat full-viewport layout */
  variant?: "default" | "fullBleed" | "workspace";
}

export function AppShell({ title, children, variant = "default" }: AppShellProps): React.JSX.Element {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const signOut = React.useCallback(() => {
    logout();
    router.push("/login");
  }, [logout, router]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background transition-colors duration-300">
      {/* Animated background gradient orbs - modern mix-blend-screen effect */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden mix-blend-screen dark:mix-blend-normal opacity-70 dark:opacity-100">
        <div className="absolute -right-1/4 -top-1/4 h-[400px] md:h-[600px] lg:h-[800px] w-[400px] md:w-[600px] lg:w-[800px] rounded-full bg-primary/10 blur-[90px] md:blur-[130px] lg:blur-[180px] transition-all duration-1000 ease-in-out" />
        <div className="absolute -left-1/4 bottom-0 h-[300px] md:h-[500px] lg:h-[600px] w-[300px] md:w-[500px] lg:w-[600px] rounded-full bg-[hsl(var(--cyan)/0.12)] blur-[90px] md:blur-[120px] lg:blur-[150px] transition-all duration-1000 ease-in-out" />
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* Top Navigation */}
        {variant !== "workspace" && <TopNavbar sectionTitle={title} userEmail={user?.email} onSignOut={signOut} />}

        {/* Page content */}
        <main className={cn("flex-1 overflow-auto scroll-smooth custom-scrollbar", variant === "default" && "p-0")}>
          {variant === "default" ? (
            <div className="flex min-h-full flex-col p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
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
