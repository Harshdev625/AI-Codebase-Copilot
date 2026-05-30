import { render, screen, fireEvent } from "@testing-library/react";
import { ChatWorkspace } from "@/features/chat/components/chat-workspace";
import { useChat, useChatSessions, useDeleteSessionMutation } from "@/features/chat/hooks/use-chat";
import { TestProviders } from "../test-utils";

jest.mock("@/features/chat/hooks/use-chat", () => ({
  useChat: jest.fn(),
  useChatSessions: jest.fn(),
  useDeleteSessionMutation: jest.fn(),
}));

jest.mock("react-markdown", () => ({ children }: any) => <div data-testid="markdown">{children}</div>);
jest.mock("react-virtuoso", () => ({
  Virtuoso: ({ data, itemContent }: any) => (
    <div data-testid="virtuoso">
      {data.map((item: any, index: number) => itemContent(index, item))}
    </div>
  ),
}));

describe("ChatWorkspace", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useChatSessions as jest.Mock).mockReturnValue({
      data: { items: [] },
      isLoading: false,
    });
    
    (useDeleteSessionMutation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });

    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      sendMessage: jest.fn(),
      stopGeneration: jest.fn(),
      isSending: false,
      isHistoryLoading: false,
      historyError: null,
      clearMessages: jest.fn(),
      currentSessionId: null,
      selectSession: jest.fn(),
    });
  });

  it("renders disabled banner when no repository selected in repository mode", () => {
    render(<ChatWorkspace mode="repository" />, { wrapper: TestProviders });
    expect(screen.getByText("No Repository Selected")).toBeInTheDocument();
  });

  it("renders welcome message when no messages", () => {
    render(<ChatWorkspace mode="repository" repositoryId="repo-1" />, { wrapper: TestProviders });
    expect(screen.getByText("How can I help you?")).toBeInTheDocument();
  });

  it("renders messages", () => {
    (useChat as jest.Mock).mockReturnValue({
      messages: [
        { id: "1", role: "user", content: "Hello" },
        { id: "2", role: "assistant", content: "World" },
      ],
      sendMessage: jest.fn(),
      stopGeneration: jest.fn(),
      isSending: false,
      isHistoryLoading: false,
      historyError: null,
      clearMessages: jest.fn(),
      currentSessionId: "session-1",
      selectSession: jest.fn(),
    });

    render(<ChatWorkspace mode="repository" repositoryId="repo-1" />, { wrapper: TestProviders });
    
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent("World");
  });

  it("handles sending message", async () => {
    const sendMessageMock = jest.fn();
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      sendMessage: sendMessageMock,
      stopGeneration: jest.fn(),
      isSending: false,
      isHistoryLoading: false,
      historyError: null,
      clearMessages: jest.fn(),
      currentSessionId: null,
      selectSession: jest.fn(),
    });

    render(<ChatWorkspace mode="repository" repositoryId="repo-1" />, { wrapper: TestProviders });
    
    const input = screen.getByPlaceholderText("Ask a question about the codebase...");
    fireEvent.change(input, { target: { value: "my query" } });
    
    const sendButton = screen.getByRole("button", { name: "" }); // the send button has no name text, but it's the only one with no text besides Clear/New
    
    // We can also trigger by keypress
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    
    expect(sendMessageMock).toHaveBeenCalledWith("my query");
  });

  it("handles history error", () => {
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      sendMessage: jest.fn(),
      stopGeneration: jest.fn(),
      isSending: false,
      isHistoryLoading: false,
      historyError: new Error("History failed"),
      clearMessages: jest.fn(),
      currentSessionId: "session-1",
      selectSession: jest.fn(),
    });

    render(<ChatWorkspace mode="repository" repositoryId="repo-1" />, { wrapper: TestProviders });
    expect(screen.getByText("History failed")).toBeInTheDocument();
  });

  it("handles history loading", () => {
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      sendMessage: jest.fn(),
      stopGeneration: jest.fn(),
      isSending: false,
      isHistoryLoading: true,
      historyError: null,
      clearMessages: jest.fn(),
      currentSessionId: "session-1",
      selectSession: jest.fn(),
    });

    render(<ChatWorkspace mode="repository" repositoryId="repo-1" />, { wrapper: TestProviders });
    expect(screen.getByText("Restoring conversation...")).toBeInTheDocument();
  });

  it("shows stop generating button", () => {
    const stopMock = jest.fn();
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      sendMessage: jest.fn(),
      stopGeneration: stopMock,
      isSending: true,
      isHistoryLoading: false,
      historyError: null,
      clearMessages: jest.fn(),
      currentSessionId: "session-1",
      selectSession: jest.fn(),
    });

    render(<ChatWorkspace mode="repository" repositoryId="repo-1" />, { wrapper: TestProviders });
    
    const stopButton = screen.getByText("Stop generating");
    fireEvent.click(stopButton);
    expect(stopMock).toHaveBeenCalled();
  });

  it("handles delete session", async () => {
    const mutateAsync = jest.fn().mockResolvedValue({});
    (useDeleteSessionMutation as jest.Mock).mockReturnValue({
      mutateAsync,
    });
    
    (useChatSessions as jest.Mock).mockReturnValue({
      data: { items: [{ id: "session-1", updated_at: "2024-01-01" }] },
      isLoading: false,
    });

    render(<ChatWorkspace mode="repository" repositoryId="repo-1" />, { wrapper: TestProviders });
    
    // The trash button is hidden, but accessible by testing library if we query by role or similar, wait, let's use querySelector
    const trashButtons = screen.getAllByRole("button").filter(b => b.className.includes("hover:text-destructive"));
    expect(trashButtons.length).toBeGreaterThan(0);
    fireEvent.click(trashButtons[0]);
    
    expect(mutateAsync).toHaveBeenCalledWith("session-1");
  });

  it("handles send message error", async () => {
    const sendMessageMock = jest.fn().mockRejectedValue(new Error("Send failed"));
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      sendMessage: sendMessageMock,
      stopGeneration: jest.fn(),
      isSending: false,
      isHistoryLoading: false,
      historyError: null,
      clearMessages: jest.fn(),
      currentSessionId: null,
      selectSession: jest.fn(),
    });

    render(<ChatWorkspace mode="repository" repositoryId="repo-1" />, { wrapper: TestProviders });
    
    const input = screen.getByPlaceholderText("Ask a question about the codebase...");
    fireEvent.change(input, { target: { value: "error query" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    
    // Wait for promise rejection to be handled
    await screen.findByText("How can I help you?");
    // In actual app toast is shown, but here we just ensure it doesn't crash
  });
});
