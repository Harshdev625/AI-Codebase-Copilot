import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import * as auth from "@/lib/auth";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("@/lib/auth", () => ({
  storeSession: jest.fn(),
}));

const mockedStoreSession = auth.storeSession as jest.MockedFunction<typeof auth.storeSession>;

describe("LoginPage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockedStoreSession.mockReset();
    mockPush.mockReset();
  });

  it("logs in successfully and redirects", async () => {
    mockedStoreSession.mockResolvedValue({
      id: "u1",
      email: "admin@aicc.dev",
      role: "ADMIN",
      is_active: true,
    });

    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "token-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<LoginPage />);
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(auth.storeSession).toHaveBeenCalledWith("token-123");
    });
  });

  it("shows API error on failed login", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<LoginPage />);
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("renders sign-in controls", () => {
    render(<LoginPage />);

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});

describe("RegisterPage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockedStoreSession.mockReset();
    mockPush.mockReset();
  });

  it("registers, logs in, stores session and redirects", async () => {
    mockedStoreSession.mockResolvedValue({
      id: "u2",
      email: "user@example.com",
      role: "USER",
      is_active: true,
    });

    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "u2" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token-xyz" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "User Name" } });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), { target: { value: "password123" } });

    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() => {
      expect(auth.storeSession).toHaveBeenCalledWith("token-xyz");
    });
  });

  it("shows registration failure message", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Email already exists" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "dup@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    expect(await screen.findByText("Email already exists")).toBeInTheDocument();
  });

  it("shows login failure after successful registration", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "u2" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Login failed" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      );

    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    expect(await screen.findByText("Login failed")).toBeInTheDocument();
  });
});
