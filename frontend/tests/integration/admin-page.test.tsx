import { render, screen, waitFor } from "@testing-library/react";

import AdminDashboardPage from "@/app/admin/dashboard/page";
import { adminService } from "@/features/admin/services/admin-service";

import { renderWithProviders } from "../test-utils";

jest.mock("@/features/admin/services/admin-service", () => ({
  adminService: {
    metrics: jest.fn(),
    health: jest.fn(),
    users: jest.fn(),
    repositories: jest.fn(),
    indexingStatus: jest.fn(),
  }
}));

const mockedAdmin = adminService as jest.Mocked<typeof adminService>;

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockedAdmin.metrics.mockResolvedValue({ users_count: 2, repositories_count: 5, indexed_chunks_count: 100 });
    mockedAdmin.health.mockResolvedValue([
      { name: "Backend API", status: "healthy", detail: null },
      { name: "PostgreSQL", status: "healthy", detail: null },
    ]);
    mockedAdmin.users.mockResolvedValue({ 
      items: [
        { id: "u1", email: "admin@example.com", full_name: "Admin", role: "ADMIN", is_active: true, created_at: "" },
        { id: "u2", email: "dev@example.com", full_name: "Dev", role: "USER", is_active: true, created_at: "" }
      ], 
      pagination: { total: 2, limit: 100, offset: 0, has_more: false } 
    });
    mockedAdmin.repositories.mockResolvedValue({ 
      items: [
        { id: "r1", repo_id: "test-repo", remote_url: "", local_path: "", default_branch: "main", created_at: "", latest_job_status: "completed" }
      ], 
      pagination: { total: 1, limit: 100, offset: 0, has_more: false } 
    });
    mockedAdmin.indexingStatus.mockResolvedValue({ 
      items: [
        { id: "j1", repository_id: "test-repo", commit_sha: "abc", status: "completed", message: "", started_at: "", finished_at: "", created_at: "" }
      ], 
      pagination: { total: 1, limit: 100, offset: 0, has_more: false } 
    });
  });

  it("renders dashboard title and metrics", async () => {
    renderWithProviders(<AdminDashboardPage />);

    expect(await screen.findByText("Admin Dashboard")).toBeInTheDocument();
    
    expect(await screen.findByText("2")).toBeInTheDocument(); // active users
    expect(await screen.findByText("5")).toBeInTheDocument(); // repositories
    expect(await screen.findByText("100")).toBeInTheDocument(); // chunks
  });

  it("renders service health", async () => {
    renderWithProviders(<AdminDashboardPage />);
    
    expect(await screen.findByText("Service Health")).toBeInTheDocument();
    expect(await screen.findByText("Backend API")).toBeInTheDocument();
    expect(await screen.findByText("PostgreSQL")).toBeInTheDocument();
  });

  it("renders recent users", async () => {
    renderWithProviders(<AdminDashboardPage />);

    expect(await screen.findByText("Recent Users")).toBeInTheDocument();
    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
    expect(await screen.findByText("dev@example.com")).toBeInTheDocument();
  });

  it("renders recent repositories and indexing jobs", async () => {
    renderWithProviders(<AdminDashboardPage />);

    expect(await screen.findByText("Recent Repositories")).toBeInTheDocument();
    expect(await screen.findByText("test-repo")).toBeInTheDocument();
    
    expect(await screen.findByText("Latest Indexing Jobs")).toBeInTheDocument();
  });
});
