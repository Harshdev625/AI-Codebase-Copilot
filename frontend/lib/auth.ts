export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("aicc_token") || "";
}
