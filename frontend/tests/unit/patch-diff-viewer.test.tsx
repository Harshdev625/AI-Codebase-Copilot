import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PatchDiffViewer } from "@/features/chat/components/patch-diff-viewer";
import { useApplyPatchMutation } from "@/features/chat/hooks/use-chat";
import { TestProviders } from "../test-utils";

jest.mock("@/features/chat/hooks/use-chat", () => ({
  useApplyPatchMutation: jest.fn(),
}));

jest.mock("uuid", () => ({
  v4: () => "mock-uuid"
}));

describe("PatchDiffViewer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders diff correctly", () => {
    (useApplyPatchMutation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });

    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
-old line
+new line
 unchanged line`;

    render(<PatchDiffViewer repositoryId="repo-1" diff={diff} summary="Summary text" />, { wrapper: TestProviders });

    expect(screen.getByText("Summary text")).toBeInTheDocument();
    expect(screen.getByText("--- a/file.txt")).toBeInTheDocument();
    expect(screen.getByText("+new line")).toBeInTheDocument();
    expect(screen.getByText("-old line")).toBeInTheDocument();
  });

  it("calls apply patch mutation on click", async () => {
    const mutateAsync = jest.fn().mockResolvedValue({});
    (useApplyPatchMutation as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    render(<PatchDiffViewer repositoryId="repo-1" diff="diff" />, { wrapper: TestProviders });

    const btn = screen.getByText("Apply to Codebase");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ repositoryId: "repo-1", diff: "diff" });
    });
  });
});
