import type { ChangeSet, PlanJson, PlanStep, PlanTaskFile } from "@/features/change-sets/types/change-set-types";

const SKIP_HEADINGS = new Set([
  "summary",
  "architecture",
  "affected files",
  "implementation steps",
  "risks",
  "testing strategy",
  "details",
  "machine-readable plan",
  "description",
  "checklist",
  "files to modify",
  "plan",
]);

function deriveTaskPath(changeSet: ChangeSet, stepId: string): string {
  const csShort = changeSet.id.slice(0, 8);
  const safeId = String(stepId).replace(/[^\w-]/g, "-") || "step";
  return `.aicc/plans/tasks/${csShort}-v${changeSet.plan_version}/task-${safeId}.md`;
}

/** Derive steps from prose markdown when plan_json.steps is empty (matches backend enrich). */
export function inferStepsFromMarkdown(markdown: string): PlanStep[] {
  const lines = markdown.split("\n");
  const steps: PlanStep[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].trim().match(/^(#{2,3})\s+(.+)$/);
    if (!match) {
      i += 1;
      continue;
    }

    const level = match[1].length;
    const title = match[2].replace(/^\d+\.\s*/, "").replace(/[*_]/g, "").trim();
    const key = title.toLowerCase();
    if (SKIP_HEADINGS.has(key) || key.startsWith("task ")) {
      i += 1;
      continue;
    }

    const bodyLines: string[] = [];
    i += 1;
    while (i < lines.length) {
      const heading = lines[i].trim().match(/^(#+)\s+/);
      if (heading && heading[1].length <= level) break;
      bodyLines.push(lines[i]);
      i += 1;
    }

    const body = bodyLines.join("\n").trim();
    if (title.length > 2) {
      steps.push({
        id: String(steps.length + 1),
        title,
        files: [],
        description: body.slice(0, 800) || title,
        done: false,
      });
    }
  }

  return steps.slice(0, 25);
}

export function enrichPlanJson(planJson: PlanJson | undefined, markdown?: string | null): PlanJson {
  const base: PlanJson = {
    summary: planJson?.summary ?? "",
    architecture: planJson?.architecture,
    steps: planJson?.steps ?? [],
    risks: planJson?.risks,
    testing_strategy: planJson?.testing_strategy,
  };

  if (!base.steps.length && markdown) {
    base.steps = inferStepsFromMarkdown(markdown);
  }

  if (!base.summary?.trim() && markdown) {
    const firstLine = markdown
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#") && !l.startsWith("```"));
    if (firstLine) base.summary = firstLine.slice(0, 400);
  }

  return base;
}

/** Resolve plan task files from API payload or plan_json steps (with markdown fallback). */
export function planTasksFromChangeSet(changeSet: ChangeSet): PlanTaskFile[] {
  if (changeSet.plan_task_files?.length) {
    return changeSet.plan_task_files;
  }

  const planJson = enrichPlanJson(changeSet.plan_json, changeSet.plan_markdown);

  return (planJson.steps ?? []).map((step) => ({
    id: step.id,
    title: step.title,
    path: step.task_file_path ?? deriveTaskPath(changeSet, step.id),
    done: Boolean(step.done),
    files: step.files ?? [],
    description: step.description ?? "",
  }));
}
