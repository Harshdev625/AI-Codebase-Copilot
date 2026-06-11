"use client";

import * as React from "react";
import { GitBranch } from "lucide-react";

import { PatchReviewEditor } from "@/features/studio/panels/patch-review-editor";

import { useStudioStore } from "../store/studio-store";
import { StudioCanvasEmptyState } from "./studio-canvas-editor";

/**
 * Patch-review canvas mode (canvasMode === 'patch-review').
 * Reads activePatchId from useStudioStore and renders PatchReviewEditor.
 * Closing returns to chat mode via setCanvasMode('chat').
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
