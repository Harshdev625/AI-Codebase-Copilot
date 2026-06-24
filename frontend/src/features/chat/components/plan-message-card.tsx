"use client";

import { ListTodo } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { cn } from "@/lib/utils";

interface PlanMessageCardProps {
  summary?: string | null;
  planVersion?: number;
  stepCount?: number;
  status?: string;
}

export function PlanMessageCard({ summary, planVersion, stepCount, status }: PlanMessageCardProps) {
  const focusSidebar = useStudioStore((s) => s.focusSidebar);
  const setPlanCenterView = useStudioStore((s) => s.setPlanCenterView);

  const handleViewPlan = () => {
    setPlanCenterView("overview", null);
    focusSidebar("tasks");
  };

  const title = summary?.trim() || "Implementation plan ready";
  const statusLabel =
    status === "PLAN_APPROVED"
      ? "Approved"
      : status === "PLAN_READY"
        ? "Awaiting review"
        : status?.replace(/_/g, " ").toLowerCase() ?? "Ready";

  return (
    <div
      className={cn(
        "my-2 overflow-hidden rounded-xl border border-violet-500/30",
        "bg-gradient-to-br from-violet-500/10 via-[#12151C] to-[#0B0D14]",
      )}
    >
      <div className="flex items-start gap-3 p-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 ring-1 ring-violet-400/25">
          <ListTodo className="h-4 w-4 text-violet-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#E6EDF3]">{title}</p>
          <p className="mt-1 text-xs text-[#8B949E]">
            {planVersion ? `Version ${planVersion}` : "Plan"}
            {stepCount != null && stepCount > 0 ? ` · ${stepCount} steps` : ""}
            {" · "}
            <span className="capitalize text-violet-300/90">{statusLabel}</span>
          </p>
        </div>
      </div>
      <div className="border-t border-violet-500/15 bg-black/20 px-3 py-2">
        <Button
          type="button"
          size="sm"
          className="h-8 w-full bg-violet-600 text-xs hover:bg-violet-500"
          onClick={handleViewPlan}
        >
          View plan
        </Button>
      </div>
    </div>
  );
}
