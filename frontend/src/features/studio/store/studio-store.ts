"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { getStoredUser } from "@/lib/auth";
import { formatEditorTabTitle, isMarkdownFile, toRepoRelativePath } from "@/lib/path-utils";
import {
  createDefaultPersistV2,
  migrateExplorerFirstIfIdle,
  migrateV1ToV2,
  parsePersistV2,
  STUDIO_STORAGE_V2_KEY,
} from "./migrate-studio-storage";
import type {
  EditorSearchHighlight,
  EditorTab,
  MarkdownViewMode,
  MobileStudioTab,
  PrimarySidebar,
  StudioDensity,
} from "../types/studio-types";
import { MAX_EDITOR_TABS, WELCOME_TAB_ID } from "../types/studio-types";

export interface StudioStoreState {
  selectedRepositoryId: string | null;
  setSelectedRepositoryId: (id: string | null) => void;
  selectedSnapshotId: string | null;
  setSelectedSnapshotId: (id: string | null) => void;
  activePatchId: string | null;
  setActivePatchId: (id: string | null) => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any[];
  setSearchResults: (results: any[]) => void;
  hasSearched: boolean;
  setHasSearched: (hasSearched: boolean) => void;

  primarySidebar: PrimarySidebar;
  sidebarCollapsed: boolean;
  contextPanelOpen: boolean;
  aiPanelOpen: boolean;
  settingsOpen: boolean;
  mobileTab: MobileStudioTab;
  density: StudioDensity;

  editorTabs: EditorTab[];
  activeTabId: string;
  activeFilePath: string | null;
  activeFileInitialLine: number | undefined;
  activeFileCommitSha: string | undefined;

  setPrimarySidebar: (panel: PrimarySidebar) => void;
  /** Select a sidebar panel and ensure it is visible (uncollapsed). */
  focusSidebar: (panel: PrimarySidebar) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setContextPanelOpen: (open: boolean) => void;
  toggleContextPanel: () => void;
  setAiPanelOpen: (open: boolean) => void;
  toggleAiPanel: () => void;
  setSettingsOpen: (open: boolean) => void;
  setMobileTab: (tab: MobileStudioTab) => void;
  setDensity: (density: StudioDensity) => void;

  openWelcomeTab: () => void;
  openFileTab: (
    path: string,
    initialLine?: number,
    commitSha?: string,
    initialEndLine?: number,
    searchHighlight?: EditorSearchHighlight,
  ) => void;
  openPatchTab: (patchId: string, title?: string) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTabId: (tabId: string) => void;
  setTabViewMode: (tabId: string, viewMode: MarkdownViewMode) => void;
  /** @deprecated Use openFileTab */
  openFileInEditor: (path: string, initialLine?: number, commitSha?: string) => void;
  editorWordWrap: boolean;
  editorMinimap: boolean;
  defaultMarkdownView: MarkdownViewMode;
  setEditorWordWrap: (enabled: boolean) => void;
  setEditorMinimap: (enabled: boolean) => void;
  setDefaultMarkdownView: (mode: MarkdownViewMode) => void;
}

const userScopedStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    const userId = getStoredUser()?.id ?? "guest";
    return localStorage.getItem(`${name}-${userId}`);
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    const userId = getStoredUser()?.id ?? "guest";
    localStorage.setItem(`${name}-${userId}`, value);
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    const userId = getStoredUser()?.id ?? "guest";
    localStorage.removeItem(`${name}-${userId}`);
  },
};

function fileTabId(path: string): string {
  return `file:${path}`;
}

function patchTabId(patchId: string): string {
  return `patch:${patchId}`;
}

function syncActiveFileFromTab(tab: EditorTab | undefined): Partial<StudioStoreState> {
  if (!tab || tab.kind !== "file") {
    return {
      activeFilePath: null,
      activeFileInitialLine: undefined,
      activeFileCommitSha: undefined,
    };
  }
  return {
    activeFilePath: tab.filePath ?? null,
    activeFileInitialLine: tab.initialLine,
    activeFileCommitSha: tab.commitSha,
    activePatchId: null,
  };
}

const defaults = createDefaultPersistV2();

const studioStoreBase = create<StudioStoreState>()(
  persist(
    (set, get) => ({
      selectedRepositoryId: defaults.selectedRepositoryId,
      setSelectedRepositoryId: (id) =>
        set((state) => {
          if (state.selectedRepositoryId === id) return {};
          return {
            selectedRepositoryId: id,
            activeSessionId: null,
            activePatchId: null,
            selectedSnapshotId: null,
            searchQuery: "",
            searchResults: [],
            hasSearched: false,
          };
        }),
      selectedSnapshotId: null,
      setSelectedSnapshotId: (id) => set({ selectedSnapshotId: id }),
      activePatchId: null,
      setActivePatchId: (id) => {
        if (id) {
          get().openPatchTab(id);
        } else {
          set({ activePatchId: null });
        }
      },
      activeSessionId: defaults.activeSessionId,
      setActiveSessionId: (id) => set({ activeSessionId: id }),

      searchQuery: "",
      setSearchQuery: (query) => set({ searchQuery: query }),
      searchResults: [],
      setSearchResults: (results) => set({ searchResults: results }),
      hasSearched: false,
      setHasSearched: (hasSearched) => set({ hasSearched }),

      primarySidebar: defaults.primarySidebar,
      sidebarCollapsed: defaults.sidebarCollapsed,
      contextPanelOpen: defaults.contextPanelOpen,
      aiPanelOpen: defaults.aiPanelOpen,
      settingsOpen: defaults.settingsOpen,
      mobileTab: defaults.mobileTab,
      density: defaults.density,

      editorTabs: defaults.editorTabs,
      activeTabId: defaults.activeTabId,
      activeFilePath: null,
      activeFileInitialLine: undefined,
      activeFileCommitSha: undefined,

      setPrimarySidebar: (panel) =>
        set({
          primarySidebar: panel,
          sidebarCollapsed: false,
          aiPanelOpen: panel === "sessions",
        }),
      focusSidebar: (panel) => {
        set({
          primarySidebar: panel,
          sidebarCollapsed: false,
          aiPanelOpen: panel === "sessions",
        });
      },
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setContextPanelOpen: (open) => set({ contextPanelOpen: open }),
      toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),
      setAiPanelOpen: (open) => {
        set(
          open
            ? { aiPanelOpen: true, primarySidebar: "sessions", sidebarCollapsed: false }
            : { aiPanelOpen: false },
        );
      },
      toggleAiPanel: () => {
        const s = get();
        if (s.primarySidebar === "sessions" && !s.sidebarCollapsed) {
          set({ sidebarCollapsed: true });
        } else {
          set({ aiPanelOpen: true, primarySidebar: "sessions", sidebarCollapsed: false });
        }
      },
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setMobileTab: (tab) => set({ mobileTab: tab }),
      setDensity: (density) => set({ density }),

      openWelcomeTab: () => {
        const tabs = get().editorTabs;
        const existing = tabs.find((t) => t.id === WELCOME_TAB_ID);
        if (existing) {
          set({ activeTabId: WELCOME_TAB_ID, ...syncActiveFileFromTab(existing) });
          return;
        }
        const welcome: EditorTab = { id: WELCOME_TAB_ID, kind: "welcome", title: "Welcome" };
        set({
          editorTabs: [welcome, ...tabs.filter((t) => t.id !== WELCOME_TAB_ID)],
          activeTabId: WELCOME_TAB_ID,
          ...syncActiveFileFromTab(welcome),
        });
      },

      openFileTab: (path, initialLine, commitSha, initialEndLine, searchHighlight) => {
        const normalizedPath = toRepoRelativePath(path);
        const id = fileTabId(normalizedPath);
        const title = formatEditorTabTitle(normalizedPath);
        const defaultView = get().defaultMarkdownView;
        const markdownView = isMarkdownFile(normalizedPath)
          ? initialLine || searchHighlight
            ? "split"
            : defaultView
          : undefined;
        const tab: EditorTab = {
          id,
          kind: "file",
          title,
          filePath: normalizedPath,
          initialLine,
          initialEndLine,
          commitSha,
          searchHighlight,
          viewMode: markdownView,
        };
        set((state) => {
          const existing = state.editorTabs.find((t) => t.id === id);
          let tabs = state.editorTabs;
          if (existing) {
            tabs = tabs.map((t) =>
              t.id === id
                ? {
                    ...t,
                    title,
                    initialLine,
                    initialEndLine,
                    commitSha,
                    searchHighlight,
                    viewMode:
                      t.viewMode ??
                      (isMarkdownFile(normalizedPath)
                        ? initialLine || searchHighlight
                          ? "split"
                          : defaultView
                        : undefined),
                  }
                : t,
            );
          } else {
            tabs = [...tabs.filter((t) => t.id !== WELCOME_TAB_ID), tab];
            if (tabs.length > MAX_EDITOR_TABS) {
              const removable = tabs.find((t) => t.kind !== "welcome" && t.id !== id);
              if (removable) tabs = tabs.filter((t) => t.id !== removable.id);
            }
          }
          return {
            editorTabs: tabs,
            activeTabId: id,
            activeFilePath: normalizedPath,
            activeFileInitialLine: initialLine,
            activeFileCommitSha: commitSha,
            activePatchId: null,
          };
        });
      },

      openPatchTab: (patchId, title) => {
        const id = patchTabId(patchId);
        const tab: EditorTab = {
          id,
          kind: "patch",
          title: title ?? `Patch ${patchId.slice(0, 8)}`,
          patchId,
        };
        set((state) => {
          const existing = state.editorTabs.find((t) => t.id === id);
          const tabs = existing
            ? state.editorTabs.map((t) => (t.id === id ? tab : t))
            : [...state.editorTabs.filter((t) => t.id !== WELCOME_TAB_ID), tab];
          return {
            editorTabs: tabs,
            activeTabId: id,
            activePatchId: patchId,
            activeFilePath: null,
            activeFileInitialLine: undefined,
            activeFileCommitSha: undefined,
          };
        });
      },

      closeTab: (tabId) => {
        if (tabId === WELCOME_TAB_ID) return;
        set((state) => {
          const tabs = state.editorTabs.filter((t) => t.id !== tabId);
          let nextTabs = tabs;
          if (nextTabs.length === 0) {
            nextTabs = [{ id: WELCOME_TAB_ID, kind: "welcome", title: "Welcome" }];
          }
          const nextActive =
            state.activeTabId === tabId
              ? nextTabs[nextTabs.length - 1]?.id ?? WELCOME_TAB_ID
              : state.activeTabId;
          const activeTab = nextTabs.find((t) => t.id === nextActive);
          return {
            editorTabs: nextTabs,
            activeTabId: nextActive,
            ...syncActiveFileFromTab(activeTab),
            activePatchId: activeTab?.kind === "patch" ? activeTab.patchId ?? null : null,
          };
        });
      },

      closeOtherTabs: (tabId) => {
        set((state) => {
          const keep = state.editorTabs.filter(
            (t) => t.id === tabId || t.id === WELCOME_TAB_ID,
          );
          const nextTabs: EditorTab[] =
            keep.length > 0
              ? keep
              : [{ id: WELCOME_TAB_ID, kind: "welcome", title: "Welcome" }];
          const activeTab = nextTabs.find((t) => t.id === tabId) ?? nextTabs[nextTabs.length - 1];
          const nextActive = activeTab?.id ?? WELCOME_TAB_ID;
          return {
            editorTabs: nextTabs,
            activeTabId: nextActive,
            ...syncActiveFileFromTab(activeTab),
            activePatchId: activeTab?.kind === "patch" ? activeTab.patchId ?? null : null,
          };
        });
      },

      closeAllTabs: () => {
        const welcome: EditorTab = { id: WELCOME_TAB_ID, kind: "welcome", title: "Welcome" };
        set({
          editorTabs: [welcome],
          activeTabId: WELCOME_TAB_ID,
          ...syncActiveFileFromTab(welcome),
          activePatchId: null,
        });
      },

      setActiveTabId: (tabId) => {
        const tab = get().editorTabs.find((t) => t.id === tabId);
        if (!tab) return;
        set({
          activeTabId: tabId,
          ...syncActiveFileFromTab(tab),
          activePatchId: tab.kind === "patch" ? tab.patchId ?? null : null,
        });
      },

      setTabViewMode: (tabId, viewMode) => {
        set((state) => ({
          editorTabs: state.editorTabs.map((tab) =>
            tab.id === tabId ? { ...tab, viewMode } : tab,
          ),
        }));
      },

      openFileInEditor: (path, initialLine, commitSha) => {
        get().openFileTab(path, initialLine, commitSha);
      },

      editorWordWrap: defaults.editorWordWrap,
      editorMinimap: defaults.editorMinimap,
      defaultMarkdownView: defaults.defaultMarkdownView,
      setEditorWordWrap: (enabled) => set({ editorWordWrap: enabled }),
      setEditorMinimap: (enabled) => set({ editorMinimap: enabled }),
      setDefaultMarkdownView: (mode) => set({ defaultMarkdownView: mode }),
    }),
    {
      name: STUDIO_STORAGE_V2_KEY,
      storage: createJSONStorage(() => userScopedStorage),
      partialize: (state) => ({
        version: 2 as const,
        selectedRepositoryId: state.selectedRepositoryId,
        activeSessionId: state.activeSessionId,
        activePatchId: state.activePatchId,
        selectedSnapshotId: state.selectedSnapshotId,
        primarySidebar: state.primarySidebar,
        sidebarCollapsed: state.sidebarCollapsed,
        contextPanelOpen: state.contextPanelOpen,
        aiPanelOpen: state.aiPanelOpen,
        mobileTab: state.mobileTab,
        editorTabs: state.editorTabs,
        activeTabId: state.activeTabId,
        editorWordWrap: state.editorWordWrap,
        editorMinimap: state.editorMinimap,
        defaultMarkdownView: state.defaultMarkdownView,
      }),
      merge: (persisted, current) => {
        const parsed = parsePersistV2(
          typeof persisted === "object" && persisted !== null
            ? JSON.stringify({ state: persisted })
            : null
        );
        if (!parsed) return current;
        const migrated = migrateExplorerFirstIfIdle(parsed);
        return {
          ...current,
          selectedRepositoryId: migrated.selectedRepositoryId,
          activeSessionId: migrated.activeSessionId,
          activePatchId: migrated.activePatchId,
          selectedSnapshotId: migrated.selectedSnapshotId ?? null,
          primarySidebar: migrated.primarySidebar ?? "explorer",
          aiPanelOpen: migrated.aiPanelOpen ?? false,
          sidebarCollapsed: migrated.sidebarCollapsed ?? false,
          contextPanelOpen: migrated.contextPanelOpen ?? true,
          settingsOpen: false,
          mobileTab: migrated.mobileTab ?? "files",
          editorTabs: migrated.editorTabs,
          activeTabId: migrated.activeTabId,
          editorWordWrap: migrated.editorWordWrap,
          editorMinimap: migrated.editorMinimap,
          defaultMarkdownView: migrated.defaultMarkdownView ?? "preview",
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        const userId = getStoredUser()?.id ?? "guest";
        try {
          const v1Raw = localStorage.getItem(`studio-storage-${userId}`);
          if (v1Raw && !localStorage.getItem(`${STUDIO_STORAGE_V2_KEY}-${userId}`)) {
            const migrated = migrateV1ToV2(JSON.parse(v1Raw)?.state ?? JSON.parse(v1Raw));
            studioStoreBase.setState({
              ...migrated,
              editorTabs: migrated.editorTabs,
              activeTabId: migrated.activeTabId,
            });
          }
        } catch {
          /* ignore */
        }
        const tab = state.editorTabs.find((t) => t.id === state.activeTabId);
        if (tab) {
          studioStoreBase.setState(syncActiveFileFromTab(tab));
        }
        // Keep aiPanelOpen aligned with primary sidebar after rehydrate
        studioStoreBase.setState({
          aiPanelOpen: state.primarySidebar === "sessions",
        });
      },
    }
  )
);

export const useStudioStore = studioStoreBase;

export function createEditorTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type { EditorTab, PrimarySidebar };
