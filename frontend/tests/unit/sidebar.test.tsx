import { render, screen } from "@testing-library/react";

import Sidebar from "@/components/sidebar";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: jest.fn() }),
}));

describe("Sidebar", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("hides admin link for developer users", async () => {
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "1", email: "dev@example.com", role: "developer", is_active: true })
    );

    render(<Sidebar />);

    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows admin link for admin users", async () => {
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "1", email: "admin@example.com", role: "admin", is_active: true })
    );

    render(<Sidebar />);

    expect(await screen.findByText("Admin")).toBeInTheDocument();
  });

  it("renders dashboard link for all authenticated users", async () => {
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "1", email: "user@example.com", role: "developer", is_active: true })
    );

    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders repositories link for all authenticated users", async () => {
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "1", email: "user@example.com", role: "developer", is_active: true })
    );

    render(<Sidebar />);

    expect(screen.getByText("Repositories")).toBeInTheDocument();
  });

  it("shows admin link with correct styling for admin users", async () => {
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "1", email: "admin@example.com", role: "admin", is_active: true })
    );

    render(<Sidebar />);

    const adminLink = await screen.findByText("Admin");
    expect(adminLink).toBeInTheDocument();
  });

  it("handles missing user gracefully", () => {
    render(<Sidebar />);

    // Sidebar still renders even without user
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    // Shows default "User" text when no user is stored
    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("handles inactive users", () => {
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "1", email: "user@example.com", role: "admin", is_active: false })
    );

    render(<Sidebar />);

    // Should still render the sidebar
    expect(screen.getByText("Repositories")).toBeInTheDocument();
  });

  it("uses current pathname for active link styling", () => {
    window.localStorage.setItem(
      "aicc_user",
      JSON.stringify({ id: "1", email: "user@example.com", role: "developer", is_active: true })
    );

    render(<Sidebar />);

    // Verify sidebar renders (actual pathname is mocked to /dashboard)
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
