import { fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/layout/sidebar";
import { LayoutDashboard } from "lucide-react";
import { TestProviders } from "../test-utils";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe("Sidebar", () => {
  const items = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  ];

  it("renders desktop sidebar content", () => {
    render(
      <Sidebar 
        title="Test App" 
        items={items} 
        isOpen={false} 
        collapsed={false} 
        onToggleCollapsed={jest.fn()} 
        onClose={jest.fn()} 
      />,
      { wrapper: TestProviders }
    );

    expect(screen.getByText("Test App")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders collapsed mode without title text", () => {
    render(
      <Sidebar 
        title="Test App" 
        items={items} 
        isOpen={false} 
        collapsed={true} 
        onToggleCollapsed={jest.fn()} 
        onClose={jest.fn()} 
      />,
      { wrapper: TestProviders }
    );

    // Title should be hidden in collapsed mode
    expect(screen.queryByText("Test App")).not.toBeInTheDocument();
  });

  it("calls onToggleCollapsed when button is clicked", () => {
    const toggleSpy = jest.fn();
    render(
      <Sidebar 
        title="Test App" 
        items={items} 
        isOpen={false} 
        collapsed={false} 
        onToggleCollapsed={toggleSpy} 
        onClose={jest.fn()} 
      />,
      { wrapper: TestProviders }
    );

    // Click the toggle button (ChevronLeft icon)
    const toggleBtn = screen.getAllByRole("button")[0];
    fireEvent.click(toggleBtn);
    expect(toggleSpy).toHaveBeenCalled();
  });

  it("renders mobile drawer when isOpen is true", () => {
    render(
      <Sidebar 
        title="Mobile App" 
        items={items} 
        isOpen={true} 
        collapsed={false} 
        onToggleCollapsed={jest.fn()} 
        onClose={jest.fn()} 
      />,
      { wrapper: TestProviders }
    );

    // Since Framer motion is mocked to render immediately
    expect(screen.getAllByText("Mobile App").length).toBeGreaterThan(0);
  });
});
