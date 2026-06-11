"use client";

import * as React from "react";

import type { Repository } from "@/features/repositories/types/repository-types";

import { useStudioStore } from "../store/studio-store";
import { StudioCanvasChat } from "./studio-canvas-chat";
import { StudioCanvasEditor } from "./studio-canvas-editor";
import { StudioCanvasPatchReview } from "./studio-canvas-patch-review";

interface StudioCanvasProps {
  repositoryId?: string;
  repositories?: Repository[];
  isRepositoriesLoading?: boolean;
}

/**
 * Studio canvas — Mode router for all four canvas modes.
 *
 * chat         — Full AI chat workspace (Phase 1+)
 * editor       — Monaco file viewer, triggered from Explorer / Search (Phase 3)
 * diff         — Standalone diff view; falls back to patch-review when a patch
 *                is active, otherwise renders an empty state (Phase 3)
 * patch-review — Full patch lifecycle review with validate/apply actions (Phase 3)
 */
export function StudioCanvas({
  repositoryId,
  repositories = [],
  isRepositoriesLoading = false,
}: StudioCanvasProps) {
  const { canvasMode } = useStudioStore();

  switch (canvasMode) {
    case "editor":
      return <StudioCanvasEditor />;

    case "patch-review":
      return <StudioCanvasPatchReview />;

    case "diff":
      // 'diff' is a lightweight alias for patch-review in this architecture.
      // When the user triggers a diff (e.g. from a snapshot comparison), set
      // canvasMode='diff' and activePatchId; StudioCanvasPatchReview handles it.
      return <StudioCanvasPatchReview />;

    case "chat":
    default:
      return (
        <StudioCanvasChat
          repositoryId={repositoryId}
          repositories={repositories}
          isRepositoriesLoading={isRepositoriesLoading}
        />
      );
  }
}
