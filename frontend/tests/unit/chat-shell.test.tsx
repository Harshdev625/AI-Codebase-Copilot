import { fireEvent, render, screen } from "@testing-library/react";
import { ChatWorkspace } from "@/features/chat/components/chat-workspace";
import { useChat } from "@/features/chat/hooks/use-chat";

jest.mock("@/features/chat/hooks/use-chat", () => ({
  useChat: jest.fn(),
}));

describe("ChatWorkspace", () => {
  const mockSendMessage = jest.fn();
  const mockStop = jest.fn();
  const mockLoadSessions = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      isLoading: false,
      sendMessage: mockSendMessage,
      stop: mockStop,
      sessions: [],
      loadSessions: mockLoadSessions,
      activeSessionId: "session-1",
    });
  });

  it("renders the chat shell", () => {
    render(<ChatWorkspace />);
    expect(screen.getByText("AI Code Assistant")).toBeInTheDocument();
  });

  it("calls sendMessage when form is submitted", () => {
    render(<ChatWorkspace />);
    const queryInput = screen.getByPlaceholderText("Ask anything about your code…");
    fireEvent.change(queryInput, { target: { value: "Where is auth?" } });
    fireEvent.submit(queryInput.closest("form")!);

    expect(mockSendMessage).toHaveBeenCalledWith("Where is auth?");
  });

  it("shows stop button when loading", () => {
    (useChat as jest.Mock).mockReturnValue({
      messages: [],
      isLoading: true,
      sendMessage: mockSendMessage,
      stop: mockStop,
      sessions: [],
      loadSessions: mockLoadSessions,
      activeSessionId: "session-1",
    });

    render(<ChatWorkspace />);
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
      isLoading: false,
      sendMessage: mockSendMessage,
      stop: mockStop,
      sessions: [],
      loadSessions: mockLoadSessions,
      activeSessionId: "session-1",
    });

    render(<ChatWorkspace />);
    expect(screen.getByText("Where is auth?")).toBeInTheDocument();
    expect(screen.getByText("Auth is here")).toBeInTheDocument();
  });
});
