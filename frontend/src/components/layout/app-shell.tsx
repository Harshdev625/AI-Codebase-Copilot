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
  variant?: "default" | "fullBleed";
}

export function AppShell({ title, children, variant = "default" }: AppShellProps): React.JSX.Element {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const signOut = React.useCallback(() => {
    logout();
    router.push("/login");
  }, [logout, router]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background transition-colors duration-300">
      {/* Animated background gradient orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -right-1/4 -top-1/4 h-96 md:h-[520px] lg:h-[720px] w-96 md:w-[520px] lg:w-[720px] rounded-full bg-primary/8 blur-[90px] md:blur-[130px] lg:blur-[160px] transition-all duration-300" />
        <div className="absolute -left-1/4 bottom-0 h-80 md:h-[420px] lg:h-[520px] w-80 md:w-[420px] lg:w-[520px] rounded-full bg-[hsl(var(--glow)/0.1)] blur-[90px] md:blur-[120px] lg:blur-[140px] transition-all duration-300" />
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* Top Navigation */}
        <TopNavbar sectionTitle={title} userEmail={user?.email} onSignOut={signOut} />

        {/* Page content */}
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
