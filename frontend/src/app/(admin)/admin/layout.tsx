"use client";

import { usePathname } from "next/navigation";
import { FolderKanban, Gauge, Network, Shield, Users } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";

const adminNavItems = [
  { label: "Admin Dashboard", href: "/admin/dashboard", icon: Shield },
  { label: "AI Telemetry", href: "/admin/telemetry", icon: Gauge },
  { label: "Graph Explorer", href: "/admin/architecture", icon: Network },
  { label: "Manage Users", href: "/admin/users", icon: Users },
  { label: "Manage Repositories", href: "/admin/repositories", icon: FolderKanban },
];

export default function AdminLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const isAdminAuthPage = pathname === "/admin/login" || pathname === "/admin/register";

  if (isAdminAuthPage) {
    return <>{children}</>;
  }

  return (
    <AppShell title="Admin Workspace" items={adminNavItems}>
      {children}
    </AppShell>
  );
}
