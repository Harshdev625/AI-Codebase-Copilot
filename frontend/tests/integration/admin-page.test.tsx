import { fireEvent, render, screen } from "@testing-library/react";

import AdminDashboardPage from "@/app/admin/dashboard/page";
import { useAdminDashboard } from "@/features/admin/hooks/use-admin-dashboard";
import { useIndexRepository } from "@/features/repositories/hooks/use-repositories";

import { renderWithProviders } from "../test-utils";

jest.mock("@/features/admin/hooks/use-admin-dashboard", () => ({
  useAdminDashboard: jest.fn(),
}));

jest.mock("@/features/repositories/hooks/use-repositories", () => ({
  useIndexRepository: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));

const mockedDashboard = useAdminDashboard as jest.Mock;

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedDashboard.mockReturnValue({
      metricsQuery: {
        data: {
          repositories_count: 5,
          indexed_chunks_count: 100,
          indexed_files_count: 42,
          active_sessions: 3,
          patch_count: 2,
          snapshot_count: 7,
        },
        isLoading: false,
      },
      healthQuery: {
        data: [
          { name: "Backend API", status: "online", detail: null },
          { name: "PostgreSQL", status: "online", detail: null },
        ],
        isLoading: false,
      },
      usersQuery: {
        data: [
          { id: "u1", email: "admin@example.com", full_name: "Admin", role: "ADMIN", is_active: true, created_at: "" },
          { id: "u2", email: "dev@example.com", full_name: "Dev", role: "USER", is_active: true, created_at: "" },
        ],
        isLoading: false,
      },
      repositoriesQuery: {
        data: [
          { id: "r1", repo_id: "test-repo", remote_url: "", local_path: "", default_branch: "main", created_at: "", latest_job_status: "completed" },
        ],
        isLoading: false,
      },
      indexingQuery: {
        data: [
          { id: "j1", repository_id: "r1", commit_sha: "abc", status: "completed", message: "", started_at: "", finished_at: "", created_at: "" },
        ],
        isLoading: false,
      },
      telemetryQuery: {
        data: { active_streams: 1, indexing_running: 0, indexing_queue_depth: 0, model_latency: { p95_ms: 120 }, queue_health: { failed_jobs: 0 } },
        isLoading: false,
      },
      recentActivityQuery: {
        data: {
          indexing_jobs: {
            items: [
              { id: "j1", repository_id: "r1", commit_sha: "abc", status: "completed", message: "", started_at: "", finished_at: "", created_at: "" },
            ],
          },
          recent_users: {
            items: [
              { id: "u1", email: "admin@example.com", full_name: "Admin", role: "ADMIN", is_active: true, created_at: "" },
            ],
          },
        },
        isLoading: false,
      },
    });
  });

  it("renders dashboard title and metrics", async () => {
    renderWithProviders(<AdminDashboardPage />);

    expect(await screen.findByText("Admin Control")).toBeInTheDocument();
    expect(await screen.findByText("Platform Metrics")).toBeInTheDocument();
    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(await screen.findByText("100")).toBeInTheDocument();
  });

  it("renders system health", async () => {
    renderWithProviders(<AdminDashboardPage />);
    
    expect(await screen.findByText("System Health")).toBeInTheDocument();
    expect(await screen.findByText("Backend API")).toBeInTheDocument();
    expect(await screen.findByText("PostgreSQL")).toBeInTheDocument();
  });

  it("renders users on users tab", async () => {
    renderWithProviders(<AdminDashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: /users & access/i }));

    expect(await screen.findByText("Access & User Management")).toBeInTheDocument();
    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
  });

  it("renders repositories and indexing jobs on repositories tab", async () => {
    renderWithProviders(<AdminDashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: /^repositories$/i }));

    expect(await screen.findByText("Repository Operations")).toBeInTheDocument();
    expect((await screen.findAllByText("test-repo")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Indexing Job History")).toBeInTheDocument();
  });
});
