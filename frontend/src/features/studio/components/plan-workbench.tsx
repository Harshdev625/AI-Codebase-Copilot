"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  FlaskConical,
  LayoutList,
  Loader2,
  Minimize2,
  Play,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useApprovePlanMutation,
  useRevisePlanMutation,
  useRollbackChangeSetMutation,
  useStartActMutation,
} from "@/features/change-sets/hooks/use-change-sets";
import type { ChangeSet, PlanStep } from "@/features/change-sets/types/change-set-types";
import {
  planStatusLabel,
  planStatusTone,
  PLAN_STATUS_STYLES,
  planTitleFromChangeSet,
} from "@/features/change-sets/utils/plan-workflow-ui";
import { stripPlanJsonBlock } from "@/features/change-sets/utils/plan-display-utils";
import { enrichPlanJson } from "@/features/change-sets/utils/plan-task-utils";
import { PlanWorkflowStepper } from "@/features/studio/components/plan-workflow-stepper";
import { FileIcon } from "@/features/studio/components/file-icon";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { useToast } from "@/components/shared/toast-provider";
import { ApiError } from "@/core/api/types";
import { repositoryService } from "@/features/repositories/services/repository-service";
import { cn } from "@/lib/utils";

type PlanTab = "overview" | "steps" | "document";

const TAB_HINTS: Record<PlanTab, string> = {
  overview: "Summary, risks, and quick preview before you approve.",
  steps: "Numbered tasks the AI will execute when you run Act mode.",
  document: "Full plan markdown saved in your repo (editable like a .md file).",
};

const PROSE = cn(
  "prose prose-sm dark:prose-invert max-w-none",
  "prose-headings:text-[#E6EDF3] prose-p:text-[#B6C0CC] prose-li:text-[#B6C0CC]",
  "prose-code:text-violet-300 prose-code:bg-violet-500/10 prose-code:rounded prose-code:px-1",
  "prose-code:before:content-none prose-code:after:content-none",
);

function StepProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
      <svg className="-rotate-90" width="44" height="44" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" stroke="#252B3A" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#8B5CF6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-violet-200">{total > 0 ? `${done}/${total}` : "—"}</span>
    </div>
  );
}

function PlanStepCard({
  step,
  onFileClick,
  onTaskClick,
  highlighted,
}: {
  step: PlanStep;
  onFileClick: (path: string) => void;
  onTaskClick?: (path: string) => void;
  highlighted?: boolean;
}) {
  return (
    <li
      className={cn(
        "group rounded-xl border border-[#252B3A] bg-gradient-to-br from-[#141820] to-[#101319] p-3 transition-colors hover:border-violet-500/25",
        highlighted && "border-violet-500/50 ring-1 ring-violet-500/30",
      )}
      data-testid={`plan-step-${step.id}`}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
            step.done
              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
              : "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25",
          )}
        >
          {step.done ? <CheckCircle2 className="h-4 w-4" /> : step.id}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#E6EDF3]">{step.title}</p>
          {step.description && step.description !== step.title && (
            <p className="mt-1 text-xs leading-relaxed text-[#8B949E]">{step.description}</p>
          )}
          {step.task_file_path && onTaskClick && (
            <button
              type="button"
              onClick={() => onTaskClick(step.task_file_path!)}
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-violet-400 hover:text-violet-300"
            >
              <FileText className="h-3 w-3" />
              Open task file
            </button>
          )}
          {step.files?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {step.files.map((file) => (
                <button
                  key={file}
                  type="button"
                  onClick={() => onFileClick(file)}
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#2A3142] bg-[#0B0D14]/80 px-2 py-1 text-[10px] font-mono text-violet-300/90 transition-colors hover:border-violet-500/40 hover:bg-violet-500/10"
                >
                  <FileIcon path={file} className="h-3 w-3 shrink-0 opacity-80" />
                  <span className="truncate">{file.split("/").pop() || file}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function usePlanDocument(repositoryId: string | undefined, planFilePath: string | null | undefined, fallbackMarkdown: string) {
  const [content, setContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!repositoryId || !planFilePath) {
      setContent(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    repositoryService
      .getFileContent(repositoryId, planFilePath)
      .then((res) => {
        if (!cancelled) setContent(res.content);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load plan file");
          setContent(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repositoryId, planFilePath]);

  const markdown = content ?? stripPlanJsonBlock(fallbackMarkdown);
  return { markdown, loading, error, fromFile: Boolean(content) };
}

export interface PlanWorkbenchProps {
  changeSet: ChangeSet;
  repositoryId?: string;
  variant?: "split" | "sidebar" | "compact" | "center";
  onClose?: () => void;
  activeTab?: PlanTab;
  onActiveTabChange?: (tab: PlanTab) => void;
  highlightStepId?: string | null;
}

export function PlanWorkbench({
  changeSet,
  repositoryId,
  variant = "split",
  onClose,
  activeTab: controlledTab,
  onActiveTabChange,
  highlightStepId,
}: PlanWorkbenchProps) {
  const toast = useToast();
  const openFileTab = useStudioStore((s) => s.openFileTab);
  const openPatchTab = useStudioStore((s) => s.openPatchTab);
  const [internalTab, setInternalTab] = React.useState<PlanTab>("overview");
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = React.useCallback(
    (tab: PlanTab) => {
      if (onActiveTabChange) onActiveTabChange(tab);
      else setInternalTab(tab);
    },
    [onActiveTabChange],
  );
  const [feedback, setFeedback] = React.useState("");

  const approveMutation = useApprovePlanMutation();
  const reviseMutation = useRevisePlanMutation();
  const actMutation = useStartActMutation();
  const rollbackMutation = useRollbackChangeSetMutation();

  const planJson = React.useMemo(
    () => enrichPlanJson(changeSet.plan_json, changeSet.plan_markdown),
    [changeSet.plan_json, changeSet.plan_markdown],
  );
  const steps = planJson.steps ?? [];
  const doneSteps = steps.filter((s) => s.done).length;
  const canApprove = changeSet.status === "PLAN_READY";
  const canAct =
    changeSet.status === "PLAN_APPROVED" ||
    (changeSet.status === "PATCH_REJECTED" && !changeSet.patch_id);
  const canUndo = changeSet.status === "APPLIED";
  const planFilePath = changeSet.plan_file_path;
  const [showRevision, setShowRevision] = React.useState(canApprove);
  const isBusy =
    approveMutation.isPending ||
    reviseMutation.isPending ||
    actMutation.isPending ||
    rollbackMutation.isPending;

  const tone = planStatusTone(changeSet.status);
  const statusStyles = PLAN_STATUS_STYLES[tone];
  const title = planTitleFromChangeSet(planJson.summary);
  const architecture = planJson.architecture?.trim();

  const { markdown: documentMarkdown, loading: docLoading, error: docError } = usePlanDocument(
    repositoryId,
    planFilePath,
    changeSet.plan_markdown ?? "",
  );

  const isCompact = variant === "compact";
  const isCenter = variant === "center";
  const rootClass = cn(
    "flex flex-col overflow-hidden bg-[#0B0D14]",
    isCenter
      ? "h-full min-h-0"
      : variant === "split" || variant === "sidebar"
        ? "h-full min-h-0 border-r border-violet-500/15"
        : "max-h-[min(52vh,520px)] min-h-[280px] border-b border-violet-500/20",
  );

  React.useEffect(() => {
    if (!highlightStepId || activeTab !== "steps") return;
    const el = document.querySelector(`[data-testid="plan-step-${highlightStepId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlightStepId, activeTab]);

  const handleOpenPlanFile = React.useCallback(() => {
    if (!planFilePath) {
      toast.info("Plan file unavailable", "Regenerate the plan or check that the repo cache exists.");
      return;
    }
    openFileTab(planFilePath);
  }, [planFilePath, openFileTab, toast]);

  const handleFileClick = React.useCallback((path: string) => openFileTab(path), [openFileTab]);

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync(changeSet.id);
      toast.success("Plan approved", "Switch to Act mode or click Start Act to generate the patch.");
    } catch (err) {
      toast.error("Approve failed", err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleRevise = async () => {
    if (!feedback.trim()) return;
    try {
      await reviseMutation.mutateAsync({ changeSetId: changeSet.id, feedback: feedback.trim() });
      setFeedback("");
      setShowRevision(false);
      toast.success("Plan revised", "A new plan version has been generated.");
    } catch (err) {
      toast.error("Revise failed", err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleAct = async () => {
    try {
      const updated = await actMutation.mutateAsync(changeSet.id);
      if (updated.patch_id) openPatchTab(updated.patch_id, "Patch review");
      if (updated.status === "PATCH_APPROVED") {
        toast.success("Patch ready", "Review and apply from the patch tab.");
      } else if (updated.status === "PATCH_REJECTED") {
        toast.error("Validation failed", "Revise the plan or retry Act after fixing issues.");
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      toast.error("Act failed", message);
    }
  };

  const handleRollback = async () => {
    try {
      await rollbackMutation.mutateAsync(changeSet.id);
      toast.success("Changes undone", "Workspace restored to pre-apply state.");
    } catch (err) {
      toast.error("Rollback failed", err instanceof Error ? err.message : "Unknown error");
    }
  };

  const tabs: { id: PlanTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "steps", label: "Steps", count: steps.length || undefined },
    { id: "document", label: "Document" },
  ];

  return (
    <div className={rootClass} data-testid="plan-workbench">
      <div className="relative shrink-0 overflow-hidden border-b border-[#1E212B] px-4 py-3">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-600/12 via-fuchsia-600/5 to-transparent" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {!isCompact && steps.length > 0 && <StepProgressRing done={doneSteps} total={steps.length} />}
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl bg-violet-500/20 ring-1 ring-violet-400/30",
                isCompact ? "h-10 w-10" : steps.length > 0 ? "hidden" : "h-10 w-10",
              )}
            >
              <Sparkles className="h-5 w-5 text-violet-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400/90">Plan</p>
              <h2 className="truncate text-base font-semibold text-[#F0F3F8]">{title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                    statusStyles.badge,
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", statusStyles.dot)} />
                  {planStatusLabel(changeSet.status)}
                </span>
                <span className="text-[11px] text-[#6E7681]">v{changeSet.plan_version}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {planFilePath && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-[#2A3142] bg-[#151820] text-xs hover:border-violet-500/40"
                onClick={handleOpenPlanFile}
                data-testid="plan-open-file-btn"
              >
                <FileText className="h-3.5 w-3.5" />
                {!isCompact && "Editor"}
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#8B949E] hover:text-[#C9D1D9]"
                onClick={onClose}
                title="Minimize plan"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="relative mt-3 hidden sm:block">
          <PlanWorkflowStepper status={changeSet.status} compact={isCompact} />
        </div>

        <div className="relative mt-3 flex gap-1 rounded-lg bg-[#0F1117]/80 p-1 ring-1 ring-[#252B3A]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              title={TAB_HINTS[tab.id]}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-violet-600/25 text-violet-100 shadow-sm ring-1 ring-violet-500/30"
                  : "text-[#8B949E] hover:bg-[#1A1C23] hover:text-[#C9D1D9]",
              )}
            >
              {tab.id === "steps" && <LayoutList className="h-3 w-3" />}
              {tab.id === "document" && <FileText className="h-3 w-3" />}
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="rounded-full bg-violet-500/20 px-1.5 text-[10px] text-violet-200">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
        <p className="relative mt-2 text-[10px] leading-relaxed text-[#6E7681]">{TAB_HINTS[activeTab]}</p>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {activeTab === "overview" && (
          <div className="space-y-3 p-4">
            {planFilePath && (
              <button
                type="button"
                onClick={handleOpenPlanFile}
                className="flex w-full flex-col gap-2 rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-[#12151C] p-4 text-left transition-all hover:border-violet-400/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.12)]"
              >
                <div className="flex items-center gap-2 text-violet-300">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Plan document</span>
                </div>
                <p className="font-mono text-xs text-[#C9D1D9]">{planFilePath}</p>
                <p className="flex items-center gap-1 text-[11px] text-[#8B949E]">
                  <ExternalLink className="h-3 w-3" />
                  Saved in workspace — open in editor to edit like Cursor
                </p>
              </button>
            )}

            {planJson.summary && (
              <div className="rounded-xl border border-[#252B3A] bg-[#101319] p-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6E7681]">Summary</p>
                <p className="text-sm leading-relaxed text-[#C9D1D9]">{planJson.summary}</p>
              </div>
            )}

            {architecture && (
              <div className="rounded-xl border border-[#252B3A] bg-[#101319] p-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#6E7681]">Architecture</p>
                <div className={cn(PROSE, "text-xs")}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{architecture}</ReactMarkdown>
                </div>
              </div>
            )}

            {planJson.risks && planJson.risks.length > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Risks
                </p>
                <ul className="space-y-1">
                  {planJson.risks.map((r) => (
                    <li key={r} className="text-xs leading-relaxed text-amber-100/80">
                      • {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {planJson.testing_strategy && planJson.testing_strategy.length > 0 && (
              <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-400">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Testing
                </p>
                <ul className="space-y-1">
                  {planJson.testing_strategy.map((t) => (
                    <li key={t} className="text-xs leading-relaxed text-sky-100/80">
                      • {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {steps.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6E7681]">
                  Quick preview · {steps.length} steps
                </p>
                <ul className="space-y-2">
                  {steps.slice(0, 3).map((step) => (
                    <PlanStepCard
                      key={step.id}
                      step={step}
                      onFileClick={handleFileClick}
                      onTaskClick={handleFileClick}
                    />
                  ))}
                </ul>
                {steps.length > 3 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto p-0 text-violet-400"
                    onClick={() => setActiveTab("steps")}
                  >
                    View all {steps.length} steps →
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "steps" && (
          <div className="p-4">
            {steps.length > 0 ? (
              <ul className="space-y-2">
                {steps.map((step) => (
                  <PlanStepCard
                    key={step.id}
                    step={step}
                    onFileClick={handleFileClick}
                    onTaskClick={handleFileClick}
                    highlighted={highlightStepId === step.id}
                  />
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-[#2A3142] bg-[#101319]/50 px-4 py-10 text-center">
                <LayoutList className="mx-auto mb-2 h-8 w-8 text-[#484F58]" />
                <p className="text-sm font-medium text-[#C9D1D9]">No structured steps yet</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[#8B949E]">
                  Open the <button type="button" className="text-violet-400 hover:underline" onClick={() => setActiveTab("document")}>Document</button> tab to read the full plan, or use <strong className="font-medium text-[#C9D1D9]">Request changes</strong> below to ask the AI to revise it with numbered steps.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "document" && (
          <div className="p-4">
            {docLoading && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#8B949E]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading plan document…
              </div>
            )}
            {docError && !docLoading && (
              <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                Could not load file — showing cached markdown. {docError}
              </p>
            )}
            {!docLoading && documentMarkdown && (
              <div className={cn("rounded-xl border border-[#252B3A] bg-[#101319] p-4", PROSE)}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{documentMarkdown}</ReactMarkdown>
              </div>
            )}
            {!docLoading && !documentMarkdown && (
              <p className="py-8 text-center text-sm text-[#8B949E]">No plan document content yet.</p>
            )}
          </div>
        )}

        {(canApprove || changeSet.status === "PLAN_APPROVED") && (
          <div className="border-t border-[#1E212B] px-4 py-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6E7681]">
              Request changes
            </p>
            <button
              type="button"
              onClick={() => setShowRevision((v) => !v)}
              className="flex w-full items-center justify-between py-1 text-xs font-medium text-[#C9D1D9] hover:text-white"
            >
              Tell the AI what to change in this plan
              <ChevronDown className={cn("h-4 w-4 transition-transform", showRevision && "rotate-180")} />
            </button>
            {showRevision && (
              <div className="pb-2 pt-2">
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Example: Add a step for dark mode CSS variables, split responsive work into separate tasks…"
                  className="min-h-[96px] resize-none border-[#2A3142] bg-[#0B0D14] text-sm focus-visible:ring-violet-500/40"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 border-violet-500/40 text-violet-200 hover:bg-violet-500/10"
                  disabled={!feedback.trim() || isBusy}
                  onClick={handleRevise}
                  data-testid="plan-revise-btn"
                >
                  {reviseMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Send revision request
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#1E212B] bg-[#0F1117]/95 px-4 py-3 backdrop-blur-sm">
        {canApprove && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="border-[#2A3142] text-xs"
              disabled={isBusy}
              onClick={() => setShowRevision(true)}
            >
              Request changes
            </Button>
            <Button
              size="sm"
              className="bg-violet-600 shadow-[0_0_16px_rgba(124,58,237,0.25)] hover:bg-violet-500"
              disabled={isBusy}
              onClick={handleApprove}
              data-testid="plan-approve-btn"
            >
            {approveMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Approve plan
          </Button>
          </>
        )}
        {canAct && (
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-500"
            disabled={isBusy}
            onClick={handleAct}
            data-testid="plan-start-act-btn"
          >
            {actMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Generating patch…
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Start Act
              </>
            )}
          </Button>
        )}
        {canAct && actMutation.isPending && (
          <span className="text-[10px] text-[#8B949E]">
            Ollama is generating the diff — may take several minutes on local models.
          </span>
        )}
        {changeSet.patch_id && changeSet.status === "PATCH_APPROVED" && (
          <Button
            size="sm"
            variant="outline"
            className="border-[#2A3142]"
            onClick={() => openPatchTab(changeSet.patch_id!, "Patch review")}
          >
            Open patch
          </Button>
        )}
        {changeSet.status === "PATCH_REJECTED" && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300 ring-1 ring-rose-500/25">
            <XCircle className="h-3.5 w-3.5" />
            Validation failed
          </span>
        )}
        {canUndo && (
          <Button
            size="sm"
            variant="outline"
            className="border-[#2A3142]"
            disabled={isBusy}
            onClick={handleRollback}
            data-testid="plan-rollback-btn"
          >
            {rollbackMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Undo apply
          </Button>
        )}
      </div>
    </div>
  );
}
