"use client";

import * as React from "react";
import { PenTool } from "lucide-react";

import { useActivePlanChangeSet } from "@/features/change-sets/hooks/use-active-plan-change-set";
import { PlanWorkbench } from "@/features/studio/components/plan-workbench";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { Button } from "@/components/ui/button";
import type { PlanCenterTab } from "@/features/studio/types/studio-types";

/** Center panel — full plan workbench (overview, steps, document, approve). */
export function PlanCenterPanel() {
  const selectedRepositoryId = useStudioStore((s) => s.selectedRepositoryId);
  const focusSidebar = useStudioStore((s) => s.focusSidebar);
  const planCenterTab = useStudioStore((s) => s.planCenterTab);
  const selectedPlanTaskId = useStudioStore((s) => s.selectedPlanTaskId);
  const setPlanCenterView = useStudioStore((s) => s.setPlanCenterView);
  const { changeSet, isLoading, sessionId } = useActivePlanChangeSet();

  React.useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7863/ingest/e55e1c64-8993-4a79-98e7-53d0e4bd1d58", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "16bbe5" },
      body: JSON.stringify({
        sessionId: "16bbe5",
        hypothesisId: "H2",
        location: "plan-center-panel.tsx:mount",
        message: "plan center render",
        data: {
          hasChangeSet: Boolean(changeSet?.id),
          planCenterTab,
          selectedPlanTaskId,
          isLoading,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [changeSet?.id, planCenterTab, selectedPlanTaskId, isLoading]);

  if (!selectedRepositoryId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-sm text-[#8B949E]">Select a repository to view the plan.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#8B949E]">Loading plan…</div>
    );
  }

  if (!changeSet || !sessionId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/25">
          <PenTool className="h-8 w-8 text-violet-300" />
        </div>
        <div>
          <p className="text-base font-semibold text-[#E6EDF3]">No plan yet</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[#8B949E]">
            Use Plan mode in chat to generate a plan. It will appear here for review and approval.
          </p>
        </div>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-500" onClick={() => focusSidebar("sessions")}>
          Open chat
        </Button>
      </div>
    );
  }

  const handleTabChange = (tab: PlanCenterTab) => {
    setPlanCenterView(tab, tab === "steps" ? selectedPlanTaskId : null);
  };

  return (
    <PlanWorkbench
      changeSet={changeSet}
      repositoryId={selectedRepositoryId}
      variant="center"
      activeTab={planCenterTab}
      onActiveTabChange={handleTabChange}
      highlightStepId={selectedPlanTaskId}
    />
  );
}
