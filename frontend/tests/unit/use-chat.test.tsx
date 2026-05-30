import { renderHook, waitFor, act } from "@testing-library/react";
import { useChatSessions, useChatMessages, useDeleteSessionMutation, useChat, useApplyPatchMutation } from "@/features/chat/hooks/use-chat";
import { chatService } from "@/features/chat/services/chat-service";
import { TestProviders } from "../test-utils";

jest.mock("uuid", () => ({
  v4: () => "mock-uuid"
}));

jest.mock("@/features/chat/services/chat-service", () => ({
  chatService: {
    listSessions: jest.fn(),
    listMessages: jest.fn(),
    deleteSession: jest.fn(),
    stream: jest.fn(),
    applyPatch: jest.fn(),
  }
}));

describe("use-chat hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (chatService.listMessages as jest.Mock).mockResolvedValue({ items: [], total: 0 });
  });

  it("useChatSessions returns sessions", async () => {
    const mockData = { items: [{ id: "session-1" }], total: 1 };
    (chatService.listSessions as jest.Mock).mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useChatSessions(20, 0, "repo-1"), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(chatService.listSessions).toHaveBeenCalledWith(20, 0, "repo-1");
  });

  it("useChatMessages returns messages", async () => {
    const mockData = { items: [{ id: "msg-1" }], total: 1 };
    (chatService.listMessages as jest.Mock).mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useChatMessages("session-1", 50, 0), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(chatService.listMessages).toHaveBeenCalledWith("session-1", 50, 0);
  });

  it("useDeleteSessionMutation deletes session", async () => {
    (chatService.deleteSession as jest.Mock).mockResolvedValueOnce({ deleted: true });

    const { result } = renderHook(() => useDeleteSessionMutation(), { wrapper: TestProviders });

    result.current.mutate("session-1");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(chatService.deleteSession).toHaveBeenCalledWith("session-1");
  });

  it("useApplyPatchMutation applies patch", async () => {
    (chatService.applyPatch as jest.Mock).mockResolvedValueOnce({ applied: true });

    const { result } = renderHook(() => useApplyPatchMutation(), { wrapper: TestProviders });

    result.current.mutate({ repositoryId: "repo-1", diff: "diff" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(chatService.applyPatch).toHaveBeenCalledWith("repo-1", "diff");
  });

  describe("useChat", () => {
    it("handles sending a message and streaming response", async () => {
      (chatService.stream as jest.Mock).mockImplementation(async (payload, onEvent, signal) => {
        onEvent({ type: "start", session_id: "new-session" });
        onEvent({ type: "chunk", delta: "hello " });
        onEvent({ type: "chunk", delta: "world" });
        onEvent({ type: "done", sources: [] });
      });

      const { result } = renderHook(() => useChat({ mode: "project" }), { wrapper: TestProviders });

      await act(async () => {
        await result.current.sendMessage("test message");
      });

      expect(result.current.isSending).toBe(false);
      expect(result.current.messages.length).toBe(2);
      expect(result.current.messages[1].content).toBe("hello world");
      expect(result.current.currentSessionId).toBe("new-session");
    });

    it("clears messages", () => {
      const { result } = renderHook(() => useChat({ mode: "project" }), { wrapper: TestProviders });
      
      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.currentSessionId).toBeNull();
    });

    it("selects a session", () => {
      const { result } = renderHook(() => useChat({ mode: "project" }), { wrapper: TestProviders });
      
      act(() => {
        result.current.selectSession("session-123");
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.currentSessionId).toBe("session-123");
    });

    it("stops generation", () => {
      const { result } = renderHook(() => useChat({ mode: "project" }), { wrapper: TestProviders });
      
      act(() => {
        result.current.stopGeneration();
      });

      expect(result.current.isSending).toBe(false);
    });
  });
});
