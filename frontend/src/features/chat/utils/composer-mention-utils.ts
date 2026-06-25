/** Match @path tokens in composer text (repo-relative paths). */
const MENTION_PATTERN = /@([^\s@]+)/g;

const TRAILING_PUNCT_RE = /[.,;:!?)]+$/;

/** Extract unique @-mentioned paths from composer text. */
export function extractMentionPaths(text: string): string[] {
  const paths = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    paths.add(raw.replace(TRAILING_PUNCT_RE, ""));
  }
  return [...paths];
}

/** Strip @path tokens for display in message bubbles. */
export function stripMentionTokens(text: string): string {
  return text.replace(MENTION_PATTERN, "").replace(/\s{2,}/g, " ").trim();
}

/** Heuristic: last segment has a dot → treat as file for attached_files. */
export function isLikelyFilePath(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  return base.includes(".") && !base.endsWith(".");
}

/** Split mention paths into scope prefixes (folders) and exact file attachments. */
export function partitionMentionPaths(paths: string[]): {
  scopePaths: string[];
  attachedFiles: string[];
} {
  const scopePaths: string[] = [];
  const attachedFiles: string[] = [];
  for (const path of paths) {
    if (isLikelyFilePath(path)) {
      attachedFiles.push(path);
    } else {
      scopePaths.push(path);
    }
  }
  return { scopePaths, attachedFiles };
}

/** Merge arrays without duplicates (preserves order). */
export function mergeUnique(...lists: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) {
      if (!seen.has(item)) {
        seen.add(item);
        result.push(item);
      }
    }
  }
  return result;
}
