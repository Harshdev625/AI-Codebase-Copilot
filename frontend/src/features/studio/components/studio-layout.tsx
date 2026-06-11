"use client";

import * as React from "react";

interface StudioLayoutProps {
  children: React.ReactNode;
}

/**
 * Phase 0 scaffold for the Unified Copilot Studio shell.
 * Provides a full-viewport container; region layout (nav rail, panels) arrives in Phase 1.
 */
export function StudioLayout({ children }: StudioLayoutProps): React.JSX.Element {
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-[#0B0D14] text-foreground"
      data-studio-shell="phase-0"
    >
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
