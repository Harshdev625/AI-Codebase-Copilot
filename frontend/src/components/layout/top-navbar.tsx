"use client";

import { Menu } from "lucide-react";

import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { Button } from "@/components/ui/button";

interface TopNavbarProps {
  sectionTitle: string;
  userEmail?: string;
  onMenuClick: () => void;
  onSignOut: () => void;
}

export function TopNavbar({ sectionTitle, userEmail, onMenuClick, onSignOut }: TopNavbarProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="md:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">AI Codebase Copilot</p>
            <p className="text-sm font-semibold text-foreground">{sectionTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <div className="hidden rounded-lg border border-border bg-card px-3 py-1 text-xs text-muted-foreground md:block">
            {userEmail ?? "Session"}
          </div>
          <Button variant="secondary" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
