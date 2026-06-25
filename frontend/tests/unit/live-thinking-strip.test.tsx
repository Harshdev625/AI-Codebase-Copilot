import { render, screen } from "@testing-library/react";

import { LiveThinkingStrip } from "@/features/chat/components/live-thinking-strip";

describe("LiveThinkingStrip", () => {
  it("renders nothing when not streaming", () => {
    const { container } = render(
      <LiveThinkingStrip
        metadata={{
          isStreaming: false,
          traceSteps: [{ node: "planner", label: "Planning intent: search", status: "done" }],
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders live steps while streaming", () => {
    render(
      <LiveThinkingStrip
        metadata={{
          isStreaming: true,
          intent: "search",
          traceSteps: [
            {
              node: "retrieval",
              label: "Retrieved 2 sources",
              status: "running",
              detail: {
                retrieved_count: 2,
                source_preview: [{ path: "src/styles.css", score: 0.91 }],
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getAllByText("Retrieved 2 sources").length).toBeGreaterThan(0);
    expect(screen.getByText("styles.css")).toBeInTheDocument();
  });
});
