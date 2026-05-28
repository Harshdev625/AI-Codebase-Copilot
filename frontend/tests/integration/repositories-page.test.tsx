import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import RepositoriesPage from "@/app/(user)/repositories/page";
import { ToastProvider } from "@/components/shared/toast-provider";

import { renderWithProviders } from "../test-utils";

describe("RepositoriesPage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("aicc_token", "token-1");
  });

  it("loads repositories on mount", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [{ id: "r1", repo_id: "owner/repo", default_branch: "main", remote_url: "https://github.com/owner/repo.git", latest_job_status: "not_indexed" }],
          pagination: { total: 1, limit: 100, offset: 0, has_more: false }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    renderWithProviders(<RepositoriesPage />);

    expect(await screen.findByText("owner/repo")).toBeInTheDocument();
    expect(screen.getByText("Start Index")).toBeInTheDocument();
  });

  it("adds a repository and refreshes", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    // Initial load
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], pagination: { total: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    // Add repo response
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "r2", repo_id: "new/repo", default_branch: "main" }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    renderWithProviders(<RepositoriesPage />);

    fireEvent.change(screen.getByPlaceholderText("owner/repo"), { target: { value: "new/repo" } });
    fireEvent.submit(screen.getByRole("button", { name: /add/i }).closest("form")!);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/api/v1/repositories"), expect.objectContaining({ method: "POST" }));
    });
  });

  it("indexes a repository and shows indexed status", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    // Initial load
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [{ id: "r1", repo_id: "owner/repo", default_branch: "main", remote_url: "https://github.com/owner/repo.git", latest_job_status: "not_indexed" }],
          pagination: { total: 1, limit: 100, offset: 0, has_more: false }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    // Start index response
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ indexing_job_id: "job-1" }), { status: 202, headers: { "Content-Type": "application/json" } })
    );

    renderWithProviders(<RepositoriesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /start index/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/api/v1/index"), expect.objectContaining({ method: "POST" }));
    });
  });

  it("shows error toast when adding repository fails", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], pagination: { total: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Repository already exists" }), { status: 400, headers: { "Content-Type": "application/json" } })
    );

    renderWithProviders(<RepositoriesPage />);

    fireEvent.change(screen.getByPlaceholderText("owner/repo"), { target: { value: "existing/repo" } });
    fireEvent.submit(screen.getByRole("button", { name: /add/i }).closest("form")!);

    expect(await screen.findByText("Repository already exists")).toBeInTheDocument();
  });
});
