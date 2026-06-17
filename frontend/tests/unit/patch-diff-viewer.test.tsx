import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PatchDiffViewer } from "@/features/chat/components/patch-diff-viewer";
import { 
  useCreatePatchMutation,
  useValidatePatchMutation,
  useApplyPatchMutation,
  useCancelPatchMutation
} from "@/features/chat/hooks/use-chat";
import { useIndexRepository } from "@/features/repositories/hooks/use-repositories";
import { TestProviders } from "../test-utils";

jest.mock("@/features/chat/hooks/use-chat", () => ({
  useCreatePatchMutation: jest.fn(),
  useValidatePatchMutation: jest.fn(),
  useApplyPatchMutation: jest.fn(),
  useCancelPatchMutation: jest.fn(),
}));

jest.mock("@/features/repositories/hooks/use-repositories", () => ({
  useIndexRepository: jest.fn(),
}));

jest.mock("@/features/repositories/services/repository-service", () => ({
  repositoryService: {
    getFileContent: jest.fn().mockResolvedValue({ content: "old line\nunchanged line" }),
  },
}));

jest.mock("next/dynamic", () => () => {
  const MockDiff = ({ originalContent, modifiedContent }: { originalContent: string; modifiedContent: string }) => (
    <div data-testid="monaco-diff">{originalContent}|{modifiedContent}</div>
  );
  return MockDiff;
});

jest.mock("uuid", () => ({
  v4: () => "mock-uuid"
}));

describe("PatchDiffViewer", () => {
  const createMock = jest.fn();
  const validateMock = jest.fn();
  const applyMock = jest.fn();
  const cancelMock = jest.fn();
  const indexMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    createMock.mockResolvedValue({ patch_id: "mock-patch-123", status: "DRAFT" });
    validateMock.mockResolvedValue({ patch_id: "mock-patch-123", status: "APPROVED", validation_logs: "Done" });
    applyMock.mockResolvedValue({ patch_id: "mock-patch-123", status: "APPLIED" });
    cancelMock.mockResolvedValue({ deleted: true });
    indexMock.mockResolvedValue({});

    (useCreatePatchMutation as jest.Mock).mockReturnValue({ mutateAsync: createMock, isPending: false });
    (useValidatePatchMutation as jest.Mock).mockReturnValue({ mutateAsync: validateMock, isPending: false });
    (useApplyPatchMutation as jest.Mock).mockReturnValue({ mutateAsync: applyMock, isPending: false });
    (useCancelPatchMutation as jest.Mock).mockReturnValue({ mutateAsync: cancelMock, isPending: false });
    (useIndexRepository as jest.Mock).mockReturnValue({ mutateAsync: indexMock, isPending: false });
  });

  it("renders diff correctly", () => {
    const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
-old line
+new line
 unchanged line`;

    render(<PatchDiffViewer repositoryId="repo-1" diff={diff} summary="Summary text" />, { wrapper: TestProviders });

    expect(screen.getByText("Summary text")).toBeInTheDocument();
    expect(screen.getByText("Apply to Codebase")).toBeInTheDocument();
    expect(screen.getByText("Validate Patch")).toBeInTheDocument();
  });

  it("calls apply patch mutation on click", async () => {
    render(<PatchDiffViewer repositoryId="repo-1" diff="diff" />, { wrapper: TestProviders });

    const btn = screen.getByText("Apply to Codebase");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled();
      expect(applyMock).toHaveBeenCalledWith({ repositoryId: "repo-1", patchId: "mock-patch-123" });
    });
  });
});
