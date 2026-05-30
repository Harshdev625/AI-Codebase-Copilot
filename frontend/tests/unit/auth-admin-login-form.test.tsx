import { render, screen, fireEvent } from "@testing-library/react";
import { AuthenticationAdminLoginForm } from "@/features/auth/components/auth-admin-login-form";
import { useAdminAuth } from "@/features/auth/hooks/use-admin-auth";
import { TestProviders } from "../test-utils";

jest.mock("@/features/auth/hooks/use-admin-auth", () => ({
  useAdminAuth: jest.fn(),
}));

describe("AuthenticationAdminLoginForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    (useAdminAuth as jest.Mock).mockReturnValue({ login: jest.fn(), isLoggingIn: false });
    render(<AuthenticationAdminLoginForm />, { wrapper: TestProviders });
    expect(screen.getByPlaceholderText("admin@example.com")).toBeInTheDocument();
  });

  it("calls login on submit", () => {
    const loginMock = jest.fn();
    (useAdminAuth as jest.Mock).mockReturnValue({ login: loginMock, isLoggingIn: false });
    
    render(<AuthenticationAdminLoginForm />, { wrapper: TestProviders });
    
    const emailInput = screen.getByPlaceholderText("admin@example.com");
    const passwordInput = screen.getByPlaceholderText("••••••••");
    const btn = screen.getByText("Enter admin console");

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password" } });
    fireEvent.click(btn);

    expect(loginMock).toHaveBeenCalledWith({ email: "test@example.com", password: "password" });
  });

  it("toggles password visibility", () => {
    (useAdminAuth as jest.Mock).mockReturnValue({ login: jest.fn(), isLoggingIn: false });
    
    render(<AuthenticationAdminLoginForm />, { wrapper: TestProviders });
    
    const passwordInput = screen.getByPlaceholderText("••••••••");
    expect(passwordInput).toHaveAttribute("type", "password");

    // The toggle button has no text, so get it by icon or just tag
    const buttons = screen.getAllByRole("button");
    const toggleBtn = buttons.find(b => !b.textContent || b.textContent === "")!;
    
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "text");
    
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
