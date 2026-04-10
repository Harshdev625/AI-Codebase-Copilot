"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, X, Command, Search, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/ui/command-palette";
import { useAuthStore } from "@/store/auth-store";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
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
  const { user } = useAuthStore();
  const [commandOpen, setCommandOpen] = React.useState(false);

  // Global ⌘K handler
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const userInitial = user?.full_name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "U";
  const userName = user?.full_name ?? user?.email?.split("@")[0] ?? "User";

  return (
    <>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />

      <div className="flex h-full flex-col bg-card/60 backdrop-blur-xl border-r border-border/40">
        {/* Brand area */}
        <div className={cn("flex h-16 items-center px-4 shrink-0", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-lg shadow-primary/30">
                <Command className="h-4 w-4" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-bold tracking-tight leading-none text-foreground">{title}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-primary/70 mt-0.5">Intelligence</span>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-lg shadow-primary/30">
              <Command className="h-4 w-4" />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapsed}
            className={cn(
              "shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground",
              collapsed && "mt-0"
            )}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Search / ⌘K */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <button
              onClick={() => setCommandOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground hover:border-border/60"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left">Quick Search...</span>
              <kbd className="rounded-md bg-background/60 border border-border/40 px-1.5 py-0.5 text-[9px] font-bold hidden md:block">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {collapsed && (
          <div className="flex justify-center pb-2">
            <Tooltip content="Quick Search ⌘K" side="right">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCommandOpen(true)}
                className="text-muted-foreground"
              >
                <Search className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        )}

        {/* Nav label */}
        {!collapsed && (
          <div className="px-6 pb-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Menu</span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center h-10 rounded-xl px-3 text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center" : "gap-3",
                  active
                    ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:shadow-inner"
                )}
                onClick={(e) => {
                  // Ensure navigation happens before drawer close on mobile
                  if (onClose) {
                    setTimeout(onClose, 50);
                  }
                }}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-110",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />

                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex-1 truncate"
                  >
                    {item.label}
                  </motion.span>
                )}

                {!collapsed && item.badge && (
                  <span className="rounded-full bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 border border-primary/20">
                    {item.badge}
                  </span>
                )}

                {active && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute left-0 h-5 w-0.5 rounded-r-full bg-primary"
                  />
                )}
              </Link>
            );

            return collapsed ? (
              <Tooltip key={item.href} content={item.label} side="right">
                {linkContent}
              </Tooltip>
            ) : (
              linkContent
            );
          })}
        </nav>

        {/* Footer: User Profile */}
        <div className="shrink-0 p-3 border-t border-border/30">
          {!collapsed ? (
            <div className="flex items-center gap-3 rounded-xl bg-muted/20 p-2.5 hover:bg-muted/40 transition-all cursor-pointer border border-transparent hover:border-border/40 group">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary border border-primary/20 shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                {userInitial}
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="text-[11px] font-bold truncate leading-tight">{userName}</span>
                <span className="text-[9px] text-primary/60 font-bold uppercase tracking-wider">
                  Pro Workspace
                </span>
              </div>
            </div>
          ) : (
            <Tooltip content={userName} side="right">
              <div className="flex justify-center">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary border border-primary/20 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all">
                  {userInitial}
                </div>
              </div>
            </Tooltip>
          )}
        </div>
      </div>
    </>
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
          "hidden border-r border-border/40 bg-card/60 transition-all duration-300 ease-in-out md:block overflow-hidden shrink-0",
          collapsed ? "md:w-[68px]" : "md:w-64"
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

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative h-full w-72 shadow-2xl"
            >
              <SidebarContent
                title={title}
                items={items}
                collapsed={false}
                onToggleCollapsed={onToggleCollapsed}
                onClose={onClose}
              />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
