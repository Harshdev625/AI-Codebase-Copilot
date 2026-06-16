"use client";

import * as React from "react";

import { useStudioStore } from "@/features/studio/store/studio-store";
import { PatchReviewEditor } from "@/features/studio/panels/patch-review-editor";
import { EditorTabBar } from "./editor-tab-bar";
import { WelcomeTab } from "./welcome-tab";
import { FileTabContent } from "./file-tab-content";

export function EditorWorkbench(): React.JSX.Element {
  const { editorTabs, activeTabId, setActiveTabId, closeTab } = useStudioStore();
  const activeTab = editorTabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col" data-testid="editor-workbench">
      <EditorTabBar />
      <div className="relative min-h-0 flex-1">
        {(!activeTab || activeTab.kind === "welcome") && <WelcomeTab />}
        {activeTab?.kind === "file" && activeTab.filePath && (
          <FileTabContent
            tabId={activeTab.id}
            filePath={activeTab.filePath}
            commitSha={activeTab.commitSha}
            initialLine={activeTab.initialLine}
            initialEndLine={activeTab.initialEndLine}
            searchHighlight={activeTab.searchHighlight}
            viewMode={activeTab.viewMode}
          />
        )}
        {activeTab?.kind === "patch" && activeTab.patchId && (
          <div className="h-full min-h-0">
            <PatchReviewEditor
              patchId={activeTab.patchId}
              onClose={() => closeTab(activeTab.id)}
            />
          </div>
        )}
      </div>
      {/* Bottom panel slot — collapsed stub for Phase 2 */}
      <div className="hidden h-0 shrink-0 overflow-hidden" data-testid="bottom-panel-slot" aria-hidden />
    </div>
  );
}
