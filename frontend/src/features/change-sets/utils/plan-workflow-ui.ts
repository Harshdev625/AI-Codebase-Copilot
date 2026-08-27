import type { ChangeSetStatus } from "@/features/change-sets/types/change-set-types";

export type PlanWorkflowPhase = {
  id: string;
  label: string;
  shortLabel: string;
};

export const PLAN_WORKFLOW_PHASES: PlanWorkflowPhase[] = [
  { id: "plan", label: "Plan drafted", shortLabel: "Plan" },
  { id: "approved", label: "Plan approved", shortLabel: "Approved" },
  { id: "validated", label: "Patch validated", shortLabel: "Validated" },
  { id: "applied", label: "Changes applied", shortLabel: "Applied" },
];

export function planPhaseIndex(status: ChangeSetStatus): number {
  if (status === "PLANNING" || status === "PLAN_READY") return 0;
  if (status === "PLAN_APPROVED" || status === "ACTING") return 1;
  if (
    status === "PATCH_READY" ||
    status === "VALIDATING" ||
    status === "PATCH_APPROVED" ||
    status === "PATCH_REJECTED"
  ) {
    return 2;
  }
  if (status === "APPLIED" || status === "ROLLED_BACK") return 3;
  return 0;
}

export function planStatusLabel(status: ChangeSetStatus): string {
  switch (status) {
    case "PLANNING":
      return "Drafting";
    case "PLAN_READY":
      return "Awaiting review";
    case "PLAN_APPROVED":
      return "Ready to act";
    case "ACTING":
      return "Generating patch";
    case "PATCH_READY":
    case "VALIDATING":
      return "Validating";
    case "PATCH_APPROVED":
      return "Patch ready";
    case "PATCH_REJECTED":
      return "Validation failed";
    case "APPLIED":
      return "Applied";
    case "ROLLED_BACK":
      return "Rolled back";
    case "CANCELLED":
      return "Cancelled";
    default: {
      const label = String(status);
      return label.replace(/_/g, " ").toLowerCase();
    }
  }
}

export function planStatusTone(
  status: ChangeSetStatus,
): "purple" | "amber" | "emerald" | "rose" | "slate" {
  if (status === "PLAN_READY" || status === "PLANNING") return "purple";
  if (status === "PLAN_APPROVED" || status === "ACTING") return "amber";
  if (status === "PATCH_APPROVED" || status === "APPLIED") return "emerald";
  if (status === "PATCH_REJECTED" || status === "CANCELLED") return "rose";
  return "slate";
}

export const PLAN_STATUS_STYLES: Record<
  ReturnType<typeof planStatusTone>,
  { badge: string; dot: string; ring: string }
> = {
  purple: {
    badge: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
    dot: "bg-violet-400",
    ring: "ring-violet-500/40",
  },
  amber: {
    badge: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    dot: "bg-amber-400",
    ring: "ring-amber-500/40",
  },
  emerald: {
    badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    dot: "bg-emerald-400",
    ring: "ring-emerald-500/40",
  },
  rose: {
    badge: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    dot: "bg-rose-400",
    ring: "ring-rose-500/40",
  },
  slate: {
    badge: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
    dot: "bg-slate-400",
    ring: "ring-slate-500/40",
  },
};

export function planTitleFromChangeSet(summary?: string, fallback = "Implementation plan"): string {
  const trimmed = (summary ?? "").trim();
  if (!trimmed) return fallback;
  const firstSentence = trimmed.split(/[.!?]/)[0]?.trim();
  return firstSentence && firstSentence.length <= 80 ? firstSentence : trimmed.slice(0, 80);
}
