import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";

import { useStudioUrlSync } from "@/features/studio/hooks/use-studio-url-sync";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { WELCOME_TAB_ID } from "@/features/studio/types/studio-types";

const mockReplace = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

function resetStore() {
  useStudioStore.setState({
    primarySidebar: "explorer",
    aiPanelOpen: false,
    selectedRepositoryId: "repo-1",
    activeSessionId: null,
    editorTabs: [{ id: WELCOME_TAB_ID, kind: "welcome", title: "Welcome" }],
    activeTabId: WELCOME_TAB_ID,
  });
}

describe("useStudioUrlSync", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    for (const key of [...mockSearchParams.keys()]) {
      mockSearchParams.delete(key);
    }
    resetStore();
  });

  it("prefers panel=explorer over ai=open on read", async () => {
    mockSearchParams.set("panel", "explorer");
    mockSearchParams.set("ai", "open");
    mockSearchParams.set("repository_id", "repo-1");

    renderHook(() => useStudioUrlSync());

    await waitFor(() => {
      expect(useStudioStore.getState().primarySidebar).toBe("explorer");
      expect(useStudioStore.getState().aiPanelOpen).toBe(false);
    });
  });

  it("keeps sidebar panel state in the store, not the URL", async () => {
    useStudioStore.setState({ primarySidebar: "sessions", aiPanelOpen: true });

    renderHook(() => useStudioUrlSync());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });

    const lastCall = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastCall).not.toContain("ai=open");
    expect(lastCall).not.toContain("panel=explorer");
    expect(lastCall).toContain("repository_id=repo-1");
  });

  it("keeps editor panel state in the store, not the URL", async () => {
    useStudioStore.setState({ primarySidebar: "explorer", aiPanelOpen: false });

    renderHook(() => useStudioUrlSync());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });

    const lastCall = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastCall).not.toContain("panel=explorer");
    expect(lastCall).not.toContain("ai=open");
    expect(lastCall).toContain("repository_id=repo-1");
  });
});
