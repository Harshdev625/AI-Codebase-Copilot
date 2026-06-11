import { render, screen } from "@testing-library/react";
import { DashboardRecentRepositories } from "@/features/dashboard/components/dashboard-recent-repositories";
import {
  useRepositories,
  useIndexRepository,
  useIndexingJobs,
} from "@/features/repositories/hooks/use-repositories";
import { TestProviders } from "../test-utils";

jest.mock("@/features/repositories/hooks/use-repositories", () => ({
  useRepositories: jest.fn(),
  useIndexRepository: jest.fn(),
  useIndexingJobs: jest.fn(),
}));

describe("DashboardRecentRepositories", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useIndexRepository as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
    (useIndexingJobs as jest.Mock).mockReturnValue({ data: [] });
  });

  it("renders loading skeleton", () => {
    (useRepositories as jest.Mock).mockReturnValue({ repositories: [], isLoading: true });
    render(<DashboardRecentRepositories />, { wrapper: TestProviders });
    expect(screen.queryByText("No repositories yet")).not.toBeInTheDocument();
  });

  it("renders empty state", () => {
    (useRepositories as jest.Mock).mockReturnValue({
      repositories: [],
      isLoading: false,
    });

    render(<DashboardRecentRepositories />, { wrapper: TestProviders });
    expect(screen.getByText("No repositories yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add your first repository to start indexing and exploring your codebase.")
    ).toBeInTheDocument();
  });

  it("renders repositories", () => {
    (useRepositories as jest.Mock).mockReturnValue({
      repositories: [
        {
          id: "repo-1",
          repo_id: "test/repo-1",
          default_branch: "main",
          created_at: new Date().toISOString(),
          latest_job_status: "completed",
          remote_url: "https://github.com/test/repo-1.git",
          local_path: null,
        },
      ],
      isLoading: false,
    });

    render(<DashboardRecentRepositories />, { wrapper: TestProviders });
    expect(screen.getByText("test/repo-1")).toBeInTheDocument();
    expect(screen.getByText("READY")).toBeInTheDocument();
  });
});
