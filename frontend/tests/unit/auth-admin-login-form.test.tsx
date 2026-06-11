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
    expect(screen.getByText("Secure control room")).toBeInTheDocument();
  });

  it("calls login on submit", () => {
    const loginMock = jest.fn();
    (useAdminAuth as jest.Mock).mockReturnValue({ login: loginMock, isLoggingIn: false });
    
    render(<AuthenticationAdminLoginForm />, { wrapper: TestProviders });
    
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /enter admin console/i }));

    expect(loginMock).toHaveBeenCalledWith({ email: "test@example.com", password: "password" });
  });

  it("disables submit while logging in", () => {
    (useAdminAuth as jest.Mock).mockReturnValue({ login: jest.fn(), isLoggingIn: true });
    
    render(<AuthenticationAdminLoginForm />, { wrapper: TestProviders });
    expect(screen.getByRole("button", { name: /authenticating/i })).toBeDisabled();
  });
});
