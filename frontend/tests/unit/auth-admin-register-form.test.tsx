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
    
    const nameInput = screen.getByPlaceholderText("Admin Name");
    const emailInput = screen.getByPlaceholderText("admin@example.com");
    const passwordInput = screen.getByPlaceholderText("Min. 8 characters");
    const secretInput = screen.getByPlaceholderText("Paste secret key");
    const btn = screen.getByText("Create admin access");

    fireEvent.change(nameInput, { target: { value: "Admin" } });
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password" } });
    fireEvent.change(secretInput, { target: { value: "secret" } });
    fireEvent.click(btn);

    expect(registerMock).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password",
      full_name: "Admin",
      admin_secret_key: "secret",
    });
  });

  it("toggles password and secret visibility", () => {
    (useAdminAuth as jest.Mock).mockReturnValue({ register: jest.fn(), isRegistering: false });
    
    render(<AuthenticationAdminRegisterForm />, { wrapper: TestProviders });
    
    const passwordInput = screen.getByPlaceholderText("Min. 8 characters");
    const secretInput = screen.getByPlaceholderText("Paste secret key");
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(secretInput).toHaveAttribute("type", "password");

    const buttons = screen.getAllByRole("button");
    const toggleBtns = buttons.filter(b => !b.textContent || b.textContent === "");
    const togglePwd = toggleBtns[0];
    const toggleSecret = toggleBtns[1];
    
    fireEvent.click(togglePwd);
    expect(passwordInput).toHaveAttribute("type", "text");
    
    fireEvent.click(toggleSecret);
    expect(secretInput).toHaveAttribute("type", "text");
  });
});
