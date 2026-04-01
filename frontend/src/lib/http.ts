export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  withAuth?: boolean;
};

function getStoredToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem("aicc_token") || "";
}

function redirectToLoginFromHttp(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem("aicc_token");
  localStorage.removeItem("aicc_user");
  localStorage.removeItem("aicc_project_id");
  window.location.href = "/login";
}

function parseJsonIfPossible(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return "success" in obj && "data" in obj && "error" in obj;
}

function extractError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    if (typeof payload === "string" && payload.trim()) {
      return payload;
    }
    return fallback;
  }
  const obj = payload as Record<string, unknown>;
  const detail = obj.detail;
  const error = obj.error;
  const message = obj.message;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (typeof error === "string" && error.trim()) return error;
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.withAuth !== false) {
    const token = getStoredToken();
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const payload = parseJsonIfPossible(text);

  if (response.status === 401 && options.withAuth !== false) {
    redirectToLoginFromHttp();
    return {
      success: false,
      data: null,
      error: "Session expired. Please login again.",
    };
  }

  if (isEnvelope(payload)) {
    return payload as ApiEnvelope<T>;
  }

  if (!response.ok) {
    return {
      success: false,
      data: null,
      error: extractError(payload, "Request failed."),
    };
  }

  return {
    success: true,
    data: payload as T,
    error: null,
  };
}

export function requireData<T>(result: ApiEnvelope<T>, fallbackMessage: string): T {
  if (!result.success || result.data === null) {
    if (!result.error || result.error === "Request failed.") {
      throw new Error(fallbackMessage);
    }
    throw new Error(result.error);
  }
  return result.data;
}
