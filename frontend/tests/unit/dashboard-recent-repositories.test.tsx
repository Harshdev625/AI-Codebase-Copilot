import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardRecentRepositories } from "@/features/dashboard/components/dashboard-recent-repositories";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { TestProviders } from "../test-utils";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("@/features/dashboard/hooks/use-dashboard", () => ({
  useDashboard: jest.fn(),
}));

describe("DashboardRecentRepositories", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading skeleton", () => {
    (useDashboard as jest.Mock).mockReturnValue({ isLoading: true });
    render(<DashboardRecentRepositories />, { wrapper: TestProviders });
    expect(screen.queryByText("No Sources Linked")).not.toBeInTheDocument();
  });

  it("renders empty state", () => {
    (useDashboard as jest.Mock).mockReturnValue({
      isLoading: false,
      summary: { recent_repositories: [] },
    });
    
    render(<DashboardRecentRepositories />, { wrapper: TestProviders });
    expect(screen.getByText("No Sources Linked")).toBeInTheDocument();

    const linkBtn = screen.getByText("Link Repository");
    fireEvent.click(linkBtn);
    expect(mockPush).toHaveBeenCalledWith("/repositories");
  });

  it("renders repositories", () => {
    (useDashboard as jest.Mock).mockReturnValue({
      isLoading: false,
      summary: {
        recent_repositories: [
          {
            id: "repo-1",
            repo_id: "test/repo-1",
            default_branch: "main",
            created_at: new Date().toISOString(),
            latest_index_status: "completed",
          },
        ],
      },
    });

    render(<DashboardRecentRepositories />, { wrapper: TestProviders });
    expect(screen.getByText("test/repo-1")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
  });
});
