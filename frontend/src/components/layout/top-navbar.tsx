"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LogOut, LayoutDashboard, FolderGit2, Bot, ChevronRight, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { NotificationDropdown } from "@/components/navbar/NotificationDropdown";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Repositories", href: "/repositories", icon: FolderGit2 },
  { label: "Chat", href: "/chat", icon: Bot },
];

interface TopNavbarProps {
  sectionTitle: string;
  userEmail?: string;
  onSignOut: () => void;
}

export function TopNavbar({ sectionTitle, userEmail, onSignOut }: TopNavbarProps): React.JSX.Element {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isActive = (href: string): boolean => {
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  };

  return (
    <header className="sticky top-0 z-30 shrink-0">
      <div className="border-b border-border/60 bg-background/80 backdrop-blur-2xl">
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-5 lg:px-6">
          {/* Left: Logo + Primary Nav */}
          <div className="flex items-center gap-6 min-w-0">
            {/* Logo */}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
            >
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                <div className="text-[10px] font-bold text-primary">ACC</div>
              </div>
              <span className="hidden sm:block text-xs font-bold tracking-tight text-foreground">{sectionTitle}</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-0.5">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium transition-all",
                      active
                        ? "text-foreground bg-primary/8"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="navbar-indicator"
                        className="absolute inset-0 rounded-lg border border-primary/20 bg-primary/8"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                    <Icon className={cn("h-4 w-4 relative z-10", active && "text-primary")} />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>

            <div className="h-4 w-px bg-border/40 mx-0.5 hidden sm:block" />

            {/* Notification dropdown */}
            <NotificationDropdown />

            <div className="h-4 w-px bg-border/40 mx-0.5 hidden sm:block" />

            {/* Theme toggle */}
            <ThemeToggle />

            {/* User email */}
            {userEmail && (
              <span className="hidden lg:block text-[11px] font-medium text-muted-foreground max-w-[140px] truncate">
                {userEmail}
              </span>
            )}

            {/* Settings */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* Sign out */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
              onClick={onSignOut}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border/40 bg-card/50 backdrop-blur"
          >
            <nav className="flex flex-col gap-0.5 p-3">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-all",
                      active
                        ? "text-foreground bg-primary/12 border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </div>
    </header>
  );
}
