import { useStudioStore } from "@/features/studio/store/studio-store";

describe("studio-store", () => {
  beforeEach(() => {
    useStudioStore.setState({
      selectedRepositoryId: null,
      activeSessionId: null,
      activePatchId: null,
      selectedSnapshotId: null,
      searchQuery: "",
      searchResults: [],
      hasSearched: false,
      canvasMode: "chat",
      secondaryPanel: null,
      activeFilePath: null,
      activeFileInitialLine: undefined,
      activeFileCommitSha: undefined,
    });
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

  it("resets session state when repository changes", () => {
    useStudioStore.setState({
      selectedRepositoryId: "repo-1",
      activeSessionId: "session-1",
      activePatchId: "patch-1",
    });

    useStudioStore.getState().setSelectedRepositoryId("repo-2");

    const state = useStudioStore.getState();
    expect(state.selectedRepositoryId).toBe("repo-2");
    expect(state.activeSessionId).toBeNull();
    expect(state.activePatchId).toBeNull();
  });

  it("opens file in editor canvas", () => {
    useStudioStore.getState().openFileInEditor("src/main.ts", 42);
    const state = useStudioStore.getState();
    expect(state.activeFilePath).toBe("src/main.ts");
    expect(state.activeFileInitialLine).toBe(42);
    expect(state.canvasMode).toBe("editor");
  });
});
