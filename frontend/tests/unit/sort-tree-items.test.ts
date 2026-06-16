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
});
