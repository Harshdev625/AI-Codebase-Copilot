"use client";

import { PenTool } from "lucide-react";

import { useActivePlanChangeSet } from "@/features/change-sets/hooks/use-active-plan-change-set";
import { PlanWorkbench } from "@/features/studio/components/plan-workbench";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { Button } from "@/components/ui/button";

export function PlanSidebarPanel() {
  const selectedRepositoryId = useStudioStore((s) => s.selectedRepositoryId);
  const focusSidebar = useStudioStore((s) => s.focusSidebar);
  const { changeSet, isLoading, sessionId } = useActivePlanChangeSet();

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-[#8B949E]">Loading plan…</div>
    );
  }

  if (!changeSet || !sessionId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/25">
          <PenTool className="h-7 w-7 text-violet-300" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#E6EDF3]">No active plan</p>
          <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-[#8B949E]">
            Switch to Plan mode in chat and describe the change you want. Your plan will appear here for review.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-violet-600 hover:bg-violet-500"
          onClick={() => focusSidebar("sessions")}
        >
          Open chat
        </Button>
      </div>
    );
  }

  return (
    <PlanWorkbench
      changeSet={changeSet}
      repositoryId={selectedRepositoryId ?? undefined}
      variant="sidebar"
    />
  );
}
