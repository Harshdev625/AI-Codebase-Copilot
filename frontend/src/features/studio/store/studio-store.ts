"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { getStoredUser } from "@/lib/auth";
import type { CanvasMode, SecondaryPanel } from "../types/studio-types";

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

  canvasMode: CanvasMode;
  secondaryPanel: SecondaryPanel;
  activeFilePath: string | null;
  activeFileInitialLine: number | undefined;
  activeFileCommitSha: string | undefined;

  setCanvasMode: (mode: CanvasMode) => void;
  setSecondaryPanel: (panel: SecondaryPanel) => void;
  toggleSecondaryPanel: (panel: NonNullable<SecondaryPanel>) => void;
  setActiveFilePath: (path: string | null) => void;
  setActiveFileInitialLine: (line: number | undefined) => void;
  setActiveFileCommitSha: (sha: string | undefined) => void;
  openFileInEditor: (path: string, initialLine?: number, commitSha?: string) => void;
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

function readLegacyPersistedState(): Partial<StudioStoreState> {
  if (typeof window === "undefined") return {};

  const userId = getStoredUser()?.id ?? "guest";
  const merged: Partial<StudioStoreState> = {};

  try {
    const studioRaw = localStorage.getItem(`studio-specific-storage-${userId}`);
    if (studioRaw) {
      const parsed = JSON.parse(studioRaw);
      const state = parsed?.state ?? parsed;
      if (state.canvasMode != null) merged.canvasMode = state.canvasMode;
      if (state.secondaryPanel !== undefined) merged.secondaryPanel = state.secondaryPanel;
    }
  } catch {
    // ignore corrupt legacy storage
  }

  return merged;
}

const studioStoreBase = create<StudioStoreState>()(
  persist(
    (set) => ({
      selectedRepositoryId: null,
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
      setActivePatchId: (id) => set({ activePatchId: id }),
      activeSessionId: null,
      setActiveSessionId: (id) => set({ activeSessionId: id }),

      searchQuery: "",
      setSearchQuery: (query) => set({ searchQuery: query }),
      searchResults: [],
      setSearchResults: (results) => set({ searchResults: results }),
      hasSearched: false,
      setHasSearched: (hasSearched) => set({ hasSearched }),

      canvasMode: "chat",
      secondaryPanel: null,
      activeFilePath: null,
      activeFileInitialLine: undefined,
      activeFileCommitSha: undefined,

      setCanvasMode: (mode) => set({ canvasMode: mode }),
      setSecondaryPanel: (panel) => set({ secondaryPanel: panel }),
      toggleSecondaryPanel: (panel) =>
        set((state) => ({
          secondaryPanel: state.secondaryPanel === panel ? null : panel,
        })),
      setActiveFilePath: (path) => set({ activeFilePath: path }),
      setActiveFileInitialLine: (line) => set({ activeFileInitialLine: line }),
      setActiveFileCommitSha: (sha) => set({ activeFileCommitSha: sha }),
      openFileInEditor: (path, initialLine, commitSha) =>
        set({
          activeFilePath: path,
          activeFileInitialLine: initialLine,
          activeFileCommitSha: commitSha,
          canvasMode: "editor",
        }),
    }),
    {
      name: "studio-storage",
      storage: createJSONStorage(() => userScopedStorage),
      partialize: (state) => ({
        selectedRepositoryId: state.selectedRepositoryId,
        activeSessionId: state.activeSessionId,
        canvasMode: state.canvasMode,
        secondaryPanel: state.secondaryPanel,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        const legacy = readLegacyPersistedState();
        if (Object.keys(legacy).length === 0) return;
        studioStoreBase.setState((current) => ({
          ...current,
          selectedRepositoryId: current.selectedRepositoryId ?? legacy.selectedRepositoryId ?? null,
          activeSessionId: current.activeSessionId ?? legacy.activeSessionId ?? null,
          canvasMode: legacy.canvasMode ?? current.canvasMode,
          secondaryPanel: legacy.secondaryPanel ?? current.secondaryPanel,
        }));
      },
    }
  )
);

export const useStudioStore = Object.assign(
  function useStudioStoreHook(): StudioStoreState {
    return studioStoreBase();
  },
  {
    getState: (): StudioStoreState => studioStoreBase.getState(),
    setState: studioStoreBase.setState,
    subscribe: studioStoreBase.subscribe,
  }
);

export type { CanvasMode, SecondaryPanel };
