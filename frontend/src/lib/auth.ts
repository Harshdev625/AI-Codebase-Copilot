export type UserRole = "USER" | "ADMIN" | string;

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  token_scopes?: string[];
  is_active: boolean;
}

export type CurrentUser = AuthUser;

const ACCESS_TOKEN_KEY = "tm.access_token";
const USER_KEY = "tm.user";
const LEGACY_ACCESS_TOKEN_KEY = "aicc_token";
const LEGACY_USER_KEY = "aicc_user";
const LEGACY_PROJECT_KEY = "aicc_project_id";
const TOKEN_COOKIE = "tm_token";
const ROLE_COOKIE = "tm_role";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function normalizeStoredRole(role: string | undefined | null): UserRole {
  const value = String(role ?? "").toUpperCase();
  if (value === "ADMIN") {
    return "ADMIN";
  }
  if (value === "USER" || value === "DEVELOPER" || value === "MEMBER") {
    return "USER";
  }
  return value || "USER";
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function setCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE): void {
  if (!isBrowser()) {
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

function clearCookie(name: string): void {
  if (!isBrowser()) {
    return;
  }
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

function readCookie(name: string): string | undefined {
  if (!isBrowser()) {
    return undefined;
  }
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!entry) {
    return undefined;
  }
  return decodeURIComponent(entry.substring(name.length + 1));
}

export function getAccessToken(): string | undefined {
  if (!isBrowser()) {
    return undefined;
  }
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? window.localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  return token ?? readCookie(TOKEN_COOKIE);
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) {
    return null;
  }
  const payload = window.localStorage.getItem(USER_KEY) ?? window.localStorage.getItem(LEGACY_USER_KEY);
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as AuthUser;
    return {
      ...parsed,
      role: normalizeStoredRole(parsed?.role),
    };
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  window.localStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, token);
  setCookie(TOKEN_COOKIE, token);
}

export function setStoredUser(user: AuthUser): void {
  if (!isBrowser()) {
    return;
  }
  const normalized = { ...user, role: normalizeStoredRole(user.role) };
  window.localStorage.setItem(USER_KEY, JSON.stringify(normalized));
  window.localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(normalized));
  setCookie(ROLE_COOKIE, String(normalized.role).toUpperCase());
}

export function setAuthSession(token: string, user: AuthUser): void {
  if (!isBrowser()) {
    return;
  }
  setAccessToken(token);
  setStoredUser(user);
}

export function clearAuthSession(): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(LEGACY_USER_KEY);
  window.localStorage.removeItem(LEGACY_PROJECT_KEY);
  clearCookie(TOKEN_COOKIE);
  clearCookie(ROLE_COOKIE);
}

export function isAdmin(role: string | undefined | null): boolean {
  return String(role ?? "").toUpperCase() === "ADMIN";
}

// Backward-compatible aliases used by legacy tests and older modules.
export function getToken(): string {
  return getAccessToken() ?? "";
}

export function clearSession(): void {
  clearAuthSession();
}

export async function storeSession(token: string): Promise<CurrentUser> {
  setAccessToken(token);

  let response: Response;
  try {
    response = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    throw error;
  }

  if (response.status === 401) {
    clearSession();
    throw new Error("Session expired. Please login again.");
  }

  if (!response.ok) {
    let message = "Failed to load current user";
    try {
      const payload = (await response.json()) as { detail?: string; error?: string; message?: string };
      message = payload.detail || payload.error || payload.message || message;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) {
        message = text;
      }
    }
    clearSession();
    throw new Error(message);
  }

  const payload = (await response.json()) as CurrentUser | { success?: boolean; data?: CurrentUser };
  const user = (payload as { success?: boolean; data?: CurrentUser }).success
    ? (payload as { data?: CurrentUser }).data
    : (payload as CurrentUser);

  if (!user) {
    throw new Error("Failed to load current user");
  }

  const normalizedUser = {
    ...user,
    role: normalizeStoredRole(user.role),
  };
  setStoredUser(normalizedUser);
  return normalizedUser;
}

export async function validateSessionAndRefreshUser(): Promise<CurrentUser | null> {
  const token = getToken();
  if (!token) {
    return null;
  }
  return storeSession(token);
}
