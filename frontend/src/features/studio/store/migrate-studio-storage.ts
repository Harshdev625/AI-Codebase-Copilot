/**
 * Studio persist schema v2 migration.
 *
 * v1 keys (studio-storage): canvasMode, secondaryPanel, primarySidebar (incl. sessions/settings)
 * v2 keys (studio-storage-v2): editorTabs, aiPanelOpen, primarySidebar (explorer-first)
 *
 * URL compatibility:
 *   repository_id → selectedRepositoryId
 *   session_id    → activeSessionId + aiPanelOpen=true
 *   ai=open       → aiPanelOpen=true
 *   panel=explorer|search|... → primarySidebar
 *   view=editor|patch-review → open corresponding tab (legacy)
 *   file=path     → open file tab
 *   patch_id=     → open patch tab
 */

import type { EditorTab, MarkdownViewMode, MobileStudioTab, PrimarySidebar } from "../types/studio-types";
import { WELCOME_TAB_ID } from "../types/studio-types";

export const STUDIO_STORAGE_V2_KEY = "studio-storage-v2";

export interface StudioPersistV1 {
  selectedRepositoryId?: string | null;
  activeSessionId?: string | null;
  canvasMode?: string;
  secondaryPanel?: string | null;
  primarySidebar?: string;
  contextPanelOpen?: boolean;
  editorWordWrap?: boolean;
  editorMinimap?: boolean;
}

export interface StudioPersistV2 {
  version: 2;
  selectedRepositoryId: string | null;
  activeSessionId: string | null;
  activePatchId: string | null;
  selectedSnapshotId: string | null;
  primarySidebar: PrimarySidebar;
  aiPanelOpen: boolean;
  sidebarCollapsed: boolean;
  settingsOpen: boolean;
  editorTabs: EditorTab[];
  activeTabId: string;
  editorWordWrap: boolean;
  editorMinimap: boolean;
  defaultMarkdownView: MarkdownViewMode;
  density: "comfortable" | "compact";
  mobileTab: MobileStudioTab;
}

const VALID_SIDEBARS: PrimarySidebar[] = [
  "sessions",
  "explorer",
  "search",
  "snapshots",
  "patches",
  "tasks",
];

function normalizeSidebar(raw?: string): PrimarySidebar {
  if (raw && VALID_SIDEBARS.includes(raw as PrimarySidebar)) {
    return raw as PrimarySidebar;
  }
  if (raw === "settings") {
    return "explorer";
  }
  return "explorer";
}

function hasOnlyWelcomeTab(tabs: EditorTab[]): boolean {
  return tabs.length === 1 && tabs[0]?.id === WELCOME_TAB_ID;
}

/** Migrate chat-first idle layout to explorer-first without disturbing active chats. */
export function migrateExplorerFirstIfIdle(state: StudioPersistV2): StudioPersistV2 {
  if (
    state.primarySidebar === "sessions" &&
    !state.activeSessionId &&
    hasOnlyWelcomeTab(state.editorTabs)
  ) {
    return {
      ...state,
      primarySidebar: "explorer",
      aiPanelOpen: false,
    };
  }
  return state;
}

export function createDefaultPersistV2(): StudioPersistV2 {
  return {
    version: 2,
    selectedRepositoryId: null,
    activeSessionId: null,
    activePatchId: null,
    selectedSnapshotId: null,
    primarySidebar: "explorer",
    aiPanelOpen: false,
    sidebarCollapsed: false,
    settingsOpen: false,
    editorTabs: [{ id: WELCOME_TAB_ID, kind: "welcome", title: "Welcome" }],
    activeTabId: WELCOME_TAB_ID,
    editorWordWrap: true,
    editorMinimap: false,
    defaultMarkdownView: "source",
    density: "comfortable",
    mobileTab: "files",
  };
}

export function migrateV1ToV2(v1: StudioPersistV1): StudioPersistV2 {
  const base = createDefaultPersistV2();

  base.selectedRepositoryId = v1.selectedRepositoryId ?? null;
  base.activeSessionId = v1.activeSessionId ?? null;
  base.primarySidebar = normalizeSidebar(v1.primarySidebar);
  base.editorWordWrap = v1.editorWordWrap ?? true;
  base.editorMinimap = v1.editorMinimap ?? false;

  if (v1.activeSessionId) {
    base.aiPanelOpen = true;
  }

  if (v1.canvasMode === "editor") {
    base.editorTabs = [{ id: WELCOME_TAB_ID, kind: "welcome", title: "Welcome" }];
    base.activeTabId = WELCOME_TAB_ID;
  }

  return base;
}

export function parsePersistV2(raw: string | null): StudioPersistV2 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const state = parsed?.state ?? parsed;
    if (state?.version === 2) {
      const v2 = {
        ...createDefaultPersistV2(),
        ...state,
        mobileTab: state.mobileTab ?? "files",
      } as StudioPersistV2;
      return migrateExplorerFirstIfIdle(v2);
    }
    return migrateExplorerFirstIfIdle(migrateV1ToV2(state as StudioPersistV1));
  } catch {
    return null;
  }
}
