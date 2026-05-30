import { fireEvent, render, screen } from "@testing-library/react";
import { TopNavbar } from "@/components/layout/top-navbar";
import { TestProviders } from "../test-utils";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("TopNavbar", () => {
  it("renders desktop navbar content", () => {
    const signOutSpy = jest.fn();
    render(
      <TopNavbar 
        sectionTitle="Test App"
        userEmail="test@example.com"
        onSignOut={signOutSpy} 
      />,
      { wrapper: TestProviders }
    );

    expect(screen.getByText("Test App")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    // Desktop main nav items
    expect(screen.getAllByText("Repositories").length).toBeGreaterThan(0);
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

    const signOutBtn = screen.getByTitle("Sign out");
    fireEvent.click(signOutBtn);
    expect(signOutSpy).toHaveBeenCalled();
  });

  it("toggles mobile menu", () => {
    render(
      <TopNavbar 
        sectionTitle="Test App"
        userEmail="test@example.com"
        onSignOut={jest.fn()} 
      />,
      { wrapper: TestProviders }
    );

    const toggleBtn = screen.getAllByRole("button")[0];
    fireEvent.click(toggleBtn);

    // Mobile nav items should be visible
    // Multiple items with same label now exist (desktop + mobile)
    const reposLinks = screen.getAllByText("Repositories");
    expect(reposLinks.length).toBeGreaterThan(1);
  });
});
