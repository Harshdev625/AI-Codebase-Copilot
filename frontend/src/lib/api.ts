import { getToken } from "@/lib/auth";

export type ChatPayload = {
  repo_id: string;
  query: string;
};

export async function sendChat(payload: ChatPayload) {
  const token = getToken();
  const res = await fetch(`/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to call backend.");
  }

  return res.json();
}

export type LoginPayload = {
  email: string;
  password: string;
};

export async function login(payload: LoginPayload) {
  const res = await fetch(`/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || "Login failed");
  }
  return data;
}

export async function getAdminMetrics(token: string) {
  const res = await fetch(`/api/admin/system-metrics`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || "Failed to fetch admin metrics");
  }
  return data;
}
