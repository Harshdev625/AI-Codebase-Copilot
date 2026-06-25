/** Locate a code snippet in file lines (fallback when line metadata is missing/wrong). */
export function locateSnippetInFile(
  fileLines: string[],
  snippet: string,
): { startLine: number; endLine: number } | null {
  const snippetLines = snippet.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (snippetLines.length === 0) return null;

  const first = snippetLines[0].trim();
  if (!first) return null;

  for (let i = 0; i < fileLines.length; i++) {
    if (!fileLines[i]!.includes(first.trim())) continue;

    const endIdx = Math.min(i + snippetLines.length - 1, fileLines.length - 1);
    let matched = true;
    for (let j = 0; j < snippetLines.length && i + j < fileLines.length; j++) {
      const fileLine = fileLines[i + j]!.trim();
      const snippetLine = snippetLines[j]!.trim();
      if (snippetLine && !fileLine.includes(snippetLine) && fileLine !== snippetLine) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return { startLine: i + 1, endLine: endIdx + 1 };
    }
  }

  for (let i = 0; i < fileLines.length; i++) {
    if (fileLines[i]!.includes(first)) {
      return { startLine: i + 1, endLine: i + 1 };
    }
  }

  return null;
}

export function resolveSearchRange(
  lineCount: number,
  fileContent: string,
  initialLine?: number,
  initialEndLine?: number,
  snippet?: string,
): { startLine: number; endLine: number } {
  const lines = fileContent.replace(/\r\n/g, "\n").split("\n");

  if (initialLine && initialLine >= 1 && initialLine <= lineCount) {
    const end =
      initialEndLine && initialEndLine >= initialLine
        ? Math.min(initialEndLine, lineCount)
        : initialLine;
    return { startLine: initialLine, endLine: end };
  }

  if (snippet?.trim()) {
    const located = locateSnippetInFile(lines, snippet);
    if (located) {
      return {
        startLine: Math.min(located.startLine, lineCount),
        endLine: Math.min(located.endLine, lineCount),
      };
    }
  }

  return { startLine: 1, endLine: 1 };
}
