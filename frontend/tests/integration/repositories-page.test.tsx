import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import RepositoriesPage from "@/app/repositories/page";

describe("RepositoriesPage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("aicc_token", "token-1");
  });

  it("loads projects and repositories on mount", async () => {
    window.localStorage.setItem("aicc_project_id", "p1");

    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "p1", name: "Project One" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "r1", repo_id: "repo-1", default_branch: "main", remote_url: "https://github.com/o/r.git" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    render(<RepositoriesPage />);

    expect(await screen.findByText("Index repositories for chat")).toBeInTheDocument();
    expect(await screen.findByText("repo-1")).toBeInTheDocument();
  });

  it("creates a project and refreshes repositories", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "p2", name: "Project Two" }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "p2", name: "Project Two" }]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<RepositoriesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /new project/i }));
    fireEvent.change(screen.getByPlaceholderText("My Project"), { target: { value: "Project Two" } });
    fireEvent.change(screen.getByPlaceholderText("Optional description"), { target: { value: "desc" } });
    fireEvent.submit(screen.getByRole("button", { name: /create project/i }).closest("form")!);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/projects",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("shows project creation error from API", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Project exists" }), { status: 400, headers: { "Content-Type": "application/json" } }));

    render(<RepositoriesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /new project/i }));
    fireEvent.change(screen.getByPlaceholderText("My Project"), { target: { value: "Project One" } });
    fireEvent.submit(screen.getByRole("button", { name: /create project/i }).closest("form")!);

    expect(await screen.findByText("Project exists")).toBeInTheDocument();
  });

  it("indexes a repository and shows indexed status", async () => {
    window.localStorage.setItem("aicc_project_id", "p1");
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "p1", name: "Project One" }]), { status: 200, headers: { "Content-Type": "application/json" } })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: "r1", repo_id: "repo-1", default_branch: "main", remote_url: "https://github.com/o/r.git" }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ snapshot_id: "snap-1" }), { status: 202, headers: { "Content-Type": "application/json" } })
      );

    render(<RepositoriesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /index$/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/index",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Indexing…/).length).toBeGreaterThan(0);
    });
  });

  it("shows failed state when indexing request fails", async () => {
    window.localStorage.setItem("aicc_project_id", "p1");
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "p1", name: "Project One" }]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: "r1", repo_id: "repo-1", default_branch: "main", remote_url: "https://github.com/o/r.git" }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Indexing failed" }), { status: 500, headers: { "Content-Type": "application/json" } }));

    render(<RepositoriesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /index$/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/index",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(await screen.findByText("Failed")).toBeInTheDocument();
  });

  it("shows source-missing error for repositories without path or url", async () => {
    window.localStorage.setItem("aicc_project_id", "p1");
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "p1", name: "Project One" }]), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: "r1", repo_id: "repo-1", default_branch: "main", remote_url: null, local_path: null }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    render(<RepositoriesPage />);
    fireEvent.click(await screen.findByRole("button", { name: /index$/i }));

    expect(await screen.findByText(/has no URL or local path configured/)).toBeInTheDocument();
  });
});
