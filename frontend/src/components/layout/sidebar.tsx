"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, X, Command, Search, Cpu } from "lucide-react";
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

/* ── Inner content (shared between desktop & mobile drawer) ── */
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

  /* Global ⌘K handler */
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
  const userName    = user?.full_name ?? user?.email?.split("@")[0] ?? "User";

  return (
    <>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />

      {/* ── Sidebar shell ─────────────────────────────────── */}
      <div className="scan-line-container relative flex h-full flex-col bg-card border-r border-border overflow-hidden">

        {/* Background mesh */}
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-15" />

        {/* Glow behind logo */}
        <div className="pointer-events-none absolute left-1/2 top-8 h-32 w-32 -translate-x-1/2 rounded-full bg-primary/15 blur-[40px] animate-glow-pulse" />

        {/* ── Brand ─────────────────────────────────────── */}
        <div className={cn("relative z-10 flex h-16 items-center px-4 shrink-0", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 shadow-glow-sm">
                <Command className="h-4 w-4 text-foreground" />
                <div className="absolute inset-0 rounded-xl bg-primary/20 opacity-50 blur-md -z-10" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm sm:text-[13px] font-bold tracking-tight leading-none text-foreground">{title}</span>
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-primary/60 mt-0.5">Studio</span>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 shadow-glow-sm">
              <Command className="h-4 w-4 text-foreground" />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapsed}
            className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* ── Search / ⌘K ─────────────────────────────────── */}
        {!collapsed ? (
          <div className="relative z-10 px-3 pb-3">
            <button
              onClick={() => setCommandOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-border/50 bg-input px-3 py-2 text-xs text-muted-foreground transition-all hover:bg-muted hover:text-foreground hover:border-primary/30 group"
            >
              <Search className="h-4 w-4 shrink-0 group-hover:text-primary transition-colors" />
              <span className="flex-1 text-left">Quick Search…</span>
              <kbd className="rounded-md bg-background border border-border px-1.5 py-0.5 text-[9px] font-bold hidden md:block">⌘K</kbd>
            </button>
          </div>
        ) : (
          <div className="relative z-10 flex justify-center pb-3">
            <Tooltip content="Quick Search ⌘K" side="right">
              <Button variant="ghost" size="icon-sm" onClick={() => setCommandOpen(true)} className="text-muted-foreground hover:text-foreground hover:bg-accent">
                <Search className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        )}

        {/* ── Section label ─────────────────────────────── */}
        {!collapsed && (
          <div className="relative z-10 px-5 pb-2">
            <span className="text-[8px] font-bold uppercase tracking-[0.35em] text-muted-foreground">Navigation</span>
          </div>
        )}

        {/* ── Nav items ─────────────────────────────────── */}
        <nav className="relative z-10 flex flex-1 flex-col gap-0.5 px-2.5 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            const inner = (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { if (onClose) setTimeout(onClose, 50); }}
                className={cn(
                  "group relative flex items-center h-10 rounded-xl px-3 text-sm sm:text-[13px] font-medium transition-all duration-200",
                  collapsed ? "justify-center" : "gap-3",
                  active
                    ? "bg-primary/12 text-primary shadow-[inset_0_0_0_1px] shadow-primary/15"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {/* Active left bar */}
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute left-0 h-6 w-0.5 rounded-r-full bg-primary shadow-[0_0_8px_2px] shadow-primary/60"
                  />
                )}

                <Icon
                  className={cn(
                    "h-5 w-5 sm:h-4 sm:w-4 shrink-0 transition-all duration-200",
                    active
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground group-hover:scale-110"
                  )}
                />

                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex-1 truncate"
                  >
                    {item.label}
                  </motion.span>
                )}

                {!collapsed && item.badge && (
                  <span className="rounded-full bg-primary/15 text-primary text-[8px] font-bold px-1.5 py-0.5 border border-primary/25">
                    {item.badge}
                  </span>
                )}
              </Link>
            );

            return collapsed
              ? <Tooltip key={item.href} content={item.label} side="right">{inner}</Tooltip>
              : inner;
          })}
        </nav>

        {/* ── AI Status strip ─────────────────────────────── */}
        {!collapsed && (
          <div className="relative z-10 mx-3 mb-2 flex items-center gap-2 rounded-xl border border-primary/12 bg-primary/4 px-3 py-2">
            <div className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </div>
            <Cpu className="h-4 w-4 text-primary/60" />
            <span className="text-[9px] font-bold text-primary/60 uppercase tracking-widest">AI Engine Online</span>
          </div>
        )}

        {/* ── User profile footer ──────────────────────────── */}
        <div className="relative z-10 shrink-0 p-2.5 border-t border-border">
          {!collapsed ? (
            <div className="flex items-center gap-3 rounded-xl bg-accent/50 p-2.5 hover:bg-accent transition-all cursor-pointer border border-transparent hover:border-border group">
              <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary border border-primary/30 shrink-0 group-hover:bg-primary/30 transition-all">
                {userInitial}
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="text-[11px] font-bold truncate leading-tight text-foreground">{userName}</span>
                <span className="text-[8px] text-primary/60 font-bold uppercase tracking-wider">Developer</span>
              </div>
            </div>
          ) : (
            <Tooltip content={userName} side="right">
              <div className="flex justify-center">
                <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary border border-primary/30 cursor-pointer hover:bg-primary/30 transition-all">
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

/* ── Exported Sidebar wrapper ─────────────────────────────── */
export function Sidebar({ title, items, isOpen, collapsed, onToggleCollapsed, onClose }: SidebarProps): React.JSX.Element {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden border-r border-border transition-all duration-300 ease-in-out md:block overflow-hidden shrink-0",
          collapsed ? "md:w-[64px]" : "md:w-60"
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

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="relative h-full w-64 shadow-2xl"
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
                className="absolute right-3 top-3 h-8 w-8 rounded-xl bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground"
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
