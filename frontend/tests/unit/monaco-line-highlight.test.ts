import {
  locateSnippetInFile,
  resolveSearchRange,
} from "@/features/studio/workbench/search-line-range";

describe("monaco-line-highlight", () => {
  const content = ["import foo", "def helper():", "    return 1", "def other():"].join("\n");

  it("uses line metadata when valid", () => {
    expect(resolveSearchRange(4, content, 2, 3)).toEqual({ startLine: 2, endLine: 3 });
  });

  it("locates snippet when line metadata is missing", () => {
    const range = resolveSearchRange(4, content, undefined, undefined, "def helper():\n    return 1");
    expect(range).toEqual({ startLine: 2, endLine: 3 });
  });

  it("finds snippet by partial line match", () => {
    const found = locateSnippetInFile(content.split("\n"), "return 1");
    expect(found).toEqual({ startLine: 3, endLine: 3 });
  });

  it("returns default range when nothing matches", () => {
    expect(resolveSearchRange(4, content, undefined, undefined, "missing snippet")).toEqual({
      startLine: 1,
      endLine: 1,
    });
  });

  it("locateSnippetInFile returns null for empty snippet", () => {
    expect(locateSnippetInFile(["line"], "   ")).toBeNull();
  });
});
