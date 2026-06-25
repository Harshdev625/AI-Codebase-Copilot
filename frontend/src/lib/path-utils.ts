/** Strip local/absolute paths — use repo-relative posix paths for API + display. */
export function toRepoRelativePath(path: string, workspaceRoot?: string | null): string {
  if (!path) return path;
  let p = path.trim().replace(/\\/g, "/");
  p = p.replace(/^[A-Za-z]:\/+/, "");
  p = p.replace(/^\/+/, "");

  if (workspaceRoot) {
    const hint = workspaceRoot.trim().replace(/\\/g, "/").replace(/^[A-Za-z]:\/+/, "").replace(/^\/+/, "");
    const hintParts = hint.split("/").filter(Boolean);
    const hintName = hintParts[hintParts.length - 1];
    if (hintName) {
      const lower = p.toLowerCase();
      const marker = `/${hintName.toLowerCase()}/`;
      const idx = lower.indexOf(marker);
      if (idx >= 0) {
        return p.slice(idx + marker.length);
      }
      if (lower.endsWith(`/${hintName.toLowerCase()}`)) {
        return "";
      }
    }
  }

  const segments = p.split("/").filter(Boolean);
  const srcIdx = segments.findIndex((s) => s === "src" || s === "assets" || s === "docs" || s === "public");
  if (srcIdx > 0) {
    return segments.slice(srcIdx).join("/");
  }

  return p;
}

export function formatSearchResultPath(
  path: string,
  workspaceRoot?: string | null,
): { fileName: string; parentPath: string; relativePath: string } {
  const relativePath = toRepoRelativePath(path, workspaceRoot);
  const slash = relativePath.lastIndexOf("/");
  if (slash < 0) {
    return { fileName: relativePath, parentPath: "", relativePath };
  }
  return {
    fileName: relativePath.slice(slash + 1),
    parentPath: relativePath.slice(0, slash),
    relativePath,
  };
}

/** Tab label: prefer `folder/file.ext`, smart-truncate when long. */
export function formatEditorTabTitle(path: string, maxLen = 28, workspaceRoot?: string | null): string {
  const rel = toRepoRelativePath(path, workspaceRoot);
  if (rel.length <= maxLen) return rel;
  const slash = rel.lastIndexOf("/");
  if (slash < 0) {
    return rel.length > maxLen ? `…${rel.slice(-(maxLen - 1))}` : rel;
  }
  const fileName = rel.slice(slash + 1);
  const parent = rel.slice(0, slash);
  if (fileName.length >= maxLen - 2) {
    return `…${fileName.slice(-(maxLen - 1))}`;
  }
  const room = maxLen - fileName.length - 1;
  if (parent.length <= room) return `${parent}/${fileName}`;
  return `…/${parent.slice(-(room - 2))}/${fileName}`;
}

export function isMarkdownFile(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".mdx");
}
