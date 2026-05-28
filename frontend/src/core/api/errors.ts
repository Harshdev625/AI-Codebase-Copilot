import { ApiError } from "./types";

export function toApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === "string") {
    return error;
  }
  
  if (error && typeof error === "object") {
    const shaped = error as { message?: string; error?: string | { message?: string } };
    if (typeof shaped.message === "string" && shaped.message) {
      return shaped.message;
    }
    if (typeof shaped.error === "string" && shaped.error) {
      return shaped.error;
    }
    if (shaped.error && typeof shaped.error === "object" && typeof shaped.error.message === "string") {
      return shaped.error.message;
    }
  }
  
  return "An unexpected error occurred.";
}
