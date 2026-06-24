import type { PrimarySidebar } from "../types/studio-types";

/** Sidebars that keep chat in the main area until a file/patch is opened. */
export const CHAT_WORKFLOW_PANELS: PrimarySidebar[] = ["sessions"];

export function isChatWorkflowPanel(panel: PrimarySidebar): boolean {
  return CHAT_WORKFLOW_PANELS.includes(panel);
}

/** Dedicated plan UI lives in the left sidebar — not the chat split dock. */
export function isDedicatedPlanSidebar(panel: PrimarySidebar): boolean {
  return panel === "tasks";
}
