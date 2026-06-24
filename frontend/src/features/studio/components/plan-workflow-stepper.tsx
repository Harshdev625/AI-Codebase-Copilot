"use client";

import { Check } from "lucide-react";

import {
  PLAN_WORKFLOW_PHASES,
  planPhaseIndex,
} from "@/features/change-sets/utils/plan-workflow-ui";
import type { ChangeSetStatus } from "@/features/change-sets/types/change-set-types";
import { cn } from "@/lib/utils";

interface PlanWorkflowStepperProps {
  status: ChangeSetStatus;
  compact?: boolean;
}

export function PlanWorkflowStepper({ status, compact = false }: PlanWorkflowStepperProps) {
  const activeIndex = planPhaseIndex(status);

  return (
    <div className={cn("flex w-full items-center", compact ? "gap-0.5" : "gap-1 px-1")}>
      {PLAN_WORKFLOW_PHASES.map((phase, idx) => {
        const done = idx < activeIndex;
        const active = idx === activeIndex;
        const upcoming = idx > activeIndex;

        return (
          <div key={phase.id} className="flex min-w-0 flex-1 items-center">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border transition-all duration-300",
                  compact ? "h-6 w-6" : "h-7 w-7",
                  done && "border-emerald-500/50 bg-emerald-500/20 text-emerald-300",
                  active && "border-violet-400/70 bg-violet-500/25 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.35)]",
                  upcoming && "border-[#2A3142] bg-[#151820] text-[#6E7681]",
                )}
              >
                {done ? (
                  <Check className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} strokeWidth={2.5} />
                ) : (
                  <span className={cn("font-semibold", compact ? "text-[10px]" : "text-[11px]")}>
                    {idx + 1}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "max-w-full truncate text-center font-medium",
                  compact ? "text-[9px]" : "text-[10px]",
                  active ? "text-violet-200" : done ? "text-emerald-400/90" : "text-[#6E7681]",
                )}
              >
                {phase.shortLabel}
              </span>
            </div>
            {idx < PLAN_WORKFLOW_PHASES.length - 1 && (
              <div
                className={cn(
                  "mx-0.5 h-px flex-1 rounded-full transition-colors duration-300",
                  compact ? "mb-4 max-w-[1.5rem]" : "mb-5",
                  idx < activeIndex ? "bg-emerald-500/50" : "bg-[#2A3142]",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
