"use client";

import * as React from "react";
import { CheckCircle2, FileText, LayoutList, PenTool, Sparkles } from "lucide-react";

import { useActivePlanChangeSet } from "@/features/change-sets/hooks/use-active-plan-change-set";
import { planTasksFromChangeSet } from "@/features/change-sets/utils/plan-task-utils";
import {
  planStatusLabel,
  planStatusTone,
  PLAN_STATUS_STYLES,
  planTitleFromChangeSet,
} from "@/features/change-sets/utils/plan-workflow-ui";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { Button } from "@/components/ui/button";
import type { PlanCenterTab } from "@/features/studio/types/studio-types";
import { cn } from "@/lib/utils";

/** Left sidebar — compact plan task list (IDs + titles). Center panel shows full workbench. */
export function PlanTasksPanel() {
  const selectedRepositoryId = useStudioStore((s) => s.selectedRepositoryId);
  const focusSidebar = useStudioStore((s) => s.focusSidebar);
  const planCenterTab = useStudioStore((s) => s.planCenterTab);
  const selectedPlanTaskId = useStudioStore((s) => s.selectedPlanTaskId);
  const setPlanCenterView = useStudioStore((s) => s.setPlanCenterView);
  const { changeSet, isLoading, sessionId } = useActivePlanChangeSet();

  const selectView = React.useCallback(
    (tab: PlanCenterTab, taskId: string | null = null) => {
      setPlanCenterView(tab, taskId);
    },
    [setPlanCenterView],
  );

  if (!selectedRepositoryId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <p className="text-sm text-[#8B949E]">Select a repository to view plan tasks.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-[#8B949E]">Loading plan…</div>
    );
  }

  if (!changeSet || !sessionId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/25">
          <PenTool className="h-6 w-6 text-violet-300" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#E6EDF3]">No plan yet</p>
          <p className="mt-1 text-xs leading-relaxed text-[#8B949E]">
            Generate a plan in chat, then pick tasks here.
          </p>
        </div>
        <Button size="sm" variant="outline" className="border-[#2A3142] text-xs" onClick={() => focusSidebar("sessions")}>
          Open chat
        </Button>
      </div>
    );
  }

  const tasks = planTasksFromChangeSet(changeSet);
  const title = planTitleFromChangeSet(changeSet.plan_json?.summary);
  const tone = planStatusTone(changeSet.status);
  const statusStyles = PLAN_STATUS_STYLES[tone];

  const navItems: { id: PlanCenterTab | "task"; tab: PlanCenterTab; taskId?: string; label: string; sub?: string; icon: React.ElementType }[] = [
    { id: "overview", tab: "overview", label: "Overview", sub: title, icon: Sparkles },
    ...tasks.map((task) => ({
      id: "task" as const,
      tab: "steps" as PlanCenterTab,
      taskId: task.id,
      label: task.id,
      sub: task.title,
      icon: task.done ? CheckCircle2 : LayoutList,
    })),
    { id: "document", tab: "document", label: "Document", sub: "Full plan markdown", icon: FileText },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="plan-tasks-sidebar">
      <div className="shrink-0 border-b border-[#1E212B] px-3 py-2.5">
        <p className="truncate text-xs font-semibold text-[#E6EDF3]" title={title}>
          {title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ring-inset",
              statusStyles.badge,
            )}
          >
            {planStatusLabel(changeSet.status)}
          </span>
          <span className="text-[10px] text-[#6E7681]">v{changeSet.plan_version}</span>
          <span className="text-[10px] text-[#6E7681]">· {tasks.length} tasks</span>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto py-1">
        {navItems.map((item) => {
          const isOverview = item.tab === "overview" && item.id === "overview";
          const isDocument = item.tab === "document";
          const isTask = item.id === "task";
          const active =
            (isOverview && planCenterTab === "overview") ||
            (isDocument && planCenterTab === "document") ||
            (isTask && planCenterTab === "steps" && selectedPlanTaskId === item.taskId);

          return (
            <button
              key={isTask ? `task-${item.taskId}` : item.id}
              type="button"
              onClick={() => selectView(item.tab, isTask ? item.taskId ?? null : null)}
              className={cn(
                "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors",
                active
                  ? "bg-violet-500/15 text-violet-100"
                  : "text-[#C9D1D9] hover:bg-[#1A1C23]",
              )}
              data-testid={isTask ? `plan-task-nav-${item.taskId}` : `plan-nav-${item.id}`}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                  active ? "bg-violet-500/25 text-violet-200" : "bg-[#1A1C23] text-[#8B949E]",
                )}
              >
                {isTask ? (
                  item.label
                ) : (
                  <item.icon className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium">
                  {isTask ? item.sub : item.label}
                </span>
                {!isTask && item.sub && (
                  <span className="mt-0.5 block truncate text-[10px] text-[#6E7681]">{item.sub}</span>
                )}
              </span>
              {isTask && item.icon === CheckCircle2 && (
                <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
