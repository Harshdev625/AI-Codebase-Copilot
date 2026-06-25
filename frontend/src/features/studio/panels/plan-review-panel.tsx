"use client";



import type { ChangeSet } from "@/features/change-sets/types/change-set-types";

import { PlanWorkbench } from "@/features/studio/components/plan-workbench";



export interface PlanReviewPanelProps {

  changeSet: ChangeSet;

  repositoryId?: string;

  onClose?: () => void;

}



/** Compact plan panel (AI dock). Prefer PlanWorkbench variant="split" in chat canvas. */

export function PlanReviewPanel({ changeSet, repositoryId, onClose }: PlanReviewPanelProps) {

  return (

    <PlanWorkbench

      changeSet={changeSet}

      repositoryId={repositoryId}

      variant="compact"

      onClose={onClose}

    />

  );

}

