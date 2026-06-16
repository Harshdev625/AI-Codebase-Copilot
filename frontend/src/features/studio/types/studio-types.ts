/**
 * Canonical type definitions for Studio V2 workbench.
 */

export type EditorTabKind = "welcome" | "file" | "patch";

export type MarkdownViewMode = "source" | "preview" | "split";

export interface EditorTab {
  id: string;
  kind: EditorTabKind;
  title: string;
  filePath?: string;
  initialLine?: number;
  commitSha?: string;
  patchId?: string;
  viewMode?: MarkdownViewMode;
}

/** Activity bar sidebar views. */
export type PrimarySidebar =
  | "sessions"
  | "explorer"
  | "search"
  | "snapshots"
  | "patches"
  | "tasks";

/** @deprecated V1 canvas router — kept for URL compat during migration */
export type CanvasMode = "chat" | "editor" | "diff" | "patch-review";

export type MobileStudioTab = "editor" | "files" | "ai";

export type StudioDensity = "comfortable" | "compact";

export const WELCOME_TAB_ID = "welcome";

export const MAX_EDITOR_TABS = 15;
