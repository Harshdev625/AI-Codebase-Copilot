import { formatChatTimestamp, formatSessionTimestamp } from "@/features/chat/utils/chat-timestamp-utils";

describe("chat-timestamp-utils", () => {
  it("formatChatTimestamp includes time", () => {
    const result = formatChatTimestamp("2026-06-16T23:47:00.000Z");
    expect(result).toMatch(/·/);
  });

  it("formatSessionTimestamp returns null for empty", () => {
    expect(formatSessionTimestamp(null)).toBeNull();
    expect(formatSessionTimestamp(undefined)).toBeNull();
  });

  it("formatSessionTimestamp returns readable string", () => {
    const result = formatSessionTimestamp("2026-06-16T23:47:00.000Z");
    expect(result).toBeTruthy();
    expect(result).toMatch(/2026/);
  });
});
