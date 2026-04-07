"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarProps {
  title: string;
  items: NavItem[];
  isOpen: boolean;
  onClose: () => void;
}

function SidebarContent({ title, items, onClose }: Omit<SidebarProps, "isOpen">): React.JSX.Element {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Workspace</p>
          <h2 className="mt-1 text-lg font-bold text-foreground">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group inline-flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              onClick={onClose}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar({ title, items, isOpen, onClose }: SidebarProps): React.JSX.Element {
  return (
    <>
      <aside className="hidden border-r border-border bg-card/80 backdrop-blur md:block md:w-72">
        <SidebarContent title={title} items={items} onClose={onClose} />
      </aside>

      <div className={cn("fixed inset-0 z-50 md:hidden", isOpen ? "block" : "hidden")}>
        <button
          type="button"
          className="absolute inset-0 bg-black/45"
          onClick={onClose}
          aria-label="Close navigation backdrop"
        />
        <aside className="relative h-full w-72 border-r border-border bg-card">
          <SidebarContent title={title} items={items} onClose={onClose} />
        </aside>
      </div>
    </>
  );
}
