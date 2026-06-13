import { fireEvent, render, screen } from "@testing-library/react";
import { DashboardQuickActions } from "@/features/dashboard/components/dashboard-quick-actions";
import { TestProviders } from "../test-utils";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("@/features/repositories/hooks/use-repositories", () => ({
  useRepositories: jest.fn(() => ({
    repositories: [{ id: "repo-1", latest_job_status: "completed", indexed_chunks_count: 10 }],
  })),
}));

describe("DashboardQuickActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all quick actions", () => {
    render(<DashboardQuickActions />, { wrapper: TestProviders });

    expect(screen.getByText("Start AI Chat")).toBeInTheDocument();
    expect(screen.getByText("Add Repository")).toBeInTheDocument();
    expect(screen.getByText("Semantic Search")).toBeInTheDocument();
    expect(screen.getByText("Open Codebase")).toBeInTheDocument();
  });

  it("navigates to studio when Start AI Chat is clicked", () => {
    render(<DashboardQuickActions />, { wrapper: TestProviders });

    const chatBtn = screen.getByText("Start AI Chat").closest("button");
    fireEvent.click(chatBtn!);

    expect(mockPush).toHaveBeenCalledWith("/studio");
  });

  it("calls onAddRepository when Add Repository is clicked", () => {
    const onAddRepository = jest.fn();
    render(<DashboardQuickActions onAddRepository={onAddRepository} />, { wrapper: TestProviders });

    const reposBtn = screen.getByText("Add Repository").closest("button");
    fireEvent.click(reposBtn!);

    expect(onAddRepository).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigates to studio search panel when Semantic Search is clicked", () => {
    render(<DashboardQuickActions />, { wrapper: TestProviders });

    const searchBtn = screen.getByText("Semantic Search").closest("button");
    fireEvent.click(searchBtn!);

    expect(mockPush).toHaveBeenCalledWith("/studio?panel=search");
  });
});
