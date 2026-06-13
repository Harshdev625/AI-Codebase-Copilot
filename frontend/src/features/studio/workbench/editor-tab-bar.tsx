"use client";

import * as React from "react";
import { X, FileCode2, GitPullRequestDraft, Home } from "lucide-react";

import { cn } from "@/lib/utils";
import { useStudioStore } from "@/features/studio/store/studio-store";
import type { EditorTab } from "@/features/studio/types/studio-types";
import { WELCOME_TAB_ID } from "@/features/studio/types/studio-types";

function tabIcon(tab: EditorTab): React.ReactNode {
  switch (tab.kind) {
    case "welcome":
      return <Home className="h-4 w-4 shrink-0 opacity-70" />;
    case "patch":
      return <GitPullRequestDraft className="h-4 w-4 shrink-0 opacity-70" />;
    default:
      return <FileCode2 className="h-4 w-4 shrink-0 opacity-70" />;
  }
}

export function EditorTabBar(): React.JSX.Element {
  const { editorTabs, activeTabId, setActiveTabId, closeTab } = useStudioStore();

  return (
    <div
      className="flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-[#1E212B] bg-[#13151A] no-scrollbar xl:h-11"
      role="tablist"
      aria-label="Open editors"
      data-testid="editor-tab-bar"
    >
      {editorTabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={cn(
              "group flex max-w-[200px] min-w-[120px] cursor-pointer items-center gap-1.5 border-r border-[#1E212B] px-3 text-xs transition-colors xl:text-sm",
              active
                ? "bg-[#0B0D14] text-[#C9D1D9]"
                : "bg-[#13151A] text-[#8B949E] hover:bg-[#1A1C23] hover:text-[#C9D1D9]",
            )}
            onClick={() => setActiveTabId(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveTabId(tab.id);
              }
            }}
          >
            {tabIcon(tab)}
            <span className="truncate font-medium">{tab.title}</span>
            {tab.id !== WELCOME_TAB_ID && (
              <button
                type="button"
                className="ml-auto shrink-0 rounded p-0.5 opacity-0 hover:bg-[#2D313E] group-hover:opacity-100"
                aria-label={`Close ${tab.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
