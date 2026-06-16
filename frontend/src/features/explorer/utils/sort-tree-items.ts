import type { TreeItem } from "@/features/repositories/types/repository-types";

function entryName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

/** VS Code order: directories first, then files; alphabetical within each group. */
export function sortTreeItems(items: TreeItem[]): TreeItem[] {
  return [...items].sort((a, b) => {
    const aIsDir = a.type === "DIRECTORY" ? 0 : 1;
    const bIsDir = b.type === "DIRECTORY" ? 0 : 1;
    if (aIsDir !== bIsDir) return aIsDir - bIsDir;
    return entryName(a.path).localeCompare(entryName(b.path), undefined, {
      sensitivity: "base",
      numeric: true,
    });
  });
}
