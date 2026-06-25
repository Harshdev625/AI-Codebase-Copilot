import { sortTreeItems } from "@/features/explorer/utils/sort-tree-items";
import type { TreeItem } from "@/features/repositories/types/repository-types";

describe("sortTreeItems", () => {
  it("sorts directories before files, then alphabetically", () => {
    const items: TreeItem[] = [
      { id: "1", path: "README.md", type: "FILE" },
      { id: "2", path: "src", type: "DIRECTORY" },
      { id: "3", path: "package.json", type: "FILE" },
      { id: "4", path: "docs", type: "DIRECTORY" },
      { id: "5", path: "api", type: "DIRECTORY" },
    ];

    const sorted = sortTreeItems(items).map((item) => item.path);
    expect(sorted).toEqual(["api", "docs", "src", "package.json", "README.md"]);
  });

  it("does not mutate the input array", () => {
    const items: TreeItem[] = [
      { id: "1", path: "b.ts", type: "FILE" },
      { id: "2", path: "a.ts", type: "FILE" },
    ];
    const copy = [...items];
    sortTreeItems(items);
    expect(items).toEqual(copy);
  });

  it("sorts files alphabetically when types match", () => {
    const items: TreeItem[] = [
      { id: "1", path: "src/zeta.ts", type: "FILE" },
      { id: "2", path: "src/alpha.ts", type: "FILE" },
    ];
    expect(sortTreeItems(items).map((i) => i.path)).toEqual(["src/alpha.ts", "src/zeta.ts"]);
  });

  it("uses basename for nested paths", () => {
    const items: TreeItem[] = [
      { id: "1", path: "nested/deep/z.ts", type: "FILE" },
      { id: "2", path: "nested/deep/a.ts", type: "FILE" },
    ];
    expect(sortTreeItems(items).map((i) => i.path)).toEqual(["nested/deep/a.ts", "nested/deep/z.ts"]);
  });
});
