import { fireEvent, render, screen } from "@testing-library/react";

import AdminDashboardPage from "@/app/admin/dashboard/page";
import { useAdminDashboard } from "@/features/admin/hooks/use-admin-dashboard";
import { useIndexRepository } from "@/features/repositories/hooks/use-repositories";
import { adminService } from "@/features/admin/services/admin-service";

import { renderWithProviders } from "../test-utils";

jest.mock("@/features/admin/hooks/use-admin-dashboard", () => ({
  useAdminDashboard: jest.fn(),
}));

jest.mock("@/features/repositories/hooks/use-repositories", () => ({
  useIndexRepository: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));

jest.mock("@/features/admin/services/admin-service", () => ({
  adminService: {
    users: jest.fn(),
    updateUserRole: jest.fn(),
    updateUserStatus: jest.fn(),
    deleteUser: jest.fn(),
  },
}));

const mockedDashboard = useAdminDashboard as jest.Mock;
const mockedUsers = adminService.users as jest.Mock;

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedUsers.mockResolvedValue({
      items: [
        { id: "u1", email: "admin@example.com", full_name: "Admin", role: "ADMIN", is_active: true, created_at: "" },
        { id: "u2", email: "dev@example.com", full_name: "Dev", role: "USER", is_active: true, created_at: "" },
      ],
      pagination: { total: 2, limit: 20, offset: 0, has_more: false },
    });

    mockedDashboard.mockReturnValue({
      metricsQuery: {
        data: {
          users_count: 12,
          repositories_count: 5,
          indexed_chunks_count: 100,
          indexed_files_count: 42,
          active_sessions: 3,
          patch_count: 2,
          snapshot_count: 7,
        },
        isLoading: false,
        isError: false,
      },
      healthQuery: {
        data: [
          { name: "Backend API", status: "online", detail: null },
          { name: "PostgreSQL", status: "online", detail: null },
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
        data: {
          active_streams: 1,
          indexing_running: 0,
          indexing_queue_depth: 0,
          model_latency: { p95_ms: 120, avg_ms: 80, p50_ms: 70, samples_ms: [] },
          queue_health: { total_jobs: 10, failed_jobs: 0, failure_rate_pct: 0 },
          retrieval_hit_profile: { sample_size: 0, top1_hit_rate_pct: 0, top3_hit_rate_pct: 0, zero_hit_rate_pct: 0 },
        },
        isLoading: false,
        isError: false,
      },
      recentActivityQuery: {
        data: {
          indexing_jobs: {
            items: [
              { id: "j1", repository_id: "r1", commit_sha: "abc", status: "completed", message: "", started_at: "", finished_at: "", created_at: "" },
            ],
            pagination: { total: 1, limit: 20, offset: 0, has_more: false },
          },
          recent_users: {
            items: [],
            pagination: { total: 0, limit: 20, offset: 0, has_more: false },
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
    expect(await screen.findByText("12")).toBeInTheDocument();
  });

  it("shows collecting samples when telemetry has no sample size", async () => {
    renderWithProviders(<AdminDashboardPage />);
    expect((await screen.findAllByText("Collecting samples…")).length).toBeGreaterThan(0);
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
    expect((await screen.findAllByText("admin@example.com")).length).toBeGreaterThan(0);
  });

  it("opens manage dialog when Manage is clicked", async () => {
    renderWithProviders(<AdminDashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: /users & access/i }));
    const manageButtons = await screen.findAllByRole("button", { name: /^manage$/i });
    fireEvent.click(manageButtons[0]);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("Manage user")).toBeInTheDocument();
  });

  it("renders repositories and indexing jobs on repositories tab", async () => {
    renderWithProviders(<AdminDashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: /^repositories$/i }));

    expect(await screen.findByText("Repository Operations")).toBeInTheDocument();
    expect((await screen.findAllByText("test-repo")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Indexing Job History")).toBeInTheDocument();
  });
});
