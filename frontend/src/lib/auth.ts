export type CurrentUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
};

import { apiRequest, requireData } from "@/lib/http";

function normalizeRole(role: string | undefined | null): string {
  const value = (role || "").toString().trim();
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower === "admin") return "ADMIN";
  if (lower === "developer" || lower === "user" || lower === "member") return "USER";
  return value.toUpperCase();
}

const TOKEN_KEY = "aicc_token";
const USER_KEY = "aicc_user";

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getStoredUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CurrentUser;
    return { ...parsed, role: normalizeRole(parsed.role) };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("aicc_project_id");
}

export function redirectToLogin(): void {
  clearSession();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

export function handleUnauthorizedResponse(response: Response): boolean {
  if (response.status === 401) {
    redirectToLogin();
    return true;
  }
  return false;
}

export async function validateSessionAndRefreshUser(): Promise<CurrentUser | null> {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    return null;
  }

  const result = await apiRequest<CurrentUser>("/api/auth/me");
  if (!result.success || !result.data) {
    return null;
  }

  const user = result.data;
  user.role = normalizeRole(user.role);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function storeSession(accessToken: string): Promise<CurrentUser> {
  if (typeof window === "undefined") {
    throw new Error("Session storage is only available in the browser");
  }

  localStorage.setItem(TOKEN_KEY, accessToken);
  const result = await apiRequest<CurrentUser>("/api/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!result.success) {
    clearSession();
    if (!result.error || result.error === "Request failed.") {
      throw new Error("Failed to load current user");
    }
    throw new Error(result.error);
  }
  const user = requireData(result, "Failed to load current user");
  user.role = normalizeRole(user.role);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}
