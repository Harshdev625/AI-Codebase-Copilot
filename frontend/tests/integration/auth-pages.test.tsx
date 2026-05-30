import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import * as auth from "@/lib/auth";
import { ToastProvider } from "@/components/shared/toast-provider";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockPush,
  }),
}));

jest.mock("@/lib/auth", () => ({
  storeSession: jest.fn(),
  getAccessToken: jest.fn(() => "mock-token"),
  setAuthSession: jest.fn(),
  clearAuthSession: jest.fn(),
  getStoredUser: jest.fn(() => null),
}));

import { renderWithProviders } from "../test-utils";

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
  });

  it("logs in successfully and redirects", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "u1",
            email: "admin@aicc.dev",
            role: "ADMIN",
            is_active: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );

    renderWithProviders(<LoginPage />);
    const form = screen.getByRole("button", { name: /sign in/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/dashboard");
    }, { timeout: 4000 });
  });

  it("shows API error on failed login", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    renderWithProviders(<LoginPage />);
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("renders sign-in controls", () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});

describe("RegisterPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
  });

  it("registers successfully and redirects to login", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "u2" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    renderWithProviders(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText("John Doe"), { target: { value: "User Name" } });
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Repeat password"), { target: { value: "password123" } });

    fireEvent.submit(screen.getByRole("button", { name: /create workspace account/i }).closest("form")!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("shows registration failure message", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Email already exists" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    renderWithProviders(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "dup@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Repeat password"), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: /create workspace account/i }).closest("form")!);

    expect(await screen.findByText("Email already exists")).toBeInTheDocument();
  });
});
