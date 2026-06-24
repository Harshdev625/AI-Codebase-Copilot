"use client";

import { ChevronUp, FileText, PanelLeft, PenTool } from "lucide-react";

import type { ChangeSet } from "@/features/change-sets/types/change-set-types";
import {
  planStatusLabel,
  planStatusTone,
  PLAN_STATUS_STYLES,
  planTitleFromChangeSet,
} from "@/features/change-sets/utils/plan-workflow-ui";
import { PlanWorkflowStepper } from "@/features/studio/components/plan-workflow-stepper";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { cn } from "@/lib/utils";

interface PlanCollapsedBarProps {
  changeSet: ChangeSet;
  onExpand: () => void;
  onOpenPlan?: () => void;
}

export function PlanCollapsedBar({ changeSet, onExpand, onOpenPlan }: PlanCollapsedBarProps) {
  const focusSidebar = useStudioStore((s) => s.focusSidebar);
  const tone = planStatusTone(changeSet.status);
  const styles = PLAN_STATUS_STYLES[tone];
  const title = planTitleFromChangeSet(changeSet.plan_json?.summary);
  const stepCount = changeSet.plan_json?.steps?.length ?? 0;

  return (
    <div
      className="group shrink-0 border-b border-violet-500/20 bg-[#0D0F14] px-3 py-2 sm:px-4"
      data-testid="plan-collapsed-bar"
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25 sm:h-9 sm:w-9 sm:rounded-xl">
            <PenTool className="h-3.5 w-3.5 text-violet-300 sm:h-4 sm:w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-[#E6EDF3]">{title}</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                  styles.badge,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
                {planStatusLabel(changeSet.status)}
              </span>
            </div>
            <p className="text-[11px] text-[#8B949E]">
              v{changeSet.plan_version}
              {stepCount > 0 ? ` · ${stepCount} steps` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {changeSet.plan_file_path && onOpenPlan && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-[#2A3142] bg-[#151820] text-xs hover:bg-[#1C2333]"
              onClick={onOpenPlan}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">File</span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="hidden h-8 gap-1 border-[#2A3142] bg-[#151820] text-xs md:inline-flex"
            onClick={() => {
              useStudioStore.getState().setWorkbenchCenter("chat");
              focusSidebar("tasks");
            }}
          >
            <PanelLeft className="h-3.5 w-3.5" />
            Tasks
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1 bg-violet-600 text-xs hover:bg-violet-500"
            onClick={onExpand}
          >
            <ChevronUp className="h-3.5 w-3.5" />
            Review
          </Button>
        </div>
      </div>

      <div className="mt-2 hidden sm:block">
        <PlanWorkflowStepper status={changeSet.status} compact />
      </div>
    </div>
  );
}
