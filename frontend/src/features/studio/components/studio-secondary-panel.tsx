"use client";

import * as React from "react";

import { BackgroundTasksPanel } from "@/features/workspace/components/background-tasks-panel";
import { PatchListPanel } from "@/features/workspace/components/patch-list-panel";
import { SearchPanel } from "@/features/workspace/components/search-panel";
import { SettingsPanel } from "@/features/workspace/components/settings-panel";
import { SnapshotTimeline } from "@/features/repositories/components/snapshot-timeline";

import { useStudioStore } from "../store/studio-store";
import { StudioExplorerPanel } from "./studio-explorer-panel";

const PANEL_TITLES: Record<string, string> = {
  explorer: "EXPLORER",
  search: "SEARCH",
  snapshots: "SNAPSHOTS",
  patches: "PATCHES",
  tasks: "BACKGROUND TASKS",
  settings: "SETTINGS",
};

/**
 * Phase 3 secondary panel.
 * Renders null when no panel is active (zero-width, no DOM node).
 * When active: 320px wide aside with a fixed header and scrollable content area.
 *
 * Panel inventory:
 *   explorer  → StudioExplorerPanel (LazyTreeNode file tree, context toggle)
 *   search    → SearchPanel (semantic / exact repo search)
 *   snapshots → SnapshotTimeline (retention history + compare)
 *   patches   → PatchListPanel (ACT patch lifecycle list)
 *   tasks     → BackgroundTasksPanel (indexing job status + stepper)
 *   settings  → SettingsPanel (theme + editor preferences)
 */
export function StudioSecondaryPanel() {
  const {
    secondaryPanel,
    selectedRepositoryId,
    setActivePatchId,
    setCanvasMode,
    openFileInEditor,
  } = useStudioStore();

  if (!secondaryPanel) {
    return null;
  }

  const renderContent = () => {
    switch (secondaryPanel) {
      case "explorer":
        return <StudioExplorerPanel />;

      case "search":
        return (
          <SearchPanel
            onResultClick={(path, _content, initialLine) => {
              openFileInEditor(path, initialLine);
            }}
          />
        );

      case "snapshots":
        return selectedRepositoryId ? (
          <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
            <SnapshotTimeline repositoryId={selectedRepositoryId} />
          </div>
        ) : (
          <EmptyRepoPrompt label="snapshots" />
        );

      case "patches":
        return (
          <PatchListPanel
            onPatchClick={(patchId) => {
              setActivePatchId(patchId);
              setCanvasMode("patch-review");
            }}
          />
        );

      case "tasks":
        return <BackgroundTasksPanel />;

      case "settings":
        return <SettingsPanel />;

      default:
        return null;
    }
  };

  return (
    <aside className="w-[320px] shrink-0 h-full flex flex-col bg-[#13151A] border-r border-[#1E212B]">
      {/* Panel header */}
      <div className="flex items-center px-5 pt-5 pb-4 shrink-0 border-b border-[#1E212B]">
        <h3 className="text-[#C9D1D9] text-[11px] font-bold tracking-wider">
          {PANEL_TITLES[secondaryPanel] ?? secondaryPanel.toUpperCase()}
        </h3>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {renderContent()}
      </div>
    </aside>
  );
}

function EmptyRepoPrompt({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center p-4 text-center">
      <p className="text-[#8B949E] text-sm">Select a repository to view {label}.</p>
    </div>
  );
}
