import { fireEvent, render, screen } from "@testing-library/react";

import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";
import { useAuth } from "@/features/auth/hooks/use-auth";

const mockPush = jest.fn();
const mockLogin = jest.fn();
const mockRegister = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockPush,
  }),
}));

jest.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: jest.fn(),
}));

import { renderWithProviders } from "../test-utils";

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isLoggingIn: false,
    });
  });

  it("renders sign-in controls", () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("calls login on submit", () => {
    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "admin@aicc.dev" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    expect(mockLogin).toHaveBeenCalledWith({
      email: "admin@aicc.dev",
      password: "password123",
    });
  });
});

describe("RegisterPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    (useAuth as jest.Mock).mockReturnValue({
      register: mockRegister,
      isRegistering: false,
    });
  });

  it("renders registration controls", () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByText("Create Account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create studio account/i })).toBeInTheDocument();
  });

  it("calls register on submit", () => {
    renderWithProviders(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText("John Doe"), { target: { value: "User Name" } });
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"), { target: { value: "Password1!" } });
    fireEvent.change(screen.getByPlaceholderText("Repeat password"), { target: { value: "Password1!" } });

    fireEvent.submit(screen.getByRole("button", { name: /create studio account/i }).closest("form")!);

    expect(mockRegister).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "Password1!",
      full_name: "User Name",
    });
  });
});
