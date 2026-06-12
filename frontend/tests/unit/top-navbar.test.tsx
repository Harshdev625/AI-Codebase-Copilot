import { fireEvent, render, screen } from "@testing-library/react";
import { TopNavbar } from "@/components/layout/top-navbar";
import { TestProviders } from "../test-utils";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("TopNavbar", () => {
  it("renders desktop navbar content", () => {
    const signOutSpy = jest.fn();
    const { container } = render(
      <TopNavbar
        sectionTitle="Test App"
        userEmail="test@example.com"
        onSignOut={signOutSpy}
      />,
      { wrapper: TestProviders }
    );

    expect(screen.getAllByText("Test App").length).toBeGreaterThan(0);
    expect(screen.getByText("Search or run command…")).toBeInTheDocument();
    expect(screen.getByText("Copilot")).toBeInTheDocument();
    expect(container.querySelector(".h-14")).toBeTruthy();
  });

  it("renders admin breadcrumbs when variant is admin", () => {
    render(
      <TopNavbar
        sectionTitle="Dashboard"
        userEmail="admin@example.com"
        onSignOut={jest.fn()}
        variant="admin"
      />,
      { wrapper: TestProviders }
    );

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
  });

  it("calls onSignOut when sign out button is clicked", () => {
    const signOutSpy = jest.fn();
    render(
      <TopNavbar
        sectionTitle="Test App"
        userEmail="test@example.com"
        onSignOut={signOutSpy}
      />,
      { wrapper: TestProviders }
    );

    const signOutBtn = screen.getByLabelText("Sign out");
    fireEvent.click(signOutBtn);
    expect(signOutSpy).toHaveBeenCalled();
  });
});
