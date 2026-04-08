"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, Search, Bell } from "lucide-react";

import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { Button } from "@/components/ui/button";

interface TopNavbarProps {
  sectionTitle: string;
  userEmail?: string;
  onMenuClick: () => void;
  onSidebarToggle: () => void;
  isSidebarCollapsed: boolean;
  onSignOut: () => void;
}

export function TopNavbar({
  sectionTitle,
  userEmail,
  onMenuClick,
  onSidebarToggle,
  isSidebarCollapsed,
  onSignOut,
}: TopNavbarProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/60 backdrop-blur-xl">
      <div className="flex h-14 w-full items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">AI Codebase Copilot</span>
            <span className="text-border">/</span>
            <span className="font-medium text-foreground">{sectionTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Placeholder (Modern UX) */}
          <button className="hidden h-9 w-64 items-center justify-between rounded-md border border-input bg-background/50 px-3 text-xs text-muted-foreground transition-all hover:bg-accent/50 lg:flex">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              <span>Search files...</span>
            </div>
            <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>

          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
            <Bell className="h-4 w-4" />
          </Button>

          <div className="mx-2 h-4 w-px bg-border" />

          <ThemeSwitcher />
          
          {userEmail && (
             <div className="hidden items-center gap-2 md:flex">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
                  {userEmail[0].toUpperCase()}
                </div>
             </div>
          )}

          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
