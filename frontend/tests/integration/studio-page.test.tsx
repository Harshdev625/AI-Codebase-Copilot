import { screen } from "@testing-library/react";

import { StudioPageClient } from "@/app/(user)/studio/studio-page-client";
import { useRepositories } from "@/features/repositories/hooks/use-repositories";
import { useStudioUrlSync } from "@/features/studio/hooks/use-studio-url-sync";
import { useStudioStore } from "@/features/studio/store/studio-store";

import { renderWithProviders } from "../test-utils";

const mockFocusSidebar = jest.fn();
const mockSetSidebarCollapsed = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("panel=explorer&repository_id=repo-1"),
}));

jest.mock("@/features/studio/hooks/use-studio-url-sync", () => ({
  useStudioUrlSync: jest.fn(),
}));

jest.mock("@/features/repositories/hooks/use-repositories", () => ({
  useRepositories: jest.fn(),
}));

jest.mock("@/features/studio/store/studio-store", () => ({
  useStudioStore: jest.fn(),
}));

jest.mock("@/features/studio/components/studio-v2-shell", () => ({
  StudioV2Shell: ({
    repositoryId,
    isRepositoriesLoading,
  }: {
    repositoryId?: string;
    isRepositoriesLoading?: boolean;
  }) => (
    <div
      data-testid="mock-studio-shell"
      data-repository-id={repositoryId ?? ""}
      data-loading={String(Boolean(isRepositoriesLoading))}
    />
  ),
}));

describe("StudioPageClient integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useStudioUrlSync as jest.Mock).mockReturnValue(undefined);
    (useStudioStore as jest.Mock).mockReturnValue({
      selectedRepositoryId: "repo-1",
      focusSidebar: mockFocusSidebar,
      setSidebarCollapsed: mockSetSidebarCollapsed,
    });
    (useRepositories as jest.Mock).mockReturnValue({
      repositories: [{ id: "repo-1", repo_id: "org/repo", default_branch: "main" }],
      isLoading: false,
    });
  });

  it("renders studio workbench shell with selected repository", () => {
    renderWithProviders(<StudioPageClient />);

    expect(screen.getByTestId("mock-studio-shell")).toHaveAttribute(
      "data-repository-id",
      "repo-1",
    );
    expect(screen.getByTestId("mock-studio-shell")).toHaveAttribute("data-loading", "false");
    expect(document.querySelector(".studio-workbench")).toBeTruthy();
  });

  it("focuses explorer panel from URL search params", () => {
    renderWithProviders(<StudioPageClient />);

    expect(mockSetSidebarCollapsed).toHaveBeenCalledWith(false);
    expect(mockFocusSidebar).toHaveBeenCalledWith("explorer");
  });
});
