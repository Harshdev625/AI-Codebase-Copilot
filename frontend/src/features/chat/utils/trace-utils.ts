import type {
  Source,
  TraceNodeName,
  TraceStage,
  TraceStep,
  TraceStepStatus,
} from "@/features/chat/types/chat-types";

const CONFIDENCE_LABEL_RE = /confidence\s*(\d+(?:\.\d+)?)\s*%/i;

export function confidenceFromLabel(label: string): number | undefined {
  const match = label.match(CONFIDENCE_LABEL_RE);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return undefined;
  return value > 1 ? value / 100 : value;
}

export function enrichTraceSteps(
  steps: TraceStep[],
  options?: { intent?: string; sources?: Source[] },
): TraceStep[] {
  const intent = options?.intent;
  const sources = options?.sources ?? [];

  return steps.map((step) => {
    let next = step;

    if (step.node === "planner" && intent && !step.detail?.intent) {
      next = {
        ...next,
        detail: { ...next.detail, intent },
      };
    }

    if (step.node === "reasoning" && next.detail?.confidence == null) {
      const parsed = confidenceFromLabel(step.label);
      if (parsed != null) {
        next = {
          ...next,
          detail: { ...next.detail, confidence: parsed },
        };
      }
    }

    if (step.node === "retrieval" && !next.detail?.source_preview?.length && sources.length > 0) {
      next = {
        ...next,
        detail: {
          ...next.detail,
          retrieved_count: next.detail?.retrieved_count ?? sources.length,
          source_preview: sources.slice(0, 5).map((source) => ({
            path: source.path,
            score:
              typeof source.rerank_score === "number"
                ? source.rerank_score
                : typeof source.score === "number"
                  ? source.score
                  : undefined,
          })),
        },
      };
    }

    return next;
  });
}

const TRACE_NODES = new Set<TraceNodeName>([
  "planner",
  "retrieval",
  "reasoning",
  "tool_execution",
  "answer",
  "llm",
]);

function isTraceNode(value: string): value is TraceNodeName {
  return TRACE_NODES.has(value as TraceNodeName);
}

export function normalizeTraceStep(raw: unknown): TraceStep | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const nodeRaw = String(entry.node ?? "planner");
  const node = isTraceNode(nodeRaw) ? nodeRaw : "planner";
  const label = String(entry.label ?? "");
  if (!label) return null;

  const detailRaw =
    entry.detail && typeof entry.detail === "object"
      ? (entry.detail as Record<string, unknown>)
      : undefined;

  const sourcePreview = Array.isArray(detailRaw?.source_preview)
    ? detailRaw.source_preview
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          path: String(item.path ?? ""),
          score: typeof item.score === "number" ? item.score : undefined,
        }))
        .filter((item) => item.path)
    : undefined;

  return {
    node,
    label,
    ts: typeof entry.ts === "number" ? entry.ts : undefined,
    stage: entry.stage === "pipeline" || entry.stage === "llm" ? entry.stage : undefined,
    status:
      entry.status === "running" || entry.status === "done" || entry.status === "error"
        ? entry.status
        : undefined,
    detail: detailRaw
      ? {
          intent: typeof detailRaw.intent === "string" ? detailRaw.intent : undefined,
          retrieved_count:
            typeof detailRaw.retrieved_count === "number" ? detailRaw.retrieved_count : undefined,
          confidence: typeof detailRaw.confidence === "number" ? detailRaw.confidence : undefined,
          scope_paths: Array.isArray(detailRaw.scope_paths)
            ? detailRaw.scope_paths.map(String)
            : undefined,
          source_preview: sourcePreview,
          tool_name: typeof detailRaw.tool_name === "string" ? detailRaw.tool_name : undefined,
          error: typeof detailRaw.error === "string" ? detailRaw.error : undefined,
        }
      : undefined,
  };
}

export function traceStepsFromMetadata(metadata: Record<string, unknown>): TraceStep[] {
  if (Array.isArray(metadata.traceSteps) && metadata.traceSteps.length > 0) {
    return dedupeTraceSteps(
      metadata.traceSteps
        .map((step) => normalizeTraceStep(step))
        .filter((step): step is TraceStep => step !== null),
    );
  }
  if (Array.isArray(metadata.trace) && metadata.trace.length > 0) {
    return dedupeTraceSteps(
      metadata.trace
        .map((step) => normalizeTraceStep(step))
        .filter((step): step is TraceStep => step !== null)
        .map((step) => ({ ...step, status: step.status ?? "done" })),
    );
  }
  if (Array.isArray(metadata.statuses) && metadata.statuses.length > 0) {
    return dedupeTraceSteps(
      (metadata.statuses as string[]).map((label, idx) => ({
        node: inferNodeFromLabel(label, idx),
        label,
        status: "done" as TraceStepStatus,
        stage: label.toLowerCase().includes("generating") ? ("llm" as TraceStage) : ("pipeline" as TraceStage),
      })),
    );
  }
  return [];
}

export function inferNodeFromLabel(label: string, index: number): TraceNodeName {
  const lower = label.toLowerCase();
  if (lower.includes("planning intent")) return "planner";
  if (lower.includes("retrieved")) return "retrieval";
  if (lower.includes("reasoning")) return "reasoning";
  if (lower.includes("tool")) return "tool_execution";
  if (lower.includes("generating")) return "llm";
  if (lower.includes("formatted")) return "answer";
  const fallback: TraceNodeName[] = ["planner", "retrieval", "reasoning", "llm"];
  return fallback[index] ?? "reasoning";
}

function findTraceStepIndex(steps: TraceStep[], incoming: TraceStep): number {
  return steps.findIndex(
    (step) => step.label === incoming.label || step.node === incoming.node,
  );
}

/** Collapse duplicate pipeline steps (e.g. legacy status + trace_step pairs). */
export function dedupeTraceSteps(steps: TraceStep[]): TraceStep[] {
  const result: TraceStep[] = [];
  for (const step of steps) {
    const idx = findTraceStepIndex(result, step);
    if (idx >= 0) {
      const prev = result[idx];
      result[idx] = {
        ...prev,
        ...step,
        detail: { ...prev.detail, ...step.detail },
        status: step.status ?? prev.status,
      };
    } else {
      result.push(step);
    }
  }
  return result;
}

export function upsertTraceStep(steps: TraceStep[], incoming: TraceStep): TraceStep[] {
  const idx = findTraceStepIndex(steps, incoming);
  if (idx >= 0) {
    const next = [...steps];
    const prev = next[idx];
    next[idx] = {
      ...prev,
      ...incoming,
      detail: { ...prev.detail, ...incoming.detail },
      status: incoming.status ?? prev.status,
    };
    return next;
  }
  return [...steps, incoming];
}

export function markPreviousStepsDone(steps: TraceStep[], exceptNode?: TraceNodeName): TraceStep[] {
  return steps.map((step) =>
    step.node === exceptNode
      ? step
      : step.status === "running"
        ? { ...step, status: "done" as TraceStepStatus }
        : step,
  );
}

export function finalizeTraceSteps(steps: TraceStep[]): TraceStep[] {
  return steps.map((step) => ({
    ...step,
    status: step.status === "error" ? "error" : ("done" as TraceStepStatus),
  }));
}

export function ensureLlmStep(steps: TraceStep[], status: TraceStepStatus = "running"): TraceStep[] {
  const existing = steps.find((step) => step.node === "llm");
  if (existing) {
    return steps.map((step) => (step.node === "llm" ? { ...step, status } : step));
  }
  return [
    ...markPreviousStepsDone(steps),
    {
      node: "llm",
      label: "Generating answer",
      stage: "llm",
      status,
    },
  ];
}

export function mergeTraceFromDone(steps: TraceStep[], trace: unknown): TraceStep[] {
  if (!Array.isArray(trace) || trace.length === 0) return finalizeTraceSteps(steps);
  const normalized = trace
    .map((entry) => normalizeTraceStep(entry))
    .filter((entry): entry is TraceStep => entry !== null)
    .map((entry) => ({ ...entry, status: entry.status ?? ("done" as TraceStepStatus) }));

  if (steps.length === 0) return finalizeTraceSteps(normalized);

  const merged = [...steps];
  for (const entry of normalized) {
    const idx = merged.findIndex((step) => step.node === entry.node && step.label === entry.label);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...entry, detail: { ...merged[idx].detail, ...entry.detail } };
    } else {
      merged.push(entry);
    }
  }
  return finalizeTraceSteps(merged);
}
