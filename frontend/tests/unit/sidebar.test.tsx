import { fireEvent, render, screen } from "@testing-library/react";
import { StudioNavRail } from "@/features/studio/components/studio-nav-rail";
import { TestProviders } from "../test-utils";

const mockSetCanvasMode = jest.fn();
const mockToggleSecondaryPanel = jest.fn();

jest.mock("@/features/studio/store/studio-store", () => ({
  useStudioStore: () => ({
    secondaryPanel: null,
    toggleSecondaryPanel: mockToggleSecondaryPanel,
    setCanvasMode: mockSetCanvasMode,
    canvasMode: "chat",
  }),
}));

describe("StudioNavRail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders studio navigation items", () => {
    render(<StudioNavRail />, { wrapper: TestProviders });

    expect(screen.getByLabelText("Studio navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Chat")).toBeInTheDocument();
    expect(screen.getByLabelText("Explorer")).toBeInTheDocument();
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
  });

  it("switches to chat canvas when chat is clicked", () => {
    render(<StudioNavRail />, { wrapper: TestProviders });

    fireEvent.click(screen.getByLabelText("Chat"));
    expect(mockSetCanvasMode).toHaveBeenCalledWith("chat");
  });

  it("toggles explorer panel when explorer is clicked", () => {
    render(<StudioNavRail />, { wrapper: TestProviders });

    fireEvent.click(screen.getByLabelText("Explorer"));
    expect(mockToggleSecondaryPanel).toHaveBeenCalledWith("explorer");
  });
});
