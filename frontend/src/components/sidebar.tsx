"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getStoredUser, isAdmin } from "@/lib/auth";

export default function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const user = getStoredUser();

  const items = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Repositories", href: "/repositories" },
    { label: "Chat", href: "/chat" },
    ...(isAdmin(user?.role) ? [{ label: "Admin", href: "/admin" }] : []),
  ];

  const userName = user?.full_name || user?.email?.split("@")[0] || "User";

  return (
    <aside>
      <div>{userName}</div>
      <nav>
        {items.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
