const DEFAULT_BACKEND_URL = "http://localhost:8000/v1";

export const API_V1_BASE_URL = DEFAULT_BACKEND_URL;

export function getBackendUrl(): string {
  const configured =
    process.env.API_INTERNAL_URL?.trim() ||
    process.env.BACKEND_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    DEFAULT_BACKEND_URL;

  return configured.replace(/\/$/, "");
}
