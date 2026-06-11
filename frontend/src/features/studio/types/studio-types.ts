/**
 * Canonical type definitions for Unified Copilot Studio (Phase 1+).
 * Shared across store, components, and URL sync hook.
 */

/** Primary canvas rendering mode. Chat is the default (Phase 1); others activate in later phases. */
export type CanvasMode = "chat" | "editor" | "diff" | "patch-review";

/** Which secondary panel is visible in the studio left-sidebar. */
export type SecondaryPanel =
  | "explorer"
  | "search"
  | "snapshots"
  | "settings"
  | "sessions"
  | "tasks"
  | "patches"
  | null;
