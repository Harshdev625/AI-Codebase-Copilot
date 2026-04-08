"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, X, Command } from "lucide-react";

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
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void;
}

function SidebarContent({
  title,
  items,
  collapsed,
  onToggleCollapsed,
  onClose,
}: Omit<SidebarProps, "isOpen">): React.JSX.Element {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      {/* Brand / Logo Area */}
      <div className={cn("flex items-center px-2", collapsed ? "justify-center" : "justify-between")}>
        <div className={cn("flex items-center gap-2 overflow-hidden", collapsed && "hidden")}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Command className="h-5 w-5" />
          </div>
          <span className="text-sm font-bold tracking-tight text-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden rounded-md p-1.5 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center rounded-md px-3 py-2 text-sm font-medium transition-ui",
                collapsed ? "justify-center" : "gap-3",
                active
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
              onClick={onClose}
            >
              <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", active ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("truncate", collapsed && "hidden")}>{item.label}</span>
              {active && !collapsed && (
                <div className="absolute left-0 h-4 w-1 rounded-r-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom hint or User area can go here */}
      {!collapsed && (
        <div className="rounded-lg border border-border/50 bg-accent/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground/70 mb-1">Pro Tip</p>
          Press <kbd className="rounded border bg-background px-1 py-0.5 text-[9px]">⌘</kbd> + <kbd className="rounded border bg-background px-1 py-0.5 text-[9px]">K</kbd> to quickly search your codebase.
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  title,
  items,
  isOpen,
  collapsed,
  onToggleCollapsed,
  onClose,
}: SidebarProps): React.JSX.Element {
  return (
    <>
      <aside
        className={cn(
          "hidden border-r border-border bg-background transition-all duration-300 ease-in-out md:block",
          collapsed ? "md:w-16" : "md:w-64"
        )}
      >
        <SidebarContent
          title={title}
          items={items}
          collapsed={collapsed}
          onToggleCollapsed={onToggleCollapsed}
          onClose={onClose}
        />
      </aside>

      <div className={cn("fixed inset-0 z-50 md:hidden", isOpen ? "block" : "hidden")}>
        <button
          type="button"
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close navigation backdrop"
        />
        <aside className="relative h-full w-64 border-r border-border bg-background shadow-xl">
          <SidebarContent
            title={title}
            items={items}
            collapsed={false}
            onToggleCollapsed={onToggleCollapsed}
            onClose={onClose}
          />
        </aside>
      </div>
    </>
  );
}
