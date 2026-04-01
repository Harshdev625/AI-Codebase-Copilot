"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import Sidebar from "./sidebar";
import ThemeToggle from "@/components/theme-toggle";
import { getStoredUser, getToken, validateSessionAndRefreshUser } from "@/lib/auth";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/repositories": "Repositories",
  "/chat":         "AI Chat",
  "/admin/dashboard": "Admin",
  "/admin":        "Admin",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/admin/login" ||
    pathname === "/admin/register" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/register/");
  const isAdminPath = pathname.startsWith("/admin") && pathname !== "/admin/login" && pathname !== "/admin/register";
  const [authorized, setAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const validateSession = async () => {
      const token = getToken();
      const user = getStoredUser();
      if (!token || !user) {
        if (isMounted) {
          setAuthorized(false);
          setCheckingSession(false);
          router.replace("/login");
        }
        return;
      }

      const refreshedUser = await validateSessionAndRefreshUser();
      if (!isMounted) return;
      if (!refreshedUser) {
        setAuthorized(false);
        setCheckingSession(false);
        return;
      }

      if (isAdminPath && refreshedUser.role !== "ADMIN") {
        setAuthorized(false);
        setCheckingSession(false);
        router.replace("/dashboard");
        return;
      }

      setAuthorized(true);
      setCheckingSession(false);
    };

    if (isPublic) {
      setAuthorized(true);
      setCheckingSession(false);
      return;
    }

    setAuthorized(false);
    setCheckingSession(true);

    validateSession().catch(() => {
      if (isMounted) {
        setAuthorized(false);
        setCheckingSession(false);
      }
    });

    const interval = window.setInterval(() => {
      validateSession().catch(() => null);
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [isPublic, isAdminPath, router, pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isPublic) {
    return (
      <>
        <div className="fixed right-4 top-4 z-40">
          <ThemeToggle compact />
        </div>
        {children}
      </>
    );
  }

  if (!authorized) {
    if (!checkingSession) {
      return null;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          Verifying session...
        </div>
      </div>
    );
  }

  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k))?.[1] ?? "";

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden border-r border-border md:block">
        <Sidebar />
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 h-full">
            <Sidebar className="w-80 max-w-[85vw]" onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface2 text-muted md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="text-sm font-semibold text-text sm:text-base">{title || "Workspace"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <span className="badge badge-cyan">v0.1.0</span>
            <button
              className="hidden h-8 w-8 items-center justify-center rounded-md border border-border bg-surface2 text-muted sm:inline-flex md:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
