/** Split a multi-file unified diff into per-file patch strings. */
export function splitUnifiedDiff(diff: string): Record<string, string> {
  const text = diff.replace(/\r\n/g, "\n").trim();
  if (!text) return {};

  const blocks = text.split(/(?=^diff --git )/m);
  const perFile: Record<string, string> = {};

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    let path = "";
    for (const line of trimmed.split("\n")) {
      if (line.startsWith("+++ b/")) {
        path = line.slice(6).trim();
        break;
      }
      if (line.startsWith("--- a/") && !path) {
        path = line.slice(6).trim();
      }
    }
    if (path) perFile[path] = trimmed;
  }

  if (Object.keys(perFile).length === 0 && text.startsWith("---")) {
    perFile["patch.diff"] = text;
  }
  return perFile;
}

/** Apply a single-file unified diff to original text in memory. */
export function applyUnifiedDiff(original: string, patch: string): string {
  const originalLines = original.split("\n");
  const patchLines = patch.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let origIdx = 0;
  let i = 0;
  const hunkHeader = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/;

  while (i < patchLines.length) {
    const line = patchLines[i];
    if (line.startsWith("---") || line.startsWith("+++")) {
      i += 1;
      continue;
    }
    if (hunkHeader.test(line)) {
      const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      i += 1;
      if (!m) continue;
      const oldStart = Math.max(parseInt(m[1], 10) - 1, 0);
      while (origIdx < oldStart && origIdx < originalLines.length) {
        output.push(originalLines[origIdx]);
        origIdx += 1;
      }
      while (i < patchLines.length) {
        const hline = patchLines[i];
        if (hunkHeader.test(hline)) break;
        if (hline.startsWith(" ")) {
          if (origIdx < originalLines.length) output.push(originalLines[origIdx]);
          origIdx += 1;
          i += 1;
        } else if (hline.startsWith("-")) {
          origIdx += 1;
          i += 1;
        } else if (hline.startsWith("+")) {
          output.push(hline.slice(1));
          i += 1;
        } else if (hline.startsWith("\\")) {
          i += 1;
        } else {
          i += 1;
        }
      }
      continue;
    }
    i += 1;
  }

  while (origIdx < originalLines.length) {
    output.push(originalLines[origIdx]);
    origIdx += 1;
  }
  return output.join("\n");
}
