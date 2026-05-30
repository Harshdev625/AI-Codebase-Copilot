import { renderHook, waitFor } from "@testing-library/react";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { dashboardService } from "@/features/dashboard/services/dashboard-service";
import { TestProviders } from "../test-utils";

jest.mock("@/features/dashboard/services/dashboard-service", () => ({
  dashboardService: {
    getSummary: jest.fn(),
  }
}));

describe("use-dashboard hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns dashboard summary", async () => {
    const mockData = { total_users: 10, total_repositories: 5 };
    (dashboardService.getSummary as jest.Mock).mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useDashboard(), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toEqual(mockData);
    expect(dashboardService.getSummary).toHaveBeenCalled();
  });
});
