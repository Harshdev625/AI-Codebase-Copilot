import { fireEvent, screen } from "@testing-library/react";

import { LazyTreeNode } from "@/features/explorer/components/lazy-tree-node";
import { useRepositoryTree } from "@/features/repositories/hooks/use-repositories";
import { useStudioStore } from "@/features/studio/store/studio-store";

import { renderWithProviders } from "../test-utils";

jest.mock("@/features/repositories/hooks/use-repositories", () => ({
  useRepositoryTree: jest.fn(),
}));

jest.mock("@/features/studio/store/studio-store", () => ({
  useStudioStore: jest.fn(),
}));

jest.mock("@/features/repositories/services/repository-service", () => ({
  repositoryService: {
    getTree: jest.fn(),
  },
}));

describe("LazyTreeNode", () => {
  const onFileSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useStudioStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: { activeFilePath: string | null }) => unknown) =>
        selector({ activeFilePath: null }),
    );
    (useRepositoryTree as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
    });
  });

  it("calls onFileSelect when a file node is clicked", () => {
    renderWithProviders(
      <LazyTreeNode
        repoId="repo-1"
        name="main.py"
        path="src/main.py"
        type="FILE"
        onFileSelect={onFileSelect}
      />,
    );

    fireEvent.click(screen.getByTestId("tree-file-node-src/main.py"));
    expect(onFileSelect).toHaveBeenCalledWith("src/main.py");
  });

  it("renders modified status badge for overlay files", () => {
    renderWithProviders(
      <LazyTreeNode
        repoId="repo-1"
        name="main.py"
        path="src/main.py"
        type="FILE"
        status="MODIFIED"
        onFileSelect={onFileSelect}
      />,
    );

    expect(screen.getByTestId("tree-node-status-src/main.py")).toHaveTextContent("M");
  });

  it("lazy-loads children when a directory is expanded", () => {
    (useRepositoryTree as jest.Mock).mockReturnValue({
      data: {
        items: [{ id: "f1", path: "src/app.py", type: "FILE", status: "INDEXED" }],
        next_cursor: undefined,
      },
      isLoading: false,
    });

    renderWithProviders(
      <LazyTreeNode
        repoId="repo-1"
        name="src"
        path="src"
        type="DIRECTORY"
        onFileSelect={onFileSelect}
      />,
    );

    fireEvent.click(screen.getByTestId("tree-folder-toggle-src"));
    expect(useRepositoryTree).toHaveBeenCalledWith("repo-1", "src", undefined, undefined);
    expect(screen.getByTestId("tree-file-node-src/app.py")).toBeInTheDocument();
  });
});
