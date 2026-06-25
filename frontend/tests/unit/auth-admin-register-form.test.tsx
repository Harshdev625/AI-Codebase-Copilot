import { render, screen, fireEvent } from "@testing-library/react";
import { AuthForm } from "@/features/auth/components/auth-form";
import { useAdminAuth } from "@/features/auth/hooks/use-admin-auth";
import { TestProviders } from "../test-utils";

jest.mock("@/features/auth/hooks/use-admin-auth", () => ({
  useAdminAuth: jest.fn(),
}));

describe("AuthForm admin-register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    (useAdminAuth as jest.Mock).mockReturnValue({ register: jest.fn(), isRegistering: false });
    render(<AuthForm mode="admin-register" />, { wrapper: TestProviders });
    expect(screen.getByPlaceholderText("admin@example.com")).toBeInTheDocument();
  });

  it("calls register on submit", () => {
    const registerMock = jest.fn();
    (useAdminAuth as jest.Mock).mockReturnValue({ register: registerMock, isRegistering: false });

    render(<AuthForm mode="admin-register" />, { wrapper: TestProviders });

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Admin" } });
    fireEvent.change(screen.getByPlaceholderText("admin@example.com"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"), { target: { value: "password" } });
    fireEvent.change(screen.getByPlaceholderText("Enter your admin secret key"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /create admin account/i }));

    expect(registerMock).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password",
      full_name: "Admin",
      admin_secret_key: "secret",
    });
  });

  it("disables submit while registering", () => {
    (useAdminAuth as jest.Mock).mockReturnValue({ register: jest.fn(), isRegistering: true });

    render(<AuthForm mode="admin-register" />, { wrapper: TestProviders });
    expect(screen.getByRole("button", { name: /creating admin/i })).toBeDisabled();
  });
});
