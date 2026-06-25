import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudioStore } from "../store/studio-store";

/**
 * URL sync — repository, session, and editor deep-links only.
 * Sidebar panel state stays in the store (not in the URL).
 */
export function useStudioUrlSync() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    selectedRepositoryId,
    activeSessionId,
    setSelectedRepositoryId,
    setActiveSessionId,
    openFileTab,
    openPatchTab,
  } = useStudioStore();

  const hydratedRef = React.useRef(false);

  React.useEffect(() => {
    const repositoryId = searchParams.get("repository_id");
    const sessionId = searchParams.get("session_id");
    const file = searchParams.get("file");
    const patchId = searchParams.get("patch_id");

    if (repositoryId && repositoryId !== selectedRepositoryId) {
      setSelectedRepositoryId(repositoryId);
    }

    if (file) {
      const lineRaw = searchParams.get("line");
      const line = lineRaw ? parseInt(lineRaw, 10) : undefined;
      openFileTab(file, Number.isFinite(line) ? line : undefined);
    } else if (patchId) {
      openPatchTab(patchId);
    }

    if (sessionId && sessionId !== activeSessionId) {
      setActiveSessionId(sessionId);
    }

    hydratedRef.current = true;

    // Strip legacy panel/ai query params — sidebar state lives in the store only.
    if (
      typeof window !== "undefined" &&
      (searchParams.has("panel") || searchParams.has("ai"))
    ) {
      const params = new URLSearchParams(window.location.search);
      params.delete("panel");
      params.delete("ai");
      const query = params.toString();
      const cleanUrl = query ? `/studio?${query}` : "/studio";
      router.replace(cleanUrl);
    }
  }, [
    searchParams,
    selectedRepositoryId,
    activeSessionId,
    setSelectedRepositoryId,
    setActiveSessionId,
    openFileTab,
    openPatchTab,
    router,
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

    if (activeTab?.kind === "file" && activeTab.filePath) {
      params.set("file", activeTab.filePath);
      if (activeTab.initialLine) {
        params.set("line", String(activeTab.initialLine));
      }
    }
    if (activeTab?.kind === "patch" && activeTab.patchId) {
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
  }, [selectedRepositoryId, activeSessionId, router]);

  React.useEffect(() => {
    const timeoutId = setTimeout(updateUrl, 300);
    return () => clearTimeout(timeoutId);
  }, [updateUrl]);

  return { syncToUrl: updateUrl };
}
