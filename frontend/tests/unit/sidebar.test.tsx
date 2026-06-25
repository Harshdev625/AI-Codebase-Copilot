import { fireEvent, render, screen } from "@testing-library/react";
import { StudioNavRail } from "@/features/studio/components/studio-nav-rail";
import { TestProviders } from "../test-utils";

const mockFocusSidebar = jest.fn();

jest.mock("@/features/studio/store/studio-store", () => ({
  useStudioStore: () => ({
    primarySidebar: "sessions",
    focusSidebar: mockFocusSidebar,
  }),
}));

describe("StudioNavRail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders studio navigation items", () => {
    render(<StudioNavRail />, { wrapper: TestProviders });

    expect(screen.getByLabelText("Studio navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Chat & Sessions")).toBeInTheDocument();
    expect(screen.getByLabelText("Explorer")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("focuses sessions when chat is clicked", () => {
    render(<StudioNavRail />, { wrapper: TestProviders });

    fireEvent.click(screen.getByLabelText("Chat & Sessions"));
    expect(mockFocusSidebar).toHaveBeenCalledWith("sessions");
  });

  it("focuses explorer when explorer is clicked", () => {
    render(<StudioNavRail />, { wrapper: TestProviders });

    fireEvent.click(screen.getByLabelText("Explorer"));
    expect(mockFocusSidebar).toHaveBeenCalledWith("explorer");
  });
});
