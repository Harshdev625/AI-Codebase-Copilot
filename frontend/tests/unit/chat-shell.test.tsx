import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../test-utils";
import { ChatWorkspace } from "@/features/chat/components/chat-workspace";
import { useChat } from "@/features/chat/hooks/use-chat";

const stableSessionsData = { items: [] as Array<Record<string, unknown>>, total: 0 };

jest.mock("@/features/chat/hooks/use-chat", () => ({
  useChat: jest.fn(),
  useChatSessions: jest.fn(() => ({ data: stableSessionsData, isLoading: false })),
  useDeleteSessionMutation: jest.fn(() => ({ mutateAsync: jest.fn() })),
  useUpdateSessionMutation: jest.fn(() => ({ mutateAsync: jest.fn() })),
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

jest.mock("react-virtuoso", () => ({
  Virtuoso: ({ data, itemContent }: any) => (
    <div data-testid="virtuoso-mock">
      {data.map((item: any, index: number) => (
        <div key={index}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}));

describe("ChatWorkspace", () => {
  const mockSendMessage = jest.fn();
  const mockStop = jest.fn();
  const mockClearMessages = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      isSending: false,
      sendMessage: mockSendMessage,
      stopGeneration: mockStop,
      isHistoryLoading: false,
      historyError: null,
      currentSessionId: null,
      clearMessages: mockClearMessages,
      selectSession: jest.fn(),
    });
  });

  it("renders the chat shell", () => {
    renderWithProviders(<ChatWorkspace repositoryId="repo-1" />);
    expect(screen.getByText("SESSION SIDEBAR")).toBeInTheDocument();
  });

  it("calls sendMessage when form is submitted", () => {
    renderWithProviders(<ChatWorkspace repositoryId="repo-1" />);
    const queryInput = screen.getByPlaceholderText("Describe the changes, ask a question, or reference files...");
    fireEvent.change(queryInput, { target: { value: "Where is auth?" } });
    fireEvent.keyDown(queryInput, { key: "Enter", code: "Enter" });

    expect(mockSendMessage).toHaveBeenCalledWith("Where is auth?", "ASK", []);
  });

  it("shows stop button when loading", () => {
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      isSending: true,
      sendMessage: mockSendMessage,
      stopGeneration: mockStop,
      isHistoryLoading: false,
      historyError: null,
      currentSessionId: "session-1",
      clearMessages: mockClearMessages,
      selectSession: jest.fn(),
    });

    renderWithProviders(<ChatWorkspace repositoryId="repo-1" />);
    const stopButton = screen.getByText("Stop generating");
    expect(stopButton).toBeInTheDocument();
    
    fireEvent.click(stopButton);
    expect(mockStop).toHaveBeenCalled();
  });

  it("displays messages", () => {
    (useChat as jest.Mock).mockReturnValue({
      messages: [
        { id: "msg-1", role: "user", content: "Where is auth?" },
        { id: "msg-2", role: "assistant", content: "Auth is here", intent: "search" }
      ],
      isSending: false,
      sendMessage: mockSendMessage,
      stopGeneration: mockStop,
      isHistoryLoading: false,
      historyError: null,
      currentSessionId: "session-1",
      clearMessages: mockClearMessages,
      selectSession: jest.fn(),
    });

    renderWithProviders(<ChatWorkspace repositoryId="repo-1" />);
    expect(screen.getByText("Where is auth?")).toBeInTheDocument();
    expect(screen.getByText("Auth is here")).toBeInTheDocument();
  });
});
