import { useStudioStore } from "@/features/studio/store/studio-store";

jest.mock("@/features/workspace/store/workspace-store", () => {
  const state = {
    activeRepositoryId: null as string | null,
    activeSessionId: null as string | null,
    setActiveRepositoryId: jest.fn(),
    setActiveSessionId: jest.fn(),
  };
  return {
    useWorkspaceStore: Object.assign(
      (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
      { getState: () => state }
    ),
  };
});

describe("studio-store", () => {
  beforeEach(() => {
    const state = useStudioStore.getState();
    state.setCanvasMode("chat");
    state.setSecondaryPanel(null);
    state.setActiveFilePath(null);
  });

  it("sets canvas mode", () => {
    useStudioStore.getState().setCanvasMode("editor");
    expect(useStudioStore.getState().canvasMode).toBe("editor");
  });

  it("toggles secondary panel", () => {
    useStudioStore.getState().toggleSecondaryPanel("explorer");
    expect(useStudioStore.getState().secondaryPanel).toBe("explorer");

    useStudioStore.getState().toggleSecondaryPanel("explorer");
    expect(useStudioStore.getState().secondaryPanel).toBeNull();
  });

  it("opens a different secondary panel directly", () => {
    useStudioStore.getState().setSecondaryPanel("patches");
    expect(useStudioStore.getState().secondaryPanel).toBe("patches");
  });
});
