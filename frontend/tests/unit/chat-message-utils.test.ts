import {
  getDisplayContent,
  normalizeMessageMetadata,
  normalizeSourcesFromMetadata,
} from "@/features/chat/utils/chat-message-utils";

describe("chat-message-utils", () => {
  it("strips federated context from user display content", () => {
    const raw =
      "Below is the retrieved cross-repository context for this query:\n\n[Source #1]...\n\nUser Query: What is auth?";
    expect(getDisplayContent(raw, "user")).toBe("What is auth?");
  });

  it("maps source_index to sources", () => {
    const metadata = {
      source_index: [{ path: "src/a.ts", content: "code", score: 0.9 }],
    };
    expect(normalizeSourcesFromMetadata(metadata)).toHaveLength(1);
    expect(normalizeMessageMetadata(metadata).sources).toHaveLength(1);
  });

  it("adds patch_proposal into sources", () => {
    const metadata = {
      sources: [],
      patch_proposal: { diff: "patch", summary: "fix" },
    };
    const normalized = normalizeMessageMetadata(metadata);
    expect((normalized.sources as Array<{ kind?: string }>)[0]?.kind).toBe("patch_proposal");
  });
});
