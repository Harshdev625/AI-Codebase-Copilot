"use client";

import * as React from "react";

export function MermaidDiagram({ code }: { code: string }): React.JSX.Element {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
        });
        const id = `mmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-[#2D313E] bg-[#0D1117] p-4">
        <p className="mb-2 text-xs text-[#8B949E]">Mermaid diagram (preview unavailable)</p>
        <pre className="overflow-x-auto text-xs text-[#C9D1D9]">{code}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-6 flex justify-center overflow-x-auto rounded-lg border border-[#2D313E]/60 bg-[#0D1117]/40 p-4"
      data-testid="mermaid-diagram"
    />
  );
}
