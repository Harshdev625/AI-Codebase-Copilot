import { renderHook, waitFor } from "@testing-library/react";
import { useAuth, useMeQuery, useLogout, useLoginMutation } from "@/features/auth/hooks/use-auth";
import { authService } from "@/features/auth/services/auth-service";
import { useAuthStore } from "@/store/auth-store";
import {
  consumePendingOnboardingEmail,
  markPendingOnboardingEmail,
} from "@/store/onboarding-store";
import { TestProviders } from "../test-utils";

jest.mock("@/features/auth/services/auth-service", () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    me: jest.fn(),
  }
}));

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

describe("use-auth hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, hydrated: true });
    mockReplace.mockClear();
  });

  it("handles login mutation and redirects to dashboard (USER role)", async () => {
    const mockTokenPayload = { access_token: "token-123", token_type: "bearer" };
    const mockUser = { id: "1", email: "user@example.com", role: "USER", is_active: true };

    (authService.login as jest.Mock).mockResolvedValueOnce(mockTokenPayload);
    (authService.me as jest.Mock).mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper: TestProviders });

    result.current.login({ email: "user@example.com", password: "pwd" });

    await waitFor(() => {
      expect(result.current.isLoggingIn).toBe(false);
    });

    expect(authService.login).toHaveBeenCalledWith({ email: "user@example.com", password: "pwd" });
    expect(authService.me).toHaveBeenCalledWith("token-123");
    
    // Check state update
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe("token-123");
    expect(state.isAuthenticated).toBe(true);
    
    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("handles login mutation and redirects to admin dashboard (ADMIN role)", async () => {
    const mockTokenPayload = { access_token: "token-admin", token_type: "bearer" };
    const mockUser = { id: "2", email: "admin@example.com", role: "ADMIN", is_active: true };

    (authService.login as jest.Mock).mockResolvedValueOnce(mockTokenPayload);
    (authService.me as jest.Mock).mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper: TestProviders });

    result.current.login({ email: "admin@example.com", password: "pwd" });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/admin/dashboard");
    });
  });

  it("handles register mutation and redirects to login", async () => {
    const mockUser = { id: "3", email: "new@example.com", role: "USER", is_active: true };
    (authService.register as jest.Mock).mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper: TestProviders });

    result.current.register({ email: "new@example.com", password: "pwd", full_name: "New" });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login?registered=1");
    });
    
    expect(authService.register).toHaveBeenCalledWith({ email: "new@example.com", password: "pwd", full_name: "New" });
    expect(localStorage.getItem('tm.walkthrough.pendingUserEmail')).toBe('new@example.com');
  });

  it("marks brand-new user on first login after registration", async () => {
    markPendingOnboardingEmail("fresh@example.com");
    const mockTokenPayload = { access_token: "token-fresh", token_type: "bearer" };
    const mockUser = { id: "fresh-user", email: "fresh@example.com", role: "USER", is_active: true };

    (authService.login as jest.Mock).mockResolvedValueOnce(mockTokenPayload);
    (authService.me as jest.Mock).mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useLoginMutation(), { wrapper: TestProviders });
    result.current.mutate({ email: "fresh@example.com", password: "pwd" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(consumePendingOnboardingEmail("fresh@example.com")).toBe(false);

    const brandNewKey = 'tm.walkthrough.brandNewByUser';
    const brandNewMap = JSON.parse(localStorage.getItem(brandNewKey) || '{}');
    expect(brandNewMap['fresh-user']).toBe(true);
  });

  it("provides me query when authenticated", async () => {
    useAuthStore.setState({ token: "existing-token", hydrated: true });
    
    const mockUser = { id: "1", email: "user@example.com", role: "USER", is_active: true };
    (authService.me as jest.Mock).mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useMeQuery(), { wrapper: TestProviders });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockUser);
  });

  it("handles user logout and redirects to login", () => {
    useAuthStore.setState({
      user: { id: "1", role: "USER" } as any,
      token: "token",
      isAuthenticated: true,
      hydrated: true,
    });

    const { result } = renderHook(() => useLogout(), { wrapper: TestProviders });
    result.current("user");

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("handles admin logout and redirects to admin login", () => {
    useAuthStore.setState({
      user: { id: "2", role: "ADMIN" } as any,
      token: "token",
      isAuthenticated: true,
      hydrated: true,
    });

    const { result } = renderHook(() => useLogout(), { wrapper: TestProviders });
    result.current("admin");

    expect(mockReplace).toHaveBeenCalledWith("/admin/login");
  });
});
