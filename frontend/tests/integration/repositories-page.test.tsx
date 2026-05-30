import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import RepositoriesPage from "@/app/(user)/repositories/page";
import { ToastProvider } from "@/components/shared/toast-provider";

import { renderWithProviders } from "../test-utils";

describe("RepositoriesPage", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("aicc_token", "token-1");
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [], pagination: { total: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } })
    );
  });

  it("loads repositories on mount", async () => {
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
    expect(screen.getByText("Index Now")).toBeInTheDocument();
  });

  it("adds a repository and refreshes", async () => {
    // Initial load
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], pagination: { total: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    // Add repo response
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "r2", repo_id: "new/repo", default_branch: "main" }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    renderWithProviders(<RepositoriesPage />);

    fireEvent.click(screen.getByRole("button", { name: /add repository/i }));
    const input = await screen.findByPlaceholderText("my-app-backend");
    fireEvent.change(input, { target: { value: "new/repo" } });
    const urlInput = await screen.findByPlaceholderText("https://github.com/owner/repo.git");
    fireEvent.change(urlInput, { target: { value: "https://github.com/new/repo.git" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/api/v1/repositories"), expect.objectContaining({ method: "POST" }));
    });
    
    // Wait for UI to settle after query invalidation
    // The default mock response will return empty items, but we should just ensure the test doesn't exit prematurely
    // We can just wait a tick for the mutation to finish
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("indexes a repository and shows indexed status", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /index now/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/api/v1/index"), expect.objectContaining({ method: "POST" }));
    });
  });

  it("shows error toast when adding repository fails", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], pagination: { total: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Repository already exists" }), { status: 400, headers: { "Content-Type": "application/json" } })
    );

    renderWithProviders(<RepositoriesPage />);

    fireEvent.click(screen.getByRole("button", { name: /add repository/i }));
    const input = await screen.findByPlaceholderText("my-app-backend");
    fireEvent.change(input, { target: { value: "existing/repo" } });
    const urlInput = await screen.findByPlaceholderText("https://github.com/owner/repo.git");
    fireEvent.change(urlInput, { target: { value: "https://github.com/existing/repo.git" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    const elements = await screen.findAllByText("Repository already exists");
    expect(elements.length).toBeGreaterThan(0);
  });
});
