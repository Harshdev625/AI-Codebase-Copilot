import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../test-utils";
import { ChatWorkspace } from "@/features/chat/components/chat-workspace";
import { useChat } from "@/features/chat/hooks/use-chat";

jest.mock("@/features/chat/hooks/use-chat", () => ({
  useChat: jest.fn(),
  useChatSessions: jest.fn(() => ({ data: { items: [] }, isLoading: false })),
  useDeleteSessionMutation: jest.fn(() => ({ mutateAsync: jest.fn() })),
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
  const mockLoadSessions = jest.fn();
  const mockClearMessages = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      isSending: false,
      sendMessage: mockSendMessage,
      stopGeneration: mockStop,
      sessions: [],
      loadSessions: mockLoadSessions,
      currentSessionId: "session-1",
      clearMessages: mockClearMessages,
    });
  });

  it("renders the chat shell", () => {
    renderWithProviders(<ChatWorkspace mode="repository" repositoryId="repo-1" />);
    expect(screen.getByText("Conversations")).toBeInTheDocument();
  });

  it("calls sendMessage when form is submitted", () => {
    renderWithProviders(<ChatWorkspace mode="repository" repositoryId="repo-1" />);
    const queryInput = screen.getByPlaceholderText("Ask a question about the codebase...");
    fireEvent.change(queryInput, { target: { value: "Where is auth?" } });
    fireEvent.keyDown(queryInput, { key: "Enter", code: "Enter" });

    expect(mockSendMessage).toHaveBeenCalledWith("Where is auth?");
  });

  it("shows stop button when loading", () => {
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      isSending: true,
      sendMessage: mockSendMessage,
      stopGeneration: mockStop,
      sessions: [],
      loadSessions: mockLoadSessions,
      currentSessionId: "session-1",
      clearMessages: mockClearMessages,
    });

    renderWithProviders(<ChatWorkspace mode="repository" repositoryId="repo-1" />);
    const stopButton = screen.getByRole("button", { name: /stop generating/i });
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
      sessions: [],
      loadSessions: mockLoadSessions,
      currentSessionId: "session-1",
      clearMessages: mockClearMessages,
    });

    renderWithProviders(<ChatWorkspace mode="repository" repositoryId="repo-1" />);
    expect(screen.getByText("Where is auth?")).toBeInTheDocument();
    expect(screen.getByText("Auth is here")).toBeInTheDocument();
  });
});
