import { sendChat } from "@/lib/api";

describe("sendChat", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns parsed JSON for successful response", async () => {
    const payload = { repo_id: "repo-1", query: "Where is auth?" };
    const expected = { answer: "ok", intent: "search", sources: [] };

    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(expected), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const result = await sendChat(payload);

    expect(global.fetch).toHaveBeenCalledWith("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    expect(result).toEqual(expected);
  });

  it("throws backend message when request fails", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response("Backend unavailable", {
        status: 503,
        headers: { "Content-Type": "text/plain" }
      })
    );

    await expect(sendChat({ repo_id: "repo-1", query: "hello" })).rejects.toThrow(
      "Backend unavailable"
    );
  });

  it("throws fallback message when backend returns empty body", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response("", {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      })
    );

    await expect(sendChat({ repo_id: "repo-1", query: "hello" })).rejects.toThrow(
      "Failed to call backend."
    );
  });
});
