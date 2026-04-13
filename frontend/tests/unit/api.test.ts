import { getAdminMetrics, login, sendChat } from "@/lib/api";

describe("sendChat", () => {
  beforeEach(() => {
    window.localStorage.setItem("aicc_token", "token-123");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
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
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token-123"
      },
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

  it("returns access token on successful login", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "token-xyz" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const result = await login({ email: "dev@example.com", password: "password123" });

    expect(global.fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dev@example.com", password: "password123" })
    });
    expect(result).toEqual({ access_token: "token-xyz" });
  });

  it("throws backend detail on failed login", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(login({ email: "dev@example.com", password: "bad" })).rejects.toThrow(
      "Invalid credentials"
    );
  });

  it("returns admin metrics for successful request", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ users_count: 5, projects_count: 2 }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const result = await getAdminMetrics("admin-token");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/system-metrics",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer admin-token" })
      })
    );
    expect(result).toEqual({ users_count: 5, projects_count: 2 });
  });

  it("throws detail when admin metrics request fails", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(getAdminMetrics("bad-token")).rejects.toThrow("Forbidden");
  });

  it("throws generic message when admin metrics response is not json", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response("Internal Server Error", {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      })
    );

    await expect(getAdminMetrics("token")).rejects.toThrow();
  });
});

describe("sendChat edge cases", () => {
  beforeEach(() => {
    window.localStorage.setItem("aicc_token", "token-123");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("includes repo_id in request payload", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ answer: "test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await sendChat({ repo_id: "specific-repo", query: "test question" });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        body: JSON.stringify({ repo_id: "specific-repo", query: "test question" })
      })
    );
  });

  it("handles network errors gracefully", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network timeout"));

    await expect(sendChat({ repo_id: "repo", query: "test" })).rejects.toThrow("Network timeout");
  });
});

describe("login edge cases", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("handles network errors on login", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("Connection refused"));

    await expect(login({ email: "test@example.com", password: "pass" })).rejects.toThrow(
      "Connection refused"
    );
  });

  it("handles malformed JSON response on login", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response("Not JSON", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(login({ email: "test@example.com", password: "pass" })).rejects.toThrow();
  });

  it("provides fallback error message when login fails without detail", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(login({ email: "test@example.com", password: "pass" })).rejects.toThrow(
      "Login failed"
    );
  });

  it("sends correct content type header", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await login({ email: "dev@example.com", password: "password" });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" }
      })
    );
  });
});
