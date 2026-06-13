import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudioStore } from "../store/studio-store";
import type { PrimarySidebar } from "../types/studio-types";

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
    aiPanelOpen,
    setSelectedRepositoryId,
    setActiveSessionId,
    focusSidebar,
    setAiPanelOpen,
    openFileTab,
    openPatchTab,
  } = useStudioStore();

  const hydratedRef = React.useRef(false);

  React.useEffect(() => {
    const repositoryId = searchParams.get("repository_id");
    const sessionId = searchParams.get("session_id");
    const panel = searchParams.get("panel") as PrimarySidebar | null;
    const aiOpen = searchParams.get("ai") === "open";
    const file = searchParams.get("file");
    const patchId = searchParams.get("patch_id");

    if (repositoryId && repositoryId !== selectedRepositoryId) {
      setSelectedRepositoryId(repositoryId);
    }
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSessionId(sessionId);
      focusSidebar("sessions");
    } else if (!sessionId && activeSessionId && !hydratedRef.current) {
      /* keep persisted session */
    }
    if (panel && panel !== "explorer") {
      focusSidebar(panel);
    } else if (panel === "explorer" && (file || patchId)) {
      focusSidebar("explorer");
    }
    if (aiOpen) {
      focusSidebar("sessions");
    }
    if (file) {
      const lineRaw = searchParams.get("line");
      const line = lineRaw ? parseInt(lineRaw, 10) : undefined;
      openFileTab(file, Number.isFinite(line) ? line : undefined);
      focusSidebar("explorer");
    }
    if (patchId) {
      openPatchTab(patchId);
      focusSidebar("explorer");
    }

    hydratedRef.current = true;
  }, [
    searchParams,
    selectedRepositoryId,
    activeSessionId,
    primarySidebar,
    aiPanelOpen,
    setSelectedRepositoryId,
    setActiveSessionId,
    focusSidebar,
    setAiPanelOpen,
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
      if (primarySidebar !== "explorer" || hasOpenFile || hasOpenPatch) {
        params.set("panel", primarySidebar);
      }
    }
    if (primarySidebar === "sessions" || aiPanelOpen) {
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
  }, [selectedRepositoryId, activeSessionId, primarySidebar, aiPanelOpen, router]);

  React.useEffect(() => {
    const timeoutId = setTimeout(updateUrl, 300);
    return () => clearTimeout(timeoutId);
  }, [updateUrl]);

  return { syncToUrl: updateUrl };
}
