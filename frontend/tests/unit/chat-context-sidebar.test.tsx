import { render, screen, fireEvent, act } from "@testing-library/react";
import { ChatContextSidebar } from "@/features/chat/components/chat-context-sidebar";
import { Repository } from "@/features/repositories/types/repository-types";
import { TestProviders } from "../test-utils";

describe("ChatContextSidebar", () => {
  const mockRepos: Repository[] = [
    {
      id: "repo-1",
      repo_id: "test/repo-1",
      organization: "test",
      name: "repo-1",
      default_branch: "main",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      latest_index_status: "completed",
    },
    {
      id: "repo-2",
      repo_id: "test/repo-2",
      organization: "test",
      name: "repo-2",
      default_branch: "develop",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      latest_index_status: "failed",
    },
  ];

  it("renders with a selected repository", () => {
    const onSelect = jest.fn();
    render(
      <ChatContextSidebar
        repositories={mockRepos}
        selectedId="repo-1"
        onSelect={onSelect}
        isLoading={false}
      />,
      { wrapper: TestProviders }
    );

    expect(screen.getByText("test/repo-1")).toBeInTheDocument();
    expect(screen.getByText("READY")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("renders when no repository is selected", () => {
    const onSelect = jest.fn();
    render(
      <ChatContextSidebar
        repositories={mockRepos}
        selectedId=""
        onSelect={onSelect}
        isLoading={false}
      />,
      { wrapper: TestProviders }
    );

    expect(screen.getByText("Select a repository…")).toBeInTheDocument();
    expect(screen.getByText("Select a repository to start chatting")).toBeInTheDocument();
  });

  it("opens dropdown and selects a repository", async () => {
    const onSelect = jest.fn();
    render(
      <ChatContextSidebar
        repositories={mockRepos}
        selectedId=""
        onSelect={onSelect}
        isLoading={false}
      />,
      { wrapper: TestProviders }
    );

    const dropdownBtn = screen.getByRole("button", { name: /Select a repository…/i });
    fireEvent.click(dropdownBtn);

    // The dropdown options should be visible now
    const optionBtn = screen.getByRole("button", { name: /test\/repo-1/i });
    fireEvent.click(optionBtn);

    expect(onSelect).toHaveBeenCalledWith("repo-1");
  });
});
