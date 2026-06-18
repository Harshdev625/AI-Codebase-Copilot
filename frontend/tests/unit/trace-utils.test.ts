import {
  confidenceFromLabel,
  dedupeTraceSteps,
  enrichTraceSteps,
  inferNodeFromLabel,
  traceStepsFromMetadata,
  upsertTraceStep,
} from "@/features/chat/utils/trace-utils";

describe("trace-utils", () => {
  it("parses confidence from reasoning label", () => {
    expect(confidenceFromLabel("Reasoning (confidence 78%)")).toBeCloseTo(0.78);
    expect(confidenceFromLabel("no score")).toBeUndefined();
  });

  it("infers node from status label", () => {
    expect(inferNodeFromLabel("Planning intent: docs", 0)).toBe("planner");
    expect(inferNodeFromLabel("Retrieved 3 sources", 1)).toBe("retrieval");
    expect(inferNodeFromLabel("Generating answer", 2)).toBe("llm");
  });

  it("dedupes status and trace_step pairs by label", () => {
    const merged = dedupeTraceSteps([
      { node: "planner", label: "Planning intent: docs", status: "done" },
      { node: "planner", label: "Planning intent: docs", status: "done", detail: { intent: "docs" } },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].detail?.intent).toBe("docs");
  });

  it("upsertTraceStep merges by label", () => {
    const steps = upsertTraceStep(
      [{ node: "reasoning", label: "Retrieved 2 sources", status: "done" }],
      { node: "retrieval", label: "Retrieved 2 sources", status: "done", detail: { retrieved_count: 2 } },
    );
    expect(steps).toHaveLength(1);
    expect(steps[0].node).toBe("retrieval");
    expect(steps[0].detail?.retrieved_count).toBe(2);
  });

  it("enrichTraceSteps adds source preview from sources", () => {
    const steps = enrichTraceSteps(
      [{ node: "retrieval", label: "Retrieved 1 sources", status: "done" }],
      {
        sources: [{ path: "src/a.css", rerank_score: 0.91, content: "body {}" }],
      },
    );
    expect(steps[0].detail?.source_preview?.[0]?.path).toBe("src/a.css");
  });

  it("traceStepsFromMetadata prefers traceSteps array", () => {
    const steps = traceStepsFromMetadata({
      traceSteps: [{ node: "llm", label: "Generating answer", status: "running" }],
      statuses: ["Planning intent: docs"],
    });
    expect(steps.some((s) => s.node === "llm")).toBe(true);
    expect(steps.filter((s) => s.label === "Planning intent: docs")).toHaveLength(0);
  });
});
