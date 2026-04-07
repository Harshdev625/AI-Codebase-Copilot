"use client";

import { FolderKanban, Shield, Users } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";

const adminNavItems = [
  { label: "Admin Dashboard", href: "/admin/dashboard", icon: Shield },
  { label: "Manage Users", href: "/admin/users", icon: Users },
  { label: "Manage Repositories", href: "/admin/repositories", icon: FolderKanban },
];

export default function AdminLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <AppShell title="Admin Workspace" items={adminNavItems}>
      {children}
    </AppShell>
  );
}
