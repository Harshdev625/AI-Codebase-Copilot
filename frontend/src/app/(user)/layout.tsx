"use client";

import { Bot, FolderGit2, LayoutDashboard } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";

const userNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Repositories", href: "/repositories", icon: FolderGit2 },
  { label: "Chat", href: "/chat", icon: Bot },
];

export default function UserLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <AppShell title="User Workspace" items={userNavItems}>
      {children}
    </AppShell>
  );
}
