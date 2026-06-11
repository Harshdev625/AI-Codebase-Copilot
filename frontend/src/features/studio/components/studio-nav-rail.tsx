"use client";

import * as React from "react";
import { MessageSquare, Files, Search, Camera, GitPullRequestDraft, ListTodo, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudioStore } from "../store/studio-store";
import type { SecondaryPanel } from "../types/studio-types";

const navItems: {
  id: string;
  icon: React.ElementType;
  label: string;
  panel: SecondaryPanel | null;
  section?: "top" | "bottom";
}[] = [
  { id: "chat", icon: MessageSquare, label: "Chat", panel: null },
  { id: "explorer", icon: Files, label: "Explorer", panel: "explorer" },
  { id: "search", icon: Search, label: "Search", panel: "search" },
  { id: "snapshots", icon: Camera, label: "Snapshots", panel: "snapshots" },
  { id: "patches", icon: GitPullRequestDraft, label: "Patches", panel: "patches" },
  { id: "tasks", icon: ListTodo, label: "Tasks", panel: "tasks" },
  { id: "settings", icon: Settings2, label: "Settings", panel: "settings", section: "bottom" },
];

export function StudioNavRail() {
  const { secondaryPanel, toggleSecondaryPanel, setCanvasMode, canvasMode } = useStudioStore();

  const topItems = navItems.filter((i) => i.section !== "bottom");
  const bottomItems = navItems.filter((i) => i.section === "bottom");

  const isActive = (item: typeof navItems[number]) => {
    if (item.id === "chat") return canvasMode === "chat" && !secondaryPanel;
    return secondaryPanel === item.panel;
  };

  const handleClick = (item: typeof navItems[number]) => {
    if (item.id === "chat") {
      setCanvasMode("chat");
    } else if (item.panel) {
      toggleSecondaryPanel(item.panel);
    }
  };

  return (
    <nav
      className="w-12 h-full bg-[#0F1117] border-r border-[#1E212B] flex flex-col items-center py-2 shrink-0"
      aria-label="Studio navigation"
    >
      {/* Top nav items */}
      <div className="flex flex-col items-center gap-1 flex-1">
        {topItems.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              title={item.label}
              aria-label={item.label}
              aria-pressed={active}
              className={cn(
                "group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150",
                active
                  ? "bg-[#1C2333] text-[#58A6FF]"
                  : "text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#1A1C23]"
              )}
            >
              {/* Active indicator bar */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#58A6FF] rounded-r-full" />
              )}
              <item.icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Bottom items */}
      <div className="flex flex-col items-center gap-1 pb-1 border-t border-[#1E212B] pt-2">
        {bottomItems.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              title={item.label}
              aria-label={item.label}
              aria-pressed={active}
              className={cn(
                "group flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150",
                active
                  ? "bg-[#1C2333] text-[#58A6FF]"
                  : "text-[#8B949E]/60 hover:text-[#8B949E] hover:bg-[#1A1C23]"
              )}
            >
              <item.icon className="w-3.5 h-3.5" />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
