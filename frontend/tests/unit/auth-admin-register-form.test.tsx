import { render, screen, fireEvent } from "@testing-library/react";
import { AuthenticationAdminRegisterForm } from "@/features/auth/components/auth-admin-register-form";
import { useAdminAuth } from "@/features/auth/hooks/use-admin-auth";
import { TestProviders } from "../test-utils";

jest.mock("@/features/auth/hooks/use-admin-auth", () => ({
  useAdminAuth: jest.fn(),
}));

describe("AuthenticationAdminRegisterForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    (useAdminAuth as jest.Mock).mockReturnValue({ register: jest.fn(), isRegistering: false });
    render(<AuthenticationAdminRegisterForm />, { wrapper: TestProviders });
    expect(screen.getByPlaceholderText("admin@example.com")).toBeInTheDocument();
  });

  it("calls register on submit", () => {
    const registerMock = jest.fn();
    (useAdminAuth as jest.Mock).mockReturnValue({ register: registerMock, isRegistering: false });
    
    render(<AuthenticationAdminRegisterForm />, { wrapper: TestProviders });
    
    fireEvent.change(screen.getByPlaceholderText("Admin Name"), { target: { value: "Admin" } });
    fireEvent.change(screen.getByPlaceholderText("admin@example.com"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"), { target: { value: "password" } });
    fireEvent.change(screen.getByPlaceholderText("Paste secret key from .env"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /create admin access/i }));

    expect(registerMock).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password",
      full_name: "Admin",
      admin_secret_key: "secret",
    });
  });

  it("disables submit while registering", () => {
    (useAdminAuth as jest.Mock).mockReturnValue({ register: jest.fn(), isRegistering: true });
    
    render(<AuthenticationAdminRegisterForm />, { wrapper: TestProviders });
    expect(screen.getByRole("button", { name: /creating access/i })).toBeDisabled();
  });
});
