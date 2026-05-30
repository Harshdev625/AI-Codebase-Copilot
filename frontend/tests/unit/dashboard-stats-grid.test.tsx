import { render, screen } from "@testing-library/react";
import { DashboardStatsGrid } from "@/features/dashboard/components/dashboard-stats-grid";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { TestProviders } from "../test-utils";

jest.mock("@/features/dashboard/hooks/use-dashboard", () => ({
  useDashboard: jest.fn(),
}));

// Mock framer motion to immediately render without animation
jest.mock("framer-motion", () => ({
  ...jest.requireActual("framer-motion"),
  motion: {
    span: ({ children, className }: any) => <span className={className}>{children}</span>,
  },
  useSpring: () => ({
    set: jest.fn(),
  }),
  useTransform: (val: any, transformFn: any) => transformFn(100), // mock the displayed value
}));

describe("DashboardStatsGrid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state", () => {
    (useDashboard as jest.Mock).mockReturnValue({ isLoading: true });

    render(<DashboardStatsGrid />, { wrapper: TestProviders });
    
    // Skeleton should be rendered (can't easily query skeleton by role if no aria labels, 
    // but we can just check it doesn't render stats)
    expect(screen.queryByText("Intelligence Depth")).not.toBeInTheDocument();
  });

  it("renders stats with data", () => {
    const mockSummary = {
      metrics: {
        indexed_chunks_count: 100,
        repositories_count: 5,
        chat_count: 20,
      },
    };

    (useDashboard as jest.Mock).mockReturnValue({
      isLoading: false,
      summary: mockSummary,
    });

    render(<DashboardStatsGrid />, { wrapper: TestProviders });

    expect(screen.getByText("Intelligence Depth")).toBeInTheDocument();
    expect(screen.getByText("Monitored Repos")).toBeInTheDocument();
    expect(screen.getByText("AI Queries")).toBeInTheDocument();
    // We mocked useTransform to return 100
    const values = screen.getAllByText("100");
    expect(values.length).toBeGreaterThan(0);
  });
});
