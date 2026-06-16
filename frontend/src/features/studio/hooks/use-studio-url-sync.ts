import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudioStore } from "../store/studio-store";
import type { PrimarySidebar } from "../types/studio-types";

const TOOL_PANELS: PrimarySidebar[] = [
  "explorer",
  "search",
  "snapshots",
  "patches",
  "tasks",
];

function isToolPanel(panel: string | null): panel is PrimarySidebar {
  return Boolean(panel && TOOL_PANELS.includes(panel as PrimarySidebar));
}

/**
 * URL → store on mount; store → URL on explicit navigation (debounced).
 */
export function useStudioUrlSync() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    selectedRepositoryId,
    activeSessionId,
    primarySidebar,
    setSelectedRepositoryId,
    setActiveSessionId,
    focusSidebar,
    openFileTab,
    openPatchTab,
  } = useStudioStore();

  const hydratedRef = React.useRef(false);

  React.useEffect(() => {
    const repositoryId = searchParams.get("repository_id");
    const sessionId = searchParams.get("session_id");
    const panel = searchParams.get("panel");
    const aiOpen = searchParams.get("ai") === "open";
    const file = searchParams.get("file");
    const patchId = searchParams.get("patch_id");

    const hasEditorIntent = Boolean(file || patchId);
    const hasToolPanel = isToolPanel(panel);

    if (repositoryId && repositoryId !== selectedRepositoryId) {
      setSelectedRepositoryId(repositoryId);
    }

    if (file) {
      const lineRaw = searchParams.get("line");
      const line = lineRaw ? parseInt(lineRaw, 10) : undefined;
      openFileTab(file, Number.isFinite(line) ? line : undefined);
      focusSidebar(hasToolPanel ? (panel as PrimarySidebar) : "explorer");
    } else if (patchId) {
      openPatchTab(patchId);
      focusSidebar(hasToolPanel ? (panel as PrimarySidebar) : "explorer");
    } else if (hasToolPanel) {
      focusSidebar(panel as PrimarySidebar);
    }

    if (sessionId && sessionId !== activeSessionId) {
      setActiveSessionId(sessionId);
      if (!hasEditorIntent && !hasToolPanel) {
        focusSidebar("sessions");
      }
    }

    if (aiOpen && !hasEditorIntent && !hasToolPanel) {
      focusSidebar("sessions");
    }

    hydratedRef.current = true;
  }, [
    searchParams,
    selectedRepositoryId,
    activeSessionId,
    setSelectedRepositoryId,
    setActiveSessionId,
    focusSidebar,
    openFileTab,
    openPatchTab,
  ]);

  const updateUrl = React.useCallback(() => {
    if (!hydratedRef.current) return;

    const params = new URLSearchParams();

    if (selectedRepositoryId) {
      params.set("repository_id", selectedRepositoryId);
    }
    if (activeSessionId) {
      params.set("session_id", activeSessionId);
    }

    const activeTab = useStudioStore.getState().editorTabs.find(
      (t) => t.id === useStudioStore.getState().activeTabId,
    );
    const hasOpenFile = activeTab?.kind === "file" && activeTab.filePath;
    const hasOpenPatch = activeTab?.kind === "patch" && activeTab.patchId;

    if (primarySidebar && primarySidebar !== "sessions") {
      params.set("panel", primarySidebar);
    }
    if (primarySidebar === "sessions") {
      params.set("ai", "open");
    }

    if (hasOpenFile && activeTab?.filePath) {
      params.set("file", activeTab.filePath);
      if (activeTab.initialLine) {
        params.set("line", String(activeTab.initialLine));
      }
    }
    if (hasOpenPatch && activeTab?.patchId) {
      params.set("patch_id", activeTab.patchId);
    }

    const query = params.toString();
    const newUrl = query ? `/studio?${query}` : "/studio";
    const currentPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "";

    if (newUrl === currentPath) return;
    router.replace(newUrl);
  }, [selectedRepositoryId, activeSessionId, primarySidebar, router]);

  React.useEffect(() => {
    const timeoutId = setTimeout(updateUrl, 300);
    return () => clearTimeout(timeoutId);
  }, [updateUrl]);

  return { syncToUrl: updateUrl };
}
