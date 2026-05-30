import { renderHook, waitFor } from "@testing-library/react";
import { useRepositories, useAddRepository, useIndexRepository } from "@/features/repositories/hooks/use-repositories";
import { repositoryService } from "@/features/repositories/services/repository-service";
import { TestProviders } from "../test-utils";

jest.mock("@/features/repositories/services/repository-service", () => ({
  repositoryService: {
    listRepositories: jest.fn(),
    addRepository: jest.fn(),
    startIndex: jest.fn(),
  }
}));

describe("use-repositories hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("useRepositories returns repositories", async () => {
    const mockData = { items: [{ id: "repo-1" }], pagination: { total: 1 } };
    (repositoryService.listRepositories as jest.Mock).mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useRepositories(), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.repositories).toEqual([{ id: "repo-1" }]);
    expect(result.current.pagination).toEqual({ total: 1 });
  });

  it("useAddRepository adds repository", async () => {
    const mockRepo = { id: "repo-2" };
    (repositoryService.addRepository as jest.Mock).mockResolvedValueOnce(mockRepo);

    const { result } = renderHook(() => useAddRepository(), { wrapper: TestProviders });

    result.current.mutate({ repo_url: "url" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(repositoryService.addRepository).toHaveBeenCalledWith({ repo_url: "url" });
  });

  it("useIndexRepository starts index", async () => {
    const mockResponse = { job_id: "job-1" };
    (repositoryService.startIndex as jest.Mock).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useIndexRepository(), { wrapper: TestProviders });

    result.current.mutate({ repository_id: "repo-1" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(repositoryService.startIndex).toHaveBeenCalledWith({ repository_id: "repo-1" });
  });

});
