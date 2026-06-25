import {
  formatEditorTabTitle,
  formatSearchResultPath,
  toRepoRelativePath,
} from "@/lib/path-utils";

describe("path-utils", () => {
  it("strips path after workspace folder name", () => {
    expect(
      toRepoRelativePath(
        "E:\\Projects\\AI Codebase Copilot\\timemachine\\docs\\CHANGELOG.md",
        "E:\\Projects\\AI Codebase Copilot\\timemachine",
      ),
    ).toBe("docs/CHANGELOG.md");
  });

  it("strips path using repo id tail hint", () => {
    expect(
      toRepoRelativePath("Projects/AI Codebase Copilot/timemachine/assets/js/main.js", "timemachine"),
    ).toBe("assets/js/main.js");
  });

  it("formats nested search paths on two lines", () => {
    expect(
      formatSearchResultPath("timemachine/docs/CHANGELOG.md", "timemachine"),
    ).toEqual({
      fileName: "CHANGELOG.md",
      parentPath: "docs",
      relativePath: "docs/CHANGELOG.md",
    });
  });

  it("formats editor tab title with folder", () => {
    expect(formatEditorTabTitle("docs/guide/README.md")).toBe("docs/guide/README.md");
  });
});
