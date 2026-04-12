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
      <div className="scan-line-container relative flex h-full flex-col bg-[hsl(240,18%,5%)] border-r border-white/5 overflow-hidden">

        {/* Background mesh */}
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-15" />

        {/* Glow behind logo */}
        <div className="pointer-events-none absolute left-1/2 top-8 h-32 w-32 -translate-x-1/2 rounded-full bg-primary/15 blur-[40px] animate-glow-pulse" />

        {/* ── Brand ─────────────────────────────────────── */}
        <div className={cn("relative z-10 flex h-16 items-center px-4 shrink-0", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-glow-sm">
                <Command className="h-4 w-4 text-white" />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 opacity-50 blur-md -z-10" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[13px] font-bold tracking-tight leading-none text-white/90">{title}</span>
                <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-violet-400/70 mt-0.5">Intelligence</span>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-glow-sm">
              <Command className="h-4 w-4 text-white" />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapsed}
            className="shrink-0 text-zinc-600 hover:text-white hover:bg-white/5"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* ── Search / ⌘K ─────────────────────────────────── */}
        {!collapsed ? (
          <div className="relative z-10 px-3 pb-3">
            <button
              onClick={() => setCommandOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-[11px] text-zinc-500 transition-all hover:bg-white/6 hover:text-zinc-300 hover:border-violet-500/30 group"
            >
              <Search className="h-3.5 w-3.5 shrink-0 group-hover:text-violet-400 transition-colors" />
              <span className="flex-1 text-left">Quick Search…</span>
              <kbd className="rounded-md bg-black/40 border border-white/8 px-1.5 py-0.5 text-[8px] font-bold hidden md:block">⌘K</kbd>
            </button>
          </div>
        ) : (
          <div className="relative z-10 flex justify-center pb-3">
            <Tooltip content="Quick Search ⌘K" side="right">
              <Button variant="ghost" size="icon-sm" onClick={() => setCommandOpen(true)} className="text-zinc-600 hover:text-white hover:bg-white/5">
                <Search className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        )}

        {/* ── Section label ─────────────────────────────── */}
        {!collapsed && (
          <div className="relative z-10 px-5 pb-2">
            <span className="text-[8px] font-bold uppercase tracking-[0.35em] text-zinc-700">Navigation</span>
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
                  "group relative flex items-center h-10 rounded-xl px-3 text-[13px] font-medium transition-all duration-200",
                  collapsed ? "justify-center" : "gap-3",
                  active
                    ? "bg-violet-500/12 text-violet-300 shadow-[inset_0_0_0_1px_hsl(265,80%,65%,0.15)]"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                {/* Active left bar */}
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute left-0 h-6 w-0.5 rounded-r-full bg-gradient-to-b from-violet-400 to-indigo-500 shadow-[0_0_8px_2px_hsl(265,80%,65%,0.6)]"
                  />
                )}

                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-all duration-200",
                    active
                      ? "text-violet-400"
                      : "text-zinc-600 group-hover:text-zinc-300 group-hover:scale-110"
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
                  <span className="rounded-full bg-violet-500/15 text-violet-400 text-[8px] font-bold px-1.5 py-0.5 border border-violet-500/25">
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
          <div className="relative z-10 mx-3 mb-2 flex items-center gap-2 rounded-xl border border-violet-500/12 bg-violet-500/4 px-3 py-2">
            <div className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-400" />
            </div>
            <Cpu className="h-3 w-3 text-violet-500/60" />
            <span className="text-[9px] font-bold text-violet-500/60 uppercase tracking-widest">AI Engine Online</span>
          </div>
        )}

        {/* ── User profile footer ──────────────────────────── */}
        <div className="relative z-10 shrink-0 p-2.5 border-t border-white/5">
          {!collapsed ? (
            <div className="flex items-center gap-3 rounded-xl bg-white/3 p-2.5 hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/8 group">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center text-[11px] font-bold text-violet-300 border border-violet-500/20 shrink-0 group-hover:from-violet-500/30 group-hover:to-indigo-500/30 transition-all">
                {userInitial}
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="text-[11px] font-bold truncate leading-tight text-zinc-300">{userName}</span>
                <span className="text-[8px] text-violet-400/60 font-bold uppercase tracking-wider">Developer</span>
              </div>
            </div>
          ) : (
            <Tooltip content={userName} side="right">
              <div className="flex justify-center">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center text-[11px] font-bold text-violet-300 border border-violet-500/20 cursor-pointer hover:from-violet-500/30 transition-all">
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
          "hidden border-r border-white/5 transition-all duration-300 ease-in-out md:block overflow-hidden shrink-0",
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
                className="absolute right-3 top-3 h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white"
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
