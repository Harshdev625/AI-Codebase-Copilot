import type { editor } from "monaco-editor";

import { resolveSearchRange } from "./search-line-range";

export type { SearchHighlightOptions } from "./search-highlight-types";
export { locateSnippetInFile, resolveSearchRange } from "./search-line-range";

import type { SearchHighlightOptions } from "./search-highlight-types";

export type MonacoApi = typeof import("monaco-editor");

function buildDecorations(
  monacoApi: MonacoApi,
  model: editor.ITextModel,
  range: { startLine: number; endLine: number },
  highlight?: SearchHighlightOptions,
): editor.IModelDeltaDecoration[] {
  const decorations: editor.IModelDeltaDecoration[] = [
    {
      range: new monacoApi.Range(
        range.startLine,
        1,
        range.endLine,
        model.getLineMaxColumn(range.endLine),
      ),
      options: {
        isWholeLine: true,
        className: "studio-editor-search-line",
        overviewRuler: {
          color: "#e3b341",
          position: monacoApi.editor.OverviewRulerLane.Center,
        },
      },
    },
  ];

  const query = highlight?.query?.trim();
  if (query && highlight.column && highlight.column > 0 && range.startLine === range.endLine) {
    const lineContent = model.getLineContent(range.startLine);
    const col = Math.min(highlight.column, lineContent.length + 1);
    const idx = lineContent.toLowerCase().indexOf(query.toLowerCase(), col - 1);
    const matchStart = idx >= 0 ? idx + 1 : col;
    const matchEnd = Math.min(matchStart + query.length, lineContent.length + 1);
    decorations.push({
      range: new monacoApi.Range(range.startLine, matchStart, range.startLine, matchEnd),
      options: {
        inlineClassName: "studio-editor-search-match",
        stickiness: monacoApi.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    });
  }

  return decorations;
}

/** Scroll to and highlight a line range opened from search results. */
export function applySearchLineHighlight(
  editorInstance: editor.IStandaloneCodeEditor,
  monacoApi: MonacoApi,
  initialLine?: number,
  initialEndLine?: number,
  highlight?: SearchHighlightOptions,
): editor.IEditorDecorationsCollection | null {
  const model = editorInstance.getModel();
  if (!model) return null;

  const fileContent = model.getValue();
  const { startLine, endLine } = resolveSearchRange(
    model.getLineCount(),
    fileContent,
    initialLine,
    initialEndLine,
    highlight?.snippet,
  );

  const decorations = buildDecorations(monacoApi, model, { startLine, endLine }, highlight);
  const collection = editorInstance.createDecorationsCollection(decorations);

  const reveal = () => {
    editorInstance.revealRangeInCenter(
      new monacoApi.Range(startLine, 1, endLine, model.getLineMaxColumn(endLine)),
    );
    editorInstance.setPosition({ lineNumber: startLine, column: 1 });
  };

  reveal();
  requestAnimationFrame(() => {
    requestAnimationFrame(reveal);
  });

  return collection;
}
