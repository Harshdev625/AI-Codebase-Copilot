import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ChatShell } from "@/components/chat-shell";
import { sendChat } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  sendChat: jest.fn()
}));

const mockedSendChat = sendChat as jest.MockedFunction<typeof sendChat>;

describe("ChatShell", () => {
  beforeEach(() => {
    mockedSendChat.mockReset();
  });

  it("renders default form state", () => {
    render(<ChatShell />);

    expect(screen.getByText("AI Codebase Copilot")).toBeInTheDocument();
    expect(screen.getByDisplayValue("demo-repo")).toBeInTheDocument();
    expect(screen.getByText("Ask Copilot")).toBeInTheDocument();
  });

  it("submits request and renders answer with sources", async () => {
    mockedSendChat.mockResolvedValue({
      answer: "Auth is in app/auth/service.py",
      intent: "search",
      sources: [{ path: "app/auth/service.py", symbol: "AuthService" }]
    } as never);

    render(<ChatShell />);

    const repoInput = screen.getByDisplayValue("demo-repo");
    const queryInput = screen.getByDisplayValue("Where is authentication implemented?");

    fireEvent.change(repoInput, { target: { value: "my-repo" } });
    fireEvent.change(queryInput, { target: { value: "Where is auth?" } });
    fireEvent.click(screen.getByText("Ask Copilot"));

    await waitFor(() => {
      expect(mockedSendChat).toHaveBeenCalledWith({ repo_id: "my-repo", query: "Where is auth?" });
    });

    expect(await screen.findByText("Auth is in app/auth/service.py")).toBeInTheDocument();
    expect(screen.getByText(/Intent:/)).toBeInTheDocument();
    expect(screen.getAllByText(/app\/auth\/service.py/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows error message when API call fails", async () => {
    mockedSendChat.mockRejectedValue(new Error("Service unavailable"));

    render(<ChatShell />);

    fireEvent.click(screen.getByText("Ask Copilot"));

    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
  });
});
