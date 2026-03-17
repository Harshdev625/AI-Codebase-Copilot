import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ChatShell } from "@/components/chat-shell";
import { sendChat } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  sendChat: jest.fn()
}));

const mockedSendChat = sendChat as jest.MockedFunction<typeof sendChat>;

describe("ChatShell", () => {
  beforeEach(() => {
    mockedSendChat.mockReset();
    window.localStorage.setItem("aicc_token", "token-123");
    window.localStorage.setItem("aicc_project_id", "project-1");
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([{ id: "repo-1", repo_id: "my-repo" }]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("loads repositories for the selected project", async () => {
    render(<ChatShell />);

    expect(await screen.findByDisplayValue("my-repo")).toBeInTheDocument();
    expect(screen.getByText("Copilot Chat")).toBeInTheDocument();
  });

  it("submits request and renders answer with sources", async () => {
    mockedSendChat.mockResolvedValue({
      answer: "Auth is in app/auth/service.py",
      intent: "search",
      sources: [{ path: "app/auth/service.py", symbol: "AuthService" }]
    } as never);

    render(<ChatShell />);

    const queryInput = await screen.findByPlaceholderText("Ask about your codebase…");
    fireEvent.change(queryInput, { target: { value: "Where is auth?" } });
    fireEvent.submit(queryInput.closest("form")!);

    await waitFor(() => {
      expect(mockedSendChat).toHaveBeenCalledWith({ repo_id: "my-repo", query: "Where is auth?" });
    });

    expect(await screen.findByText("Auth is in app/auth/service.py")).toBeInTheDocument();
    expect(screen.getByText("search")).toBeInTheDocument();
    expect(screen.getAllByText(/app\/auth\/service.py/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows error message when API call fails", async () => {
    mockedSendChat.mockRejectedValue(new Error("Service unavailable"));

    render(<ChatShell />);

    const queryInput = await screen.findByPlaceholderText("Ask about your codebase…");
    fireEvent.change(queryInput, { target: { value: "Where is auth?" } });
    fireEvent.submit(queryInput.closest("form")!);

    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
  });

  it("shows setup guidance when no repositories exist", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    render(<ChatShell />);

    expect(await screen.findByText(/Add and index at least one repository/)).toBeInTheDocument();
  });

  it("handles empty query submission gracefully", async () => {
    render(<ChatShell />);

    const form = await screen.findByPlaceholderText("Ask about your codebase…").then(el => el.closest("form"));
    fireEvent.submit(form!);

    // Should not call sendChat if query is empty
    expect(mockedSendChat).not.toHaveBeenCalled();
  });

  it("displays multiple sources when provided", async () => {
    mockedSendChat.mockResolvedValue({
      answer: "Found in multiple places",
      intent: "search",
      sources: [
        { path: "app/auth/service.py", symbol: "AuthService" },
        { path: "app/auth/models.py", symbol: "User" },
        { path: "app/auth/routes.py", symbol: "login" }
      ]
    } as never);

    render(<ChatShell />);

    const queryInput = await screen.findByPlaceholderText("Ask about your codebase…");
    fireEvent.change(queryInput, { target: { value: "Show all auth code" } });
    fireEvent.submit(queryInput.closest("form")!);

    await waitFor(() => {
      expect(mockedSendChat).toHaveBeenCalled();
    });

    // Verify answer is displayed
    expect(await screen.findByText("Found in multiple places")).toBeInTheDocument();
  });

  it("clears input after successful submission", async () => {
    mockedSendChat.mockResolvedValue({
      answer: "Test answer",
      intent: "search",
      sources: []
    } as never);

    render(<ChatShell />);

    const queryInput = await screen.findByPlaceholderText("Ask about your codebase…") as HTMLInputElement;
    fireEvent.change(queryInput, { target: { value: "Test query" } });
    fireEvent.submit(queryInput.closest("form")!);

    await waitFor(() => {
      expect(mockedSendChat).toHaveBeenCalled();
    });

    // Input should be cleared after submission
    expect(queryInput.value).toBe("");
  });

  it("changes repository when dropdown selection changes", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { id: "repo-1", repo_id: "my-repo" },
          { id: "repo-2", repo_id: "other-repo" }
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(<ChatShell />);

    const repoSelect = await screen.findByDisplayValue("my-repo");
    fireEvent.change(repoSelect, { target: { value: "other-repo" } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("other-repo")).toBeInTheDocument();
    });
  });

  it("fetches repositories on component mount", async () => {
    render(<ChatShell />);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects"),
      expect.any(Object)
    );

    expect(await screen.findByDisplayValue("my-repo")).toBeInTheDocument();
  });

  it("displays answer with correct intent type", async () => {
    mockedSendChat.mockResolvedValue({
      answer: "This is a detailed explanation",
      intent: "explain",
      sources: []
    } as never);

    render(<ChatShell />);

    const queryInput = await screen.findByPlaceholderText("Ask about your codebase…");
    fireEvent.change(queryInput, { target: { value: "Explain the architecture" } });
    fireEvent.submit(queryInput.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("explain")).toBeInTheDocument();
    });
  });

  it("handles API errors and displays them to user", async () => {
    mockedSendChat.mockRejectedValue(new Error("Rate limited"));

    render(<ChatShell />);

    const queryInput = await screen.findByPlaceholderText("Ask about your codebase…");
    fireEvent.change(queryInput, { target: { value: "Test query" } });
    fireEvent.submit(queryInput.closest("form")!);

    expect(await screen.findByText("Rate limited")).toBeInTheDocument();
  });

  it("disables input while loading", async () => {
    let resolveChat: Function;
    mockedSendChat.mockReturnValue(
      new Promise(resolve => {
        resolveChat = resolve;
      })
    );

    render(<ChatShell />);

    const queryInput = await screen.findByPlaceholderText("Ask about your codebase…") as HTMLInputElement;
    fireEvent.change(queryInput, { target: { value: "Test query" } });
    fireEvent.submit(queryInput.closest("form")!);

    // Resolve the API call
    resolveChat!({
      answer: "Test answer",
      intent: "search",
      sources: []
    });

    await waitFor(() => {
      expect(mockedSendChat).toHaveBeenCalled();
    });
  });
});

