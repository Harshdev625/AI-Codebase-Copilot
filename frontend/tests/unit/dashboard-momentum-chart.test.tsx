import { render, screen } from "@testing-library/react";
import { DashboardMomentumChart } from "@/features/dashboard/components/dashboard-momentum-chart";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { TestProviders } from "../test-utils";

jest.mock("@/features/dashboard/hooks/use-dashboard", () => ({
  useDashboard: jest.fn(),
}));

jest.mock("framer-motion", () => ({
  ...jest.requireActual("framer-motion"),
  motion: {
    div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  },
}));

describe("DashboardMomentumChart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders chart with zero state", () => {
    (useDashboard as jest.Mock).mockReturnValue({
      summary: {},
    });

    render(<DashboardMomentumChart />, { wrapper: TestProviders });

    expect(screen.getByText("Weekly Activity")).toBeInTheDocument();
    expect(screen.getByText("Total Queries (7d)")).toBeInTheDocument();
    
    // Total should be 0 based on dummy component logic which currently hardcodes 0
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });
});
