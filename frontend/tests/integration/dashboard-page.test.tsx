import { render, screen } from "@testing-library/react";

import DashboardPage from "@/app/dashboard/page";

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("loads developer dashboard with projects", async () => {
    window.localStorage.setItem("aicc_token", "token-1");
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({
        id: "u1",
        email: "dev@example.com",
        full_name: "Dev User",
        role: "USER",
        is_active: true,
      })
    );

    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            metrics: { projects_count: 2, repositories_count: 3 },
            recent_repositories: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: "p1", name: "Project One", description: "First" },
            { id: "p2", name: "Project Two", description: "Second" },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    render(<DashboardPage />);

    expect(await screen.findByText(/Welcome back, Dev User!/)).toBeInTheDocument();
    expect(await screen.findByText("Your Projects")).toBeInTheDocument();
    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.getByText("Project Two")).toBeInTheDocument();
    expect(screen.queryByText("Admin Control")).not.toBeInTheDocument();
  });

  it("loads admin dashboard metrics", async () => {
    window.localStorage.setItem("aicc_token", "admin-token");
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({
        id: "u2",
        email: "admin@example.com",
        full_name: "Admin User",
        role: "ADMIN",
        is_active: true,
      })
    );

    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          metrics: { projects_count: 1, repositories_count: 1 },
          recent_repositories: [],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            users_count: 10,
            projects_count: 4,
            repositories_count: 5,
            indexed_chunks_count: 100,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    render(<DashboardPage />);

    expect(await screen.findByText(/Welcome back, Admin User!/)).toBeInTheDocument();
    expect(screen.getByText("Admin Control")).toBeInTheDocument();
    expect(screen.queryByText("Your Projects")).not.toBeInTheDocument();
  });
});
