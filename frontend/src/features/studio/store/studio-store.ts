"use client";

/**
 * Unified Copilot Studio store (Phase 1).
 *
 * Design: composite hook pattern.
 * - Shared state (repository selection, sessions, patches, search) lives in
 *   `useWorkspaceStore` so the dormant WorkspaceShell and `/workspace` route
 *   continue to work without modification.
 * - Studio-specific state (canvasMode, secondaryPanel, activeFilePath) lives in
 *   a small internal Zustand store.
 * - `useStudioStore` merges both into one object so callers have a single import.
 * - `useStudioStore.getState()` provides imperative access for command palette /
 *   hotkey handlers that run outside the React render cycle.
 *
 * Phase 5 will promote studio-store to the sole store and retire workspace-store.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { getStoredUser } from "@/lib/auth";
import { useWorkspaceStore } from "@/features/workspace/store/workspace-store";
import type { WorkspaceState } from "@/features/workspace/store/workspace-store";
import type { CanvasMode, SecondaryPanel } from "../types/studio-types";

// ---------------------------------------------------------------------------
// Studio-specific slice (state that does NOT exist in workspace-store)
// ---------------------------------------------------------------------------

interface StudioSpecificState {
  canvasMode: CanvasMode;
  secondaryPanel: SecondaryPanel;
  activeFilePath: string | null;
  /** Line number to reveal & highlight when the editor canvas opens a file. */
  activeFileInitialLine: number | undefined;
  /** Commit SHA to use when fetching historical file content (snapshot browsing). */
  activeFileCommitSha: string | undefined;

  setCanvasMode: (mode: CanvasMode) => void;
  setSecondaryPanel: (panel: SecondaryPanel) => void;
  /** Toggle a secondary panel on/off (same panel → close; different panel → open). */
  toggleSecondaryPanel: (panel: NonNullable<SecondaryPanel>) => void;
  setActiveFilePath: (path: string | null) => void;
  setActiveFileInitialLine: (line: number | undefined) => void;
  setActiveFileCommitSha: (sha: string | undefined) => void;
  /** Convenience: set file + optional jump-line + optional commit SHA + switch to editor mode in one call. */
  openFileInEditor: (path: string, initialLine?: number, commitSha?: string) => void;
}

const studioScopedStorage = {
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

const useStudioSpecificStore = create<StudioSpecificState>()(
  persist(
    (set) => ({
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
        set({ activeFilePath: path, activeFileInitialLine: initialLine, activeFileCommitSha: commitSha, canvasMode: "editor" }),
    }),
    {
      name: "studio-specific-storage",
      storage: createJSONStorage(() => studioScopedStorage),
      partialize: (state) => ({
        canvasMode: state.canvasMode,
        secondaryPanel: state.secondaryPanel,
      }),
    }
  )
);

// ---------------------------------------------------------------------------
// Combined type — workspace state + studio-specific state
// ---------------------------------------------------------------------------

export type StudioStoreState = WorkspaceState & StudioSpecificState;

// ---------------------------------------------------------------------------
// Composite hook — explicitly typed so TypeScript resolves the call signature
// without widening to StudioSpecificState.
// ---------------------------------------------------------------------------

interface StudioStoreHook {
  (): StudioStoreState;
  /**
   * Imperative getState — mirrors the Zustand `store.getState()` contract so
   * hotkey handlers and command-palette actions can call
   * `useStudioStore.getState().setSecondaryPanel(...)` outside the render cycle.
   */
  getState: () => StudioStoreState;
}

export const useStudioStore: StudioStoreHook = Object.assign(
  function useStudioStoreImpl(): StudioStoreState {
    const workspace = useWorkspaceStore();
    const specific = useStudioSpecificStore();
    return { ...workspace, ...specific };
  },
  {
    getState: (): StudioStoreState => ({
      ...useWorkspaceStore.getState(),
      ...useStudioSpecificStore.getState(),
    }),
  }
);

export type { CanvasMode, SecondaryPanel };
