import { render, screen } from "@testing-library/react";
import { DashboardMomentumChart } from "@/features/dashboard/components/dashboard-momentum-chart";
import { useDashboardActivity } from "@/features/dashboard/hooks/use-dashboard";
import { TestProviders } from "../test-utils";

jest.mock("@/features/dashboard/hooks/use-dashboard", () => ({
  useDashboardActivity: jest.fn(),
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
    (useDashboardActivity as jest.Mock).mockReturnValue({
      isLoading: false,
      data: {
        days: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-06-0${i + 1}`,
          sessions: 0,
          indexing_jobs_completed: 0,
        })),
      },
    });

    render(<DashboardMomentumChart />, { wrapper: TestProviders });

    expect(screen.getByText("Weekly Activity")).toBeInTheDocument();
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getAllByText("Last 7 days").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("No activity in the last 7 days")).toBeInTheDocument();
  });
});
