import { fireEvent, render, screen } from "@testing-library/react";
import { DashboardQuickActions } from "@/features/dashboard/components/dashboard-quick-actions";
import { TestProviders } from "../test-utils";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("DashboardQuickActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all quick actions", () => {
    render(<DashboardQuickActions />, { wrapper: TestProviders });

    expect(screen.getByText("Start AI Chat")).toBeInTheDocument();
    expect(screen.getByText("Add Repository")).toBeInTheDocument();
    expect(screen.getByText("Search Code")).toBeInTheDocument();
    expect(screen.getByText("Re-Index Repos")).toBeInTheDocument();
  });

  it("navigates to chat when Start AI Chat is clicked", () => {
    render(<DashboardQuickActions />, { wrapper: TestProviders });

    const chatBtn = screen.getByText("Start AI Chat").closest("button");
    fireEvent.click(chatBtn!);
    
    expect(mockPush).toHaveBeenCalledWith("/studio");
  });

  it("navigates to repositories when Add Repository is clicked", () => {
    render(<DashboardQuickActions />, { wrapper: TestProviders });

    const reposBtn = screen.getByText("Add Repository").closest("button");
    fireEvent.click(reposBtn!);
    
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });
});
