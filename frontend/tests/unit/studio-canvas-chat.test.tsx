import { render, screen, fireEvent } from "@testing-library/react";
import { StudioCanvasChat } from "@/features/studio/components/studio-canvas-chat";
import { TestProviders } from "../test-utils";

jest.mock("@/features/chat/components/chat-message-item-bubble", () => ({
  ChatMessageItemBubble: ({ message }: { message: { role: string; content: string } }) => (
    <div data-testid={`message-${message.role}`}>
      {message.role === "assistant" ? (
        <div data-testid="markdown">{message.content}</div>
      ) : (
        message.content
      )}
    </div>
  ),
}));

jest.mock("@/features/chat/hooks/use-session-scope", () => ({
  useSessionScope: jest.fn(() => ({
    scopePaths: [],
    attachedFiles: [],
    setScopePaths: jest.fn(),
    toggleScopePath: jest.fn(),
    toggleAttachedFile: jest.fn(),
    addMentionPath: jest.fn(),
    updateScopeMetadata: jest.fn(),
  })),
}));

jest.mock("@/features/studio/store/studio-store", () => ({
  useStudioStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      setSelectedRepositoryId: jest.fn(),
      activeFilePath: null,
      editorTabs: [],
      activeTabId: null,
    };
    return typeof selector === "function" ? selector(state) : state;
  },
}));

jest.mock("react-markdown", () => ({ children }: { children: React.ReactNode }) => (
  <div data-testid="markdown">{children}</div>
));
jest.mock("react-virtuoso", () => ({
  Virtuoso: ({ data, itemContent }: { data: unknown[]; itemContent: (index: number, item: unknown) => React.ReactNode }) => (
    <div data-testid="virtuoso">
      {data.map((item, index) => itemContent(index, item))}
    </div>
  ),
}));

function buildChat(overrides: Record<string, unknown> = {}) {
  return {
    messages: [],
    sendMessage: jest.fn(),
    stopGeneration: jest.fn(),
    isSending: false,
    isHistoryLoading: false,
    historyError: null,
    currentSessionId: null,
    ...overrides,
  };
}

describe("StudioCanvasChat", () => {
  beforeAll(() => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  it("renders welcome message when no messages", () => {
    render(
      <StudioCanvasChat repositoryId="repo-1" chat={buildChat()} sessions={[]} />,
      { wrapper: TestProviders }
    );
    expect(screen.getByText("How can I help you build today?")).toBeInTheDocument();
  });

  it("renders messages", () => {
    const chat = buildChat({
      messages: [
        { id: "1", role: "user", content: "Hello" },
        { id: "2", role: "assistant", content: "World" },
      ],
      currentSessionId: "session-1",
    });

    render(
      <StudioCanvasChat repositoryId="repo-1" chat={chat} sessions={[]} />,
      { wrapper: TestProviders }
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent("World");
  });

  it("handles sending message", async () => {
    const sendMessageMock = jest.fn();
    const chat = buildChat({ sendMessage: sendMessageMock });

    render(
      <StudioCanvasChat repositoryId="repo-1" chat={chat} sessions={[]} />,
      { wrapper: TestProviders }
    );

    const input = screen.getByPlaceholderText("Ask a question or type @ to reference files…");
    fireEvent.change(input, { target: { value: "my query" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(sendMessageMock).toHaveBeenCalledWith(
      "my query",
      "ASK",
      [],
      expect.objectContaining({ displayContent: "my query" }),
    );
  });

  it("shows stop generating button", () => {
    const stopMock = jest.fn();
    const chat = buildChat({
      stopGeneration: stopMock,
      isSending: true,
      currentSessionId: "session-1",
    });

    render(
      <StudioCanvasChat repositoryId="repo-1" chat={chat} sessions={[]} />,
      { wrapper: TestProviders }
    );

    const stopButton = screen.getByText("Stop generating");
    fireEvent.click(stopButton);
    expect(stopMock).toHaveBeenCalled();
  });
});
