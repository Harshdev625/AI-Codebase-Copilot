"use client";

import * as React from "react";
import { PanelLeftClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/features/studio/store/studio-store";

interface StudioWorkflowSidebarProps {
  title: string;
  children: React.ReactNode;
}

export function StudioWorkflowSidebar({ title, children }: StudioWorkflowSidebarProps) {
  const setSidebarCollapsed = useStudioStore((s) => s.setSidebarCollapsed);

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-r border-[#1E212B] bg-[#13151A]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#1E212B] px-4 xl:h-11">
        <span className="text-[11px] font-bold tracking-widest text-[#8B949E] xl:text-xs">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 text-[#8B949E] md:flex xl:h-9 xl:w-9"
          onClick={() => setSidebarCollapsed(true)}
          title="Hide sidebar (Ctrl+B)"
          aria-label="Hide sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </aside>
  );
}
