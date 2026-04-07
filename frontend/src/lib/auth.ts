export type UserRole = "USER" | "ADMIN" | string;

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  is_active: boolean;
}

const ACCESS_TOKEN_KEY = "tm.access_token";
const USER_KEY = "tm.user";
const TOKEN_COOKIE = "tm_token";
const ROLE_COOKIE = "tm_role";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

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
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  return token ?? readCookie(TOKEN_COOKIE);
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) {
    return null;
  }
  const payload = window.localStorage.getItem(USER_KEY);
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(payload) as AuthUser;
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  setCookie(TOKEN_COOKIE, token);
}

export function setStoredUser(user: AuthUser): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  setCookie(ROLE_COOKIE, String(user.role).toUpperCase());
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
  window.localStorage.removeItem(USER_KEY);
  clearCookie(TOKEN_COOKIE);
  clearCookie(ROLE_COOKIE);
}

export function isAdmin(role: string | undefined | null): boolean {
  return String(role ?? "").toUpperCase() === "ADMIN";
}
