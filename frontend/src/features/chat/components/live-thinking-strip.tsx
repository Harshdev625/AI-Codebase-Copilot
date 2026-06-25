"use client";

import * as React from "react";
import { Brain, FileSearch, Loader2, Sparkles, Wrench } from "lucide-react";

import type { Source, TraceStep } from "@/features/chat/types/chat-types";
import { normalizeRepoPath } from "@/features/chat/utils/chat-message-utils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  confidenceFromLabel,
  enrichTraceSteps,
  traceStepsFromMetadata,
} from "@/features/chat/utils/trace-utils";

interface LiveThinkingStripProps {
  metadata: Record<string, unknown>;
  sources?: Source[];
}

const NODE_META: Record<
  TraceStep["node"],
  { title: string; icon: React.ComponentType<{ className?: string }> }
> = {
  planner: { title: "Planner", icon: Sparkles },
  retrieval: { title: "Retrieval", icon: FileSearch },
  reasoning: { title: "Reasoning", icon: Brain },
  tool_execution: { title: "Tools", icon: Wrench },
  answer: { title: "Answer", icon: Sparkles },
  llm: { title: "Generating", icon: Loader2 },
};

function StepChip({ step, isActive }: { step: TraceStep; isActive: boolean }) {
  const meta = NODE_META[step.node] ?? NODE_META.reasoning;
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
        isActive
          ? "border-[#5CD4C2]/50 bg-[#5CD4C2]/15 text-[#E6FFFA]"
          : "border-[#2D313E]/80 bg-[#0B0D14]/80 text-[#8B949E]",
      )}
    >
      {isActive ? (
        <Loader2 className="h-3 w-3 animate-spin text-[#5CD4C2]" />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      <span className="max-w-[12rem] truncate">{step.label}</span>
    </div>
  );
}

/** Inline thinking expose — visible only while the assistant message is streaming. */
export function LiveThinkingStrip({ metadata, sources = [] }: LiveThinkingStripProps) {
  const intent = typeof metadata.intent === "string" ? metadata.intent : undefined;
  const isStreaming = Boolean(metadata.isStreaming);
  const rawSteps = traceStepsFromMetadata(metadata);
  const steps = enrichTraceSteps(rawSteps, { intent, sources });

  if (!isStreaming || steps.length === 0) return null;

  const activeIndex = steps.findIndex((step) => step.status === "running");
  const activeStepIndex =
    activeIndex >= 0 ? activeIndex : steps.length - 1;
  const activeStep = steps[activeStepIndex];

  const retrievalStep = steps.find((s) => s.node === "retrieval");
  const preview =
    retrievalStep?.detail?.source_preview ??
    sources.slice(0, 5).map((s) => ({
      path: s.path,
      score:
        typeof s.rerank_score === "number"
          ? s.rerank_score
          : typeof s.score === "number"
            ? s.score
            : undefined,
    }));

  const reasoningStep = steps.find((s) => s.node === "reasoning");
  const confidence =
    typeof reasoningStep?.detail?.confidence === "number"
      ? reasoningStep.detail.confidence
      : reasoningStep
        ? confidenceFromLabel(reasoningStep.label)
        : undefined;

  return (
    <div
      className="mb-3 min-w-0 rounded-xl border border-[#5CD4C2]/25 bg-[#0B0D14]/70 p-3"
      aria-live="polite"
      aria-label="Assistant thinking in progress"
    >
      <div className="mb-2 flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#5CD4C2]" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#5CD4C2]">
          Thinking
        </span>
        {intent && (
          <Badge
            variant="outline"
            className="border-[#5CD4C2]/30 px-1.5 py-0 text-[8px] text-[#5CD4C2]"
          >
            {intent}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {steps.map((step, idx) => (
          <StepChip key={`${step.node}-${step.ts ?? idx}`} step={step} isActive={idx === activeStepIndex} />
        ))}
      </div>

      {activeStep && (
        <p className="mt-2 truncate text-[11px] text-[#C9D1D9]">{activeStep.label}</p>
      )}

      {preview.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {preview.map((item) => (
            <span
              key={item.path}
              className="max-w-[10rem] truncate rounded border border-[#5CD4C2]/20 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] text-[#8B949E]"
              title={item.path}
            >
              {normalizeRepoPath(item.path)}
            </span>
          ))}
        </div>
      )}

      {typeof confidence === "number" && (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-[9px] text-[#8B949E]">
            <span>Confidence</span>
            <span>{Math.round(confidence * 100)}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[#1E212B]">
            <div
              className="h-full rounded-full bg-[#5CD4C2] transition-all"
              style={{ width: `${Math.min(100, Math.max(0, confidence * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
