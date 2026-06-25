import { renderHook, waitFor } from "@testing-library/react";
import { useAdminAuth } from "@/features/auth/hooks/use-admin-auth";
import { authService } from "@/features/auth/services/auth-service";
import { useAuthStore } from "@/store/auth-store";
import { TestProviders } from "../test-utils";

jest.mock("@/features/auth/services/auth-service", () => ({
  authService: {
    adminLogin: jest.fn(),
    adminRegister: jest.fn(),
    me: jest.fn(),
  }
}));

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  })
}));

describe("use-admin-auth hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, hydrated: true });
    mockReplace.mockClear();
  });

  it("handles admin login mutation and redirects to admin dashboard", async () => {
    const mockTokenPayload = { access_token: "admin-token-123", token_type: "bearer" };
    const mockUser = { id: "admin-1", email: "admin@example.com", role: "ADMIN", is_active: true };

    (authService.adminLogin as jest.Mock).mockResolvedValueOnce(mockTokenPayload);
    (authService.me as jest.Mock).mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useAdminAuth(), { wrapper: TestProviders });

    result.current.login({ email: "admin@example.com", password: "pwd" });

    await waitFor(() => {
      expect(result.current.isLoggingIn).toBe(false);
    });

    expect(authService.adminLogin).toHaveBeenCalledWith({ email: "admin@example.com", password: "pwd" });
    expect(authService.me).toHaveBeenCalledWith("admin-token-123");
    
    // Check state update
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe("admin-token-123");
    expect(state.isAuthenticated).toBe(true);
    
    expect(mockReplace).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("handles admin register mutation and redirects to admin login", async () => {
    const mockUser = { id: "admin-2", email: "newadmin@example.com", role: "ADMIN", is_active: true };
    (authService.adminRegister as jest.Mock).mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useAdminAuth(), { wrapper: TestProviders });

    result.current.register({
      email: "newadmin@example.com",
      password: "pwd",
      full_name: "Admin",
      admin_secret_key: "secret",
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin/login?registered=1");
    });

    expect(authService.adminRegister).toHaveBeenCalledWith({
      email: "newadmin@example.com",
      password: "pwd",
      full_name: "Admin",
      admin_secret_key: "secret",
    });
  });
});
