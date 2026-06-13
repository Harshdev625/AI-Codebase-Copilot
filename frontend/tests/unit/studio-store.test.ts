import { useStudioStore } from "@/features/studio/store/studio-store";
import { WELCOME_TAB_ID } from "@/features/studio/types/studio-types";

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
      primarySidebar: "sessions",
      aiPanelOpen: true,
      sidebarCollapsed: false,
      editorTabs: [{ id: WELCOME_TAB_ID, kind: "welcome", title: "Welcome" }],
      activeTabId: WELCOME_TAB_ID,
      activeFilePath: null,
      activeFileInitialLine: undefined,
      activeFileCommitSha: undefined,
    });
  });

  it("opens file tab and sets active path", () => {
    useStudioStore.getState().openFileTab("src/main.ts", 42);
    const state = useStudioStore.getState();
    expect(state.activeFilePath).toBe("src/main.ts");
    expect(state.activeFileInitialLine).toBe(42);
    expect(state.activeTabId).toBe("file:src/main.ts");
    expect(state.editorTabs.some((t) => t.kind === "file")).toBe(true);
  });

  it("opens patch tab", () => {
    useStudioStore.getState().openPatchTab("patch-123");
    const state = useStudioStore.getState();
    expect(state.activePatchId).toBe("patch-123");
    expect(state.activeTabId).toBe("patch:patch-123");
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

  it("focusSidebar uncollapses and sets panel", () => {
    useStudioStore.setState({ sidebarCollapsed: true, primarySidebar: "explorer" });
    useStudioStore.getState().focusSidebar("search");
    const state = useStudioStore.getState();
    expect(state.primarySidebar).toBe("search");
    expect(state.sidebarCollapsed).toBe(false);
  });

  it("setPrimarySidebar uncollapses sidebar", () => {
    useStudioStore.setState({ sidebarCollapsed: true });
    useStudioStore.getState().setPrimarySidebar("patches");
    const state = useStudioStore.getState();
    expect(state.primarySidebar).toBe("patches");
    expect(state.sidebarCollapsed).toBe(false);
  });

  it("setSidebarCollapsed toggles collapse explicitly", () => {
    useStudioStore.getState().setSidebarCollapsed(true);
    expect(useStudioStore.getState().sidebarCollapsed).toBe(true);
    useStudioStore.getState().setSidebarCollapsed(false);
    expect(useStudioStore.getState().sidebarCollapsed).toBe(false);
  });

  it("setAiPanelOpen switches to sessions mode", () => {
    useStudioStore.setState({ primarySidebar: "explorer", aiPanelOpen: false });
    useStudioStore.getState().setAiPanelOpen(true);
    const state = useStudioStore.getState();
    expect(state.aiPanelOpen).toBe(true);
    expect(state.primarySidebar).toBe("sessions");
    expect(state.sidebarCollapsed).toBe(false);
  });

  it("openFileInEditor alias opens file tab", () => {
    useStudioStore.getState().openFileInEditor("lib/utils.ts");
    expect(useStudioStore.getState().activeFilePath).toBe("lib/utils.ts");
  });
});
