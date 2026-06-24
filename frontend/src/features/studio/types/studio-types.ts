/**
 * Canonical type definitions for Studio V2 workbench.
 */

export type EditorTabKind = "welcome" | "file" | "patch";

export type MarkdownViewMode = "source" | "preview" | "split";

export interface EditorSearchHighlight {
  query?: string;
  column?: number;
  snippet?: string;
}

export interface EditorTab {
  id: string;
  kind: EditorTabKind;
  title: string;
  filePath?: string;
  initialLine?: number;
  initialEndLine?: number;
  commitSha?: string;
  searchHighlight?: EditorSearchHighlight;
  patchId?: string;
  viewMode?: MarkdownViewMode;
}

/** Activity bar sidebar views. */
export type PrimarySidebar =
  | "sessions"
  | "plan"
  | "explorer"
  | "search"
  | "snapshots"
  | "patches"
  | "tasks";

export type MobileStudioTab = "editor" | "files" | "ai";

export type StudioDensity = "comfortable" | "compact";

export type WorkbenchCenter = "chat" | "editor";

/** Active tab in the center plan workbench. */
export type PlanCenterTab = "overview" | "steps" | "document";

export const WELCOME_TAB_ID = "welcome";

export const MAX_EDITOR_TABS = 15;
