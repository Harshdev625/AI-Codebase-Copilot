import React from "react";

export default function ReactDiffViewer({ newValue }: any) {
  return <pre data-testid="mock-diff-viewer">{newValue}</pre>;
}
