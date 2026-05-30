import { render, screen } from "@testing-library/react";
import { ChatMessageItemBubble } from "@/features/chat/components/chat-message-item-bubble";
import { TestProviders } from "../test-utils";

jest.mock("next/navigation", () => ({
  useParams: () => ({ repositoryId: "repo-1" }),
}));

jest.mock("uuid", () => ({
  v4: () => "mock-uuid"
}));

jest.mock("react-markdown", () => ({ children }: any) => <div data-testid="markdown">{children}</div>);

describe("ChatMessageItemBubble", () => {
  it("renders user message", () => {
    const message = {
      id: "1",
      role: "user" as const,
      content: "Hello AI",
      created_at: new Date().toISOString(),
    };

    render(<ChatMessageItemBubble message={message} />, { wrapper: TestProviders });

    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Hello AI")).toBeInTheDocument();
  });

  it("renders assistant message", () => {
    const message = {
      id: "2",
      role: "assistant" as const,
      content: "Hello User",
      created_at: new Date().toISOString(),
      metadata: { intent: "greeting" }
    };

    render(<ChatMessageItemBubble message={message} />, { wrapper: TestProviders });

    expect(screen.getByText("TimeMachine")).toBeInTheDocument();
    expect(screen.getByText("greeting")).toBeInTheDocument();
  });
});
