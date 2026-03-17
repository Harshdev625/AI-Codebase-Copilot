export type CurrentUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
};

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
    return JSON.parse(raw) as CurrentUser;
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

export async function storeSession(accessToken: string): Promise<CurrentUser> {
  if (typeof window === "undefined") {
    throw new Error("Session storage is only available in the browser");
  }

  localStorage.setItem(TOKEN_KEY, accessToken);
  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    clearSession();
    throw new Error(data?.detail || "Failed to load current user");
  }

  localStorage.setItem(USER_KEY, JSON.stringify(data));
  return data as CurrentUser;
}
