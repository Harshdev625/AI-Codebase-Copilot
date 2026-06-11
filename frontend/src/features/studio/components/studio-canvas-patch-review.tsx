"use client";

import * as React from "react";
import { GitBranch } from "lucide-react";

import { PatchReviewEditor } from "@/features/workspace/components/patch-review-editor";

import { useStudioStore } from "../store/studio-store";
import { StudioCanvasEmptyState } from "./studio-canvas-editor";

/**
 * Phase 3 — Patch-review canvas mode.
 *
 * Activated when canvasMode === 'patch-review'.
 * Reads activePatchId from the studio store (proxied from useWorkspaceStore).
 * Renders the existing PatchReviewEditor with an onClose override so that
 * closing/deleting a patch returns to 'chat' mode instead of calling closeTab.
 *
 * /workspace is not affected — PatchReviewEditor's onClose is optional and
 * defaults to the original closeTab behaviour when not provided.
 */
export function StudioCanvasPatchReview() {
  const { activePatchId, setActivePatchId, setCanvasMode } = useStudioStore();

  const handleClose = React.useCallback(() => {
    setActivePatchId(null);
    setCanvasMode("chat");
  }, [setActivePatchId, setCanvasMode]);

  if (!activePatchId) {
    return (
      <StudioCanvasEmptyState
        icon={<GitBranch className="w-8 h-8 text-[#8B949E]" />}
        title="No patch selected"
        description="Select a patch from the Patches panel to review it here."
        onBack={() => setCanvasMode("chat")}
      />
    );
  }

  return (
    <div className="flex-1 h-full overflow-hidden">
      <PatchReviewEditor patchId={activePatchId} onClose={handleClose} />
    </div>
  );
}
