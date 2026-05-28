export const DEFAULT_FRONTEND_API_BASE = "/api/v1";

export function getFrontendApiBase(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    DEFAULT_FRONTEND_API_BASE;
  return configured.replace(/\/$/, "");
}

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getFrontendApiBase();

  if (/^https?:\/\//i.test(base)) {
    return `${base}${normalizedPath}`;
  }

  // Use relative URLs in browser to route through Next.js proxy.
  if (typeof window !== "undefined") {
    return `${normalizedPath}`;
  }

  return `${base}${normalizedPath}`;
}
