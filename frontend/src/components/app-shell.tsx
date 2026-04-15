"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import Sidebar from "@/components/sidebar";
import { getStoredUser, getToken, validateSessionAndRefreshUser } from "@/lib/auth";

export default function AppShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = React.useState(false);

  const publicPaths = ["/login", "/register"];
  const isPublic = publicPaths.some((path) => pathname === path || pathname?.startsWith(`${path}/`));
  const isAdminPath = pathname === "/admin" || pathname?.startsWith("/admin/");

  React.useEffect(() => {
    if (isPublic) {
      setReady(true);
      return;
    }

    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) {
      router.replace("/login");
      return;
    }

    void validateSessionAndRefreshUser()
      .then((refreshedUser) => {
        const effectiveUser = refreshedUser || user;
        if (isAdminPath && String(effectiveUser.role || "").toUpperCase() !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [isAdminPath, isPublic, router]);

  if (isPublic) {
    return <>{children}</>;
  }

  if (!ready) {
    return <></>;
  }

  const titleMap: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/repositories": "Repositories",
    "/chat": "Chat",
    "/admin": "Admin",
  };

  const title = Object.entries(titleMap).find(([prefix]) => pathname?.startsWith(prefix))?.[1] || "Dashboard";

  return (
    <div>
      <Sidebar />
      <main>
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
