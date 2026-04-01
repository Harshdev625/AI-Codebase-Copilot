import { render, screen, waitFor } from "@testing-library/react";

import AppShell from "@/components/app-shell";
import HomePage from "@/app/page";
import ChatPage from "@/app/chat/page";

const mockReplace = jest.fn();
let mockPathname = "/dashboard";
let mockToken = "";
let mockUser: { role?: string } | null = null;

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/components/sidebar", () => ({
  __esModule: true,
  default: () => <aside data-testid="sidebar">Sidebar</aside>,
}));

jest.mock("@/components/chat-shell", () => ({
  ChatShell: () => <div data-testid="chat-shell">ChatShell</div>,
}));

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => mockToken),
  getStoredUser: jest.fn(() => mockUser),
  validateSessionAndRefreshUser: jest.fn(async () => mockUser),
}));

describe("AppShell", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPathname = "/dashboard";
    mockToken = "";
    mockUser = null;
    window.localStorage.clear();
  });

  it("renders public pages without auth", () => {
    mockPathname = "/login";

    render(
      <AppShell>
        <div>Public Content</div>
      </AppShell>
    );

    expect(screen.getByText("Public Content")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", async () => {
    mockPathname = "/dashboard";
    mockToken = "";
    mockUser = null;

    const { container } = render(
      <AppShell>
        <div>Private Content</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("redirects non-admin users from admin pages", async () => {
    mockPathname = "/admin/dashboard";
    mockToken = "token";
    mockUser = { role: "USER" };

    render(
      <AppShell>
        <div>Admin Content</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("renders protected layout for authorized users", async () => {
    mockPathname = "/repositories";
    mockToken = "token";
    mockUser = { role: "USER" };

    render(
      <AppShell>
        <div>Page Body</div>
      </AppShell>
    );

    expect(await screen.findByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByText("Repositories")).toBeInTheDocument();
    expect(screen.getByText("Page Body")).toBeInTheDocument();
  });
});

describe("Root and chat pages", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    window.localStorage.clear();
  });

  it("redirects root to login when no token", async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("redirects root to dashboard when token exists", async () => {
    window.localStorage.setItem("aicc_token", "abc");
    render(<HomePage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("renders chat page shell", () => {
    render(<ChatPage />);

    expect(screen.getByTestId("chat-shell")).toBeInTheDocument();
  });
});
