import { fireEvent, screen } from "@testing-library/react";

import { DashboardRecentRepositories } from "@/features/dashboard/components/dashboard-recent-repositories";
import {
  useRepositories,
  useIndexRepository,
  useIndexingJobs,
  useDeleteRepository,
} from "@/features/repositories/hooks/use-repositories";

import { renderWithProviders } from "../test-utils";

jest.mock("@/features/repositories/hooks/use-repositories", () => ({
  useRepositories: jest.fn(),
  useIndexRepository: jest.fn(),
  useIndexingJobs: jest.fn(),
  useDeleteRepository: jest.fn(),
  useRepositoryInsights: jest.fn(() => ({ data: null })),
}));

describe("DashboardRecentRepositories integration", () => {
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useIndexRepository as jest.Mock).mockReturnValue({ mutate: mockMutate, isPending: false });
    (useIndexingJobs as jest.Mock).mockReturnValue({ data: [] });
    (useDeleteRepository as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  });

  it("loads repositories on mount", async () => {
    (useRepositories as jest.Mock).mockReturnValue({
      repositories: [
        {
          id: "r1",
          repo_id: "owner/repo",
          default_branch: "main",
          remote_url: "https://github.com/owner/repo.git",
          latest_job_status: "not_indexed",
          local_path: null,
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
    });

    renderWithProviders(<DashboardRecentRepositories />);

    expect(await screen.findByText("owner/repo")).toBeInTheDocument();
  });

  it("shows empty state when no repositories exist", () => {
    (useRepositories as jest.Mock).mockReturnValue({
      repositories: [],
      isLoading: false,
    });

    renderWithProviders(<DashboardRecentRepositories />);
    expect(screen.getByText("No repositories yet")).toBeInTheDocument();
  });

  it("triggers reindex mutation", async () => {
    (useRepositories as jest.Mock).mockReturnValue({
      repositories: [
        {
          id: "r1",
          repo_id: "owner/repo",
          default_branch: "main",
          remote_url: "https://github.com/owner/repo.git",
          latest_job_status: "completed",
          local_path: null,
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
    });

    renderWithProviders(<DashboardRecentRepositories />);

    const reindexButton = await screen.findByRole("button", { name: /update index/i });
    fireEvent.click(reindexButton);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        repository_id: "r1",
        repo_url: "https://github.com/owner/repo.git",
        repo_ref: "main",
      })
    );
  });
});
