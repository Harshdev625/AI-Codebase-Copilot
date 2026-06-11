import { render, screen, fireEvent } from "@testing-library/react";
import { ChatWorkspace } from "@/features/chat/components/chat-workspace";
import { useChat, useChatSessions, useDeleteSessionMutation, useUpdateSessionMutation } from "@/features/chat/hooks/use-chat";
import { TestProviders } from "../test-utils";

jest.mock("@/features/chat/hooks/use-chat", () => ({
  useChat: jest.fn(),
  useChatSessions: jest.fn(),
  useDeleteSessionMutation: jest.fn(),
  useUpdateSessionMutation: jest.fn(),
}));

jest.mock("@/features/repositories/hooks/use-repositories", () => ({
  useProjectRetrieveMutation: jest.fn(() => ({
    mutateAsync: jest.fn(),
  })),
  useIndexRepository: jest.fn(() => ({
    mutateAsync: jest.fn(),
  })),
  useRepositories: jest.fn(() => ({
    repositories: [],
    isLoading: false,
  })),
  useRepositoryTree: jest.fn(() => ({
    data: { items: [] },
    isLoading: false,
  })),
  useRepositoryInsights: jest.fn(() => ({
    data: null,
    isLoading: false,
  })),
}));

jest.mock("@/features/workspace/store/workspace-store", () => ({
  useWorkspaceStore: () => ({
    setActiveSessionId: jest.fn(),
  }),
}));

jest.mock("@/features/chat/components/context-panel", () => ({
  ContextPanel: () => <div data-testid="context-panel" />,
}));

jest.mock("react-markdown", () => ({ children }: any) => <div data-testid="markdown">{children}</div>);
jest.mock("react-virtuoso", () => ({
  Virtuoso: ({ data, itemContent }: any) => (
    <div data-testid="virtuoso">
      {data.map((item: any, index: number) => itemContent(index, item))}
    </div>
  ),
}));

const stableSessionsData = { items: [] as Array<Record<string, unknown>>, total: 0 };

describe("ChatWorkspace", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useChatSessions as jest.Mock).mockReturnValue({
      data: stableSessionsData,
      isLoading: false,
    });
    
    (useDeleteSessionMutation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });

    (useUpdateSessionMutation as jest.Mock).mockReturnValue({
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

  it("renders welcome message when no messages", () => {
    render(<ChatWorkspace repositoryId="repo-1" />, { wrapper: TestProviders });
    expect(screen.getByText("How can I help you build today?")).toBeInTheDocument();
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

    render(<ChatWorkspace repositoryId="repo-1" />, { wrapper: TestProviders });
    
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

    render(<ChatWorkspace repositoryId="repo-1" />, { wrapper: TestProviders });
    
    const input = screen.getByPlaceholderText("Describe the changes, ask a question, or reference files...");
    fireEvent.change(input, { target: { value: "my query" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    
    expect(sendMessageMock).toHaveBeenCalledWith("my query", "ASK", []);
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

    render(<ChatWorkspace repositoryId="repo-1" />, { wrapper: TestProviders });
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

    render(<ChatWorkspace repositoryId="repo-1" />, { wrapper: TestProviders });
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

    render(<ChatWorkspace repositoryId="repo-1" />, { wrapper: TestProviders });
    
    const stopButton = screen.getByText("Stop generating");
    fireEvent.click(stopButton);
    expect(stopMock).toHaveBeenCalled();
  });
});
