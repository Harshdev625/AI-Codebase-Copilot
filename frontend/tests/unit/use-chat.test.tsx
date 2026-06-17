import { renderHook, waitFor, act } from "@testing-library/react";
import { 
  useChatSessions, 
  useChatMessages, 
  useDeleteSessionMutation, 
  useChat, 
  useApplyPatchMutation,
  useCreatePatchMutation,
  useValidatePatchMutation,
  useCancelPatchMutation,
  useUpdateSessionMutation
} from "@/features/chat/hooks/use-chat";
import { chatService } from "@/features/chat/services/chat-service";
import type { TraceStep } from "@/features/chat/types/chat-types";
import { TestProviders } from "../test-utils";

jest.mock("uuid", () => ({
  v4: () => "mock-uuid"
}));

jest.mock("@/features/chat/services/chat-service", () => ({
  chatService: {
    listSessions: jest.fn(),
    getSession: jest.fn(),
    listMessages: jest.fn(),
    deleteSession: jest.fn(),
    stream: jest.fn(),
    createPatchDraft: jest.fn(),
    validatePatch: jest.fn(),
    applyPatch: jest.fn(),
    cancelPatchDraft: jest.fn(),
  }
}));

const mockSetActiveSessionId = jest.fn();
let mockActiveSessionId: string | null = "existing-session";

jest.mock("@/features/studio/store/studio-store", () => ({
  useStudioStore: (selector?: (state: { activeSessionId: string | null; setActiveSessionId: (id: string | null) => void }) => unknown) => {
    const state = {
      activeSessionId: mockActiveSessionId,
      setActiveSessionId: (id: string | null) => {
        mockActiveSessionId = id;
        mockSetActiveSessionId(id);
      },
    };
    return selector ? selector(state) : state;
  },
}));

describe("use-chat hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveSessionId = "existing-session";
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
    expect(chatService.listSessions).toHaveBeenCalledWith(20, 0, "repo-1", undefined, undefined);
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

    result.current.mutate({ repositoryId: "repo-1", patchId: "patch-1" });

    await waitFor(() => {
       expect(result.current.isSuccess).toBe(true);
    });

    expect(chatService.applyPatch).toHaveBeenCalledWith("repo-1", "patch-1");
  });

  it("useCreatePatchMutation creates patch draft", async () => {
    (chatService.createPatchDraft as jest.Mock).mockResolvedValueOnce({ patch_id: "patch-1" });

    const { result } = renderHook(() => useCreatePatchMutation(), { wrapper: TestProviders });

    result.current.mutate({ repositoryId: "repo-1", payload: { base_commit_sha: "sha", patch_files: [] } });

    await waitFor(() => {
       expect(result.current.isSuccess).toBe(true);
    });

    expect(chatService.createPatchDraft).toHaveBeenCalledWith("repo-1", { base_commit_sha: "sha", patch_files: [] });
  });

  it("useValidatePatchMutation validates patch", async () => {
    (chatService.validatePatch as jest.Mock).mockResolvedValueOnce({ status: "APPROVED" });

    const { result } = renderHook(() => useValidatePatchMutation(), { wrapper: TestProviders });

    result.current.mutate({ repositoryId: "repo-1", patchId: "patch-1" });

    await waitFor(() => {
       expect(result.current.isSuccess).toBe(true);
    });

    expect(chatService.validatePatch).toHaveBeenCalledWith("repo-1", "patch-1");
  });

  it("useCancelPatchMutation cancels patch draft", async () => {
    (chatService.cancelPatchDraft as jest.Mock).mockResolvedValueOnce({ deleted: true });

    const { result } = renderHook(() => useCancelPatchMutation(), { wrapper: TestProviders });

    result.current.mutate({ repositoryId: "repo-1", patchId: "patch-1" });

    await waitFor(() => {
       expect(result.current.isSuccess).toBe(true);
    });

    expect(chatService.cancelPatchDraft).toHaveBeenCalledWith("repo-1", "patch-1");
  });

  describe("useChat", () => {
    it("handles sending a message and streaming response", async () => {
      (chatService.stream as jest.Mock).mockImplementation(async (payload, onEvent, signal) => {
        onEvent({ type: "start", session_id: "new-session" });
        onEvent({ type: "chunk", delta: "hello " });
        onEvent({ type: "chunk", delta: "world" });
        onEvent({ type: "done", sources: [] });
      });

      const { result } = renderHook(() => useChat({ repositoryId: "repo-1" }), { wrapper: TestProviders });

      await act(async () => {
        await result.current.sendMessage("test message");
      });

      expect(result.current.isSending).toBe(false);
      expect(result.current.messages.length).toBe(2);
      expect(result.current.messages[1].content).toBe("hello world");
      expect(mockSetActiveSessionId).toHaveBeenCalledWith("new-session");
    });

    it("accumulates trace_step and source events", async () => {
      (chatService.stream as jest.Mock).mockImplementation(async (_payload, onEvent) => {
        onEvent({ type: "start", session_id: "existing-session", intent: "search" });
        onEvent({
          type: "trace_step",
          step: {
            node: "retrieval",
            label: "Retrieved 1 sources",
            status: "done",
            detail: {
              retrieved_count: 1,
              source_preview: [{ path: "styles/main.css", score: 0.88 }],
            },
          },
        });
        onEvent({
          type: "source",
          source: { path: "styles/main.css", content: "body {}", score: 0.88 },
        });
        onEvent({ type: "chunk", delta: "Optimize CSS bundles." });
        onEvent({
          type: "done",
          intent: "search",
          sources: [{ path: "styles/main.css", content: "body {}" }],
          trace: [{ node: "retrieval", label: "Retrieved 1 sources" }],
          session_usage: { total_tokens: 120 },
        });
      });

      const { result } = renderHook(() => useChat({ repositoryId: "repo-1" }), { wrapper: TestProviders });

      await act(async () => {
        await result.current.sendMessage("optimize css");
      });

      const assistant = result.current.messages[1];
      expect(assistant.metadata.intent).toBe("search");
      expect(assistant.metadata.traceSteps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ node: "retrieval", label: "Retrieved 1 sources" }),
        ]),
      );
      expect(assistant.metadata.sources).toHaveLength(1);
      expect(assistant.metadata.session_usage).toEqual({ total_tokens: 120 });
      expect(assistant.metadata.isStreaming).toBe(false);
    });

    it("dedupes status and trace_step for the same pipeline step", async () => {
      (chatService.stream as jest.Mock).mockImplementation(async (_payload, onEvent) => {
        onEvent({ type: "start", session_id: "existing-session", intent: "docs" });
        onEvent({ type: "status", step: "Planning intent: docs", stage: "pipeline" });
        onEvent({
          type: "trace_step",
          step: {
            node: "planner",
            label: "Planning intent: docs",
            status: "done",
            detail: { intent: "docs" },
          },
        });
        onEvent({ type: "status", step: "Retrieved 8 sources", stage: "pipeline" });
        onEvent({
          type: "trace_step",
          step: {
            node: "retrieval",
            label: "Retrieved 8 sources",
            status: "done",
            detail: { retrieved_count: 8 },
          },
        });
        onEvent({ type: "chunk", delta: "Project overview." });
        onEvent({ type: "done", intent: "docs", sources: [], trace: [] });
      });

      const { result } = renderHook(() => useChat({ repositoryId: "repo-1" }), { wrapper: TestProviders });

      await act(async () => {
        await result.current.sendMessage("tell me about the project");
      });

      const steps = result.current.messages[1].metadata.traceSteps as TraceStep[];
      expect(steps).toHaveLength(3);
      expect(steps.filter((s) => s.label === "Planning intent: docs")).toHaveLength(1);
      expect(steps.find((s) => s.label === "Planning intent: docs")?.node).toBe("planner");
      expect(steps.filter((s) => s.label === "Retrieved 8 sources")).toHaveLength(1);
    });

    it("new session start does not clear messages", async () => {
      mockActiveSessionId = null;
      (chatService.stream as jest.Mock).mockImplementation(async (_payload, onEvent) => {
        onEvent({ type: "start", session_id: "new-session" });
        onEvent({ type: "status", step: "Planning intent: docs" });
        onEvent({ type: "chunk", delta: "A productivity extension." });
        onEvent({
          type: "done",
          intent: "docs",
          sources: [{ path: "README.md", content: "test" }],
          trace: [{ node: "planner", label: "Planning intent: docs" }],
        });
      });

      const { result } = renderHook(() => useChat({ repositoryId: "repo-1" }), { wrapper: TestProviders });

      await act(async () => {
        await result.current.sendMessage("tell me about the project");
      });

      expect(result.current.messages.length).toBe(2);
      expect(result.current.messages[1].content).toBe("A productivity extension.");
      expect(result.current.messages[1].metadata.statuses).toEqual(["Planning intent: docs"]);
      expect(result.current.messages[1].metadata.traceSteps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ node: "planner", label: "Planning intent: docs" }),
        ]),
      );
    });

    it("keeps local user message when history sync returns assistant-only", async () => {
      (chatService.stream as jest.Mock).mockImplementation(async (_payload, onEvent) => {
        onEvent({ type: "start", session_id: "existing-session" });
        onEvent({ type: "chunk", delta: "Answer text." });
        onEvent({ type: "done", intent: "docs", sources: [], trace: [] });
      });

      (chatService.listMessages as jest.Mock).mockResolvedValue({
        items: [
          {
            id: "server-assistant",
            role: "assistant",
            content: "Answer text.",
            metadata: { intent: "docs" },
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      });

      const { result } = renderHook(() => useChat({ repositoryId: "repo-1" }), { wrapper: TestProviders });

      await act(async () => {
        await result.current.sendMessage("what is this project?");
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      const roles = result.current.messages.map((msg) => msg.role);
      expect(roles).toEqual(expect.arrayContaining(["user", "assistant"]));
      expect(result.current.messages.some((msg) => msg.role === "user" && msg.content.includes("what is this project"))).toBe(true);
    });

    it("merges done metadata even when sources are empty", async () => {
      (chatService.stream as jest.Mock).mockImplementation(async (_payload, onEvent) => {
        onEvent({ type: "start", session_id: "existing-session" });
        onEvent({ type: "chunk", delta: "answer text" });
        onEvent({ type: "done", intent: "search", sources: [], trace: [{ node: "retrieval", label: "Retrieved 0 sources" }] });
      });

      const { result } = renderHook(() => useChat({ repositoryId: "repo-1" }), { wrapper: TestProviders });

      await act(async () => {
        await result.current.sendMessage("test");
      });

      expect(result.current.messages[1].metadata.intent).toBe("search");
      expect(result.current.messages[1].metadata.traceSteps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ node: "retrieval", label: "Retrieved 0 sources" }),
        ]),
      );
    });

    it("clears messages", () => {
      const { result } = renderHook(() => useChat({ repositoryId: "repo-1" }), { wrapper: TestProviders });
      
      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
      expect(mockSetActiveSessionId).toHaveBeenCalledWith(null);
    });

    it("selects a session", () => {
      const { result } = renderHook(() => useChat({ repositoryId: "repo-1" }), { wrapper: TestProviders });
      
      act(() => {
        result.current.selectSession("session-123");
      });

      expect(result.current.messages).toEqual([]);
      expect(mockSetActiveSessionId).toHaveBeenCalledWith("session-123");
    });

    it("stops generation", () => {
      const { result } = renderHook(() => useChat({ repositoryId: "repo-1" }), { wrapper: TestProviders });
      
      act(() => {
        result.current.stopGeneration();
      });

      expect(result.current.isSending).toBe(false);
    });
  });
});
