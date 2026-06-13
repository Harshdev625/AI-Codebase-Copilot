"use client";

import * as React from "react";
import {
  MessageSquare,
  Files,
  Search,
  Camera,
  GitPullRequestDraft,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudioStore } from "../store/studio-store";
import type { PrimarySidebar } from "../types/studio-types";

const navItems: {
  id: PrimarySidebar;
  icon: React.ElementType;
  label: string;
}[] = [
  { id: "sessions", icon: MessageSquare, label: "Chat & Sessions" },
  { id: "explorer", icon: Files, label: "Explorer" },
  { id: "search", icon: Search, label: "Search" },
  { id: "snapshots", icon: Camera, label: "Snapshots" },
  { id: "patches", icon: GitPullRequestDraft, label: "Patches" },
  { id: "tasks", icon: ListTodo, label: "Tasks" },
];

export function StudioNavRail() {
  const { primarySidebar, focusSidebar } = useStudioStore();

  const renderItem = (item: (typeof navItems)[number]) => {
    const active = primarySidebar === item.id;
    return (
      <button
        key={item.id}
        onClick={() => focusSidebar(item.id)}
        title={item.id === "sessions" ? `${item.label} (Ctrl+L)` : item.label}
        aria-label={item.label}
        aria-pressed={active}
        className={cn(
          "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150 xl:h-11 xl:w-11",
          active
            ? "bg-[#1C2333] text-[#58A6FF]"
            : "text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#1A1C23]",
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-[#58A6FF] xl:h-6" />
        )}
        <item.icon className="h-[18px] w-[18px] xl:h-5 xl:w-5" />
        <span className="pointer-events-none absolute left-full ml-2 hidden rounded bg-[#1A1C23] px-2 py-1 text-[10px] font-medium text-[#C9D1D9] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 lg:block">
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav
      className="flex h-full w-12 shrink-0 flex-col items-center border-r border-[#1E212B] bg-[#0F1117] py-2 lg:w-14 xl:w-[60px]"
      aria-label="Studio navigation"
      data-testid="studio-nav-rail"
    >
      <div className="flex flex-1 flex-col items-center gap-1">{navItems.map(renderItem)}</div>
    </nav>
  );
}
