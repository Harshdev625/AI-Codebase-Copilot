import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import AdminPage from "@/app/admin/page";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe("AdminPage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockReplace.mockReset();
    window.localStorage.clear();
    (global as { confirm: (message: string) => boolean }).confirm = jest.fn(() => true);
  });

  it("redirects to login when session is missing", async () => {
    render(<AdminPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("redirects non-admin users to dashboard", async () => {
    window.localStorage.setItem("aicc_token", "token");
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "u1", email: "dev@example.com", role: "developer", is_active: true })
    );

    render(<AdminPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("loads metrics and users for admin", async () => {
    window.localStorage.setItem("aicc_token", "token");
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin", is_active: true })
    );

    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ users_count: 2, projects_count: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin", is_active: true },
            { id: "dev-1", email: "dev@example.com", full_name: "Dev", role: "developer", is_active: true },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    render(<AdminPage />);

    expect(await screen.findByText("Admin Control Panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /users/i }));
    expect(await screen.findByText("Manage Users")).toBeInTheDocument();
    expect(screen.getByText("dev@example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /services/i }));
    expect(await screen.findByText("Backend API")).toBeInTheDocument();
  });

  it("updates user role and reloads users", async () => {
    window.localStorage.setItem("aicc_token", "token");
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin", is_active: true })
    );

    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({ users_count: 2 }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin", is_active: true },
            { id: "dev-1", email: "dev@example.com", full_name: "Dev", role: "developer", is_active: true },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ users_count: 2 }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin", is_active: true },
            { id: "dev-1", email: "dev@example.com", full_name: "Dev", role: "admin", is_active: true },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    render(<AdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: /users/i }));

    const actionButtons = await screen.findAllByTitle(/Promote to admin|Demote to developer/);
    fireEvent.click(actionButtons[0]);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/admin/users/dev-1/role",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("shows load error when metrics request fails", async () => {
    window.localStorage.setItem("aicc_token", "token");
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin", is_active: true })
    );

    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<AdminPage />);

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });

  it("deletes user and refreshes list", async () => {
    window.localStorage.setItem("aicc_token", "token");
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin", is_active: true })
    );

    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({ users_count: 2 }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin", is_active: true },
            { id: "dev-1", email: "dev@example.com", full_name: "Dev", role: "developer", is_active: true },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ users_count: 1 }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: "admin-1", email: "admin@example.com", full_name: "Admin", role: "admin", is_active: true },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    render(<AdminPage />);
    fireEvent.click(await screen.findByRole("button", { name: /users/i }));

    const deleteButton = (await screen.findAllByTitle("Delete user"))[0];
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/admin/users/dev-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
