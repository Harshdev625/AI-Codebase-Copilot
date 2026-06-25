import {
  extractMentionPaths,
  isLikelyFilePath,
  mergeUnique,
  partitionMentionPaths,
  stripMentionTokens,
} from "@/features/chat/utils/composer-mention-utils";

describe("composer-mention-utils", () => {
  it("extracts unique @ paths from text", () => {
    expect(extractMentionPaths("Check @src/foo.ts and @src/bar.ts")).toEqual([
      "src/foo.ts",
      "src/bar.ts",
    ]);
  });

  it("strips trailing punctuation from mentions", () => {
    expect(extractMentionPaths("See @README.md.")).toEqual(["README.md"]);
  });

  it("stripMentionTokens removes @ tokens", () => {
    expect(stripMentionTokens("Explain @src/foo.ts please")).toBe("Explain please");
  });

  it("partitions files vs folders", () => {
    const { scopePaths, attachedFiles } = partitionMentionPaths([
      "frontend/src",
      "frontend/src/app.ts",
    ]);
    expect(scopePaths).toEqual(["frontend/src"]);
    expect(attachedFiles).toEqual(["frontend/src/app.ts"]);
  });

  it("isLikelyFilePath detects extensions", () => {
    expect(isLikelyFilePath("src/index.ts")).toBe(true);
    expect(isLikelyFilePath("frontend/src")).toBe(false);
  });

  it("mergeUnique deduplicates preserving order", () => {
    expect(mergeUnique(["a"], ["b", "a"], undefined, ["c"])).toEqual(["a", "b", "c"]);
  });
});
