"use client";

import * as React from "react";
import { X, FileCode2, GitPullRequestDraft, Home, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { FileIcon } from "@/features/studio/components/file-icon";
import type { EditorTab } from "@/features/studio/types/studio-types";
import { WELCOME_TAB_ID } from "@/features/studio/types/studio-types";

function tabIcon(tab: EditorTab): React.ReactNode {
  switch (tab.kind) {
    case "welcome":
      return <Home className="h-4 w-4 shrink-0 opacity-70" />;
    case "patch":
      return <GitPullRequestDraft className="h-4 w-4 shrink-0 opacity-70" />;
    default:
      if (tab.filePath) {
        return <FileIcon path={tab.filePath} className="h-4 w-4 shrink-0" />;
      }
      return <FileCode2 className="h-4 w-4 shrink-0 opacity-70" />;
  }
}

function tabTooltip(tab: EditorTab): string {
  if (tab.kind === "file" && tab.filePath) return tab.filePath;
  if (tab.kind === "patch" && tab.patchId) return `Patch ${tab.patchId}`;
  return tab.title;
}

export function EditorTabBar(): React.JSX.Element {
  const {
    editorTabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
  } = useStudioStore();

  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const closableTabs = editorTabs.filter((t) => t.id !== WELCOME_TAB_ID);
  const tabRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  React.useEffect(() => {
    const el = tabRefs.current[activeTabId];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  React.useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

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
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            title={tabTooltip(tab)}
            className={cn(
              "group flex max-w-[220px] min-w-[100px] cursor-pointer items-center gap-1.5 border-r border-[#1E212B] px-2.5 text-xs transition-colors xl:text-sm",
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

      {closableTabs.length > 0 && (
        <div className="relative flex shrink-0 items-center px-1" ref={menuRef}>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded text-[#8B949E] hover:bg-[#1A1C23] hover:text-[#C9D1D9]"
            aria-label="Tab actions"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-1 top-full z-50 mt-1 min-w-[160px] rounded-md border border-[#2D313E] bg-[#1C1F26] py-1 shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs text-[#C9D1D9] hover:bg-[#2D313E]"
                onClick={() => { closeTab(activeTabId); setMenuOpen(false); }}
              >
                Close active tab
              </button>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs text-[#C9D1D9] hover:bg-[#2D313E]"
                onClick={() => { closeOtherTabs(activeTabId); setMenuOpen(false); }}
              >
                Close other tabs
              </button>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs text-[#C9D1D9] hover:bg-[#2D313E]"
                onClick={() => { closeAllTabs(); setMenuOpen(false); }}
              >
                Close all tabs
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
