/** Human-readable labels for repository_files.skip_reason codes. */
export const SKIP_REASON_LABELS: Record<string, string> = {
  IGNORED_PATTERN: "Ignored by pattern (.gitignore)",
  EMPTY_FILE: "Empty file",
  SECRET_FILE: "Secret / credential file",
  FILE_TOO_LARGE: "File too large",
  IMAGE_FILE: "Image file",
  BINARY_FILE: "Binary or archive",
  UNSUPPORTED_EXTENSION: "Unsupported extension",
  MINIFIED_FILE: "Minified bundle",
  GENERATED_FILE: "Generated file",
  UNREADABLE_FILE: "Could not read file",
  UNKNOWN: "Unknown reason",
};

export function formatSkipReason(code: string | null | undefined): string {
  if (!code) return SKIP_REASON_LABELS.UNKNOWN;
  return SKIP_REASON_LABELS[code] ?? code.replace(/_/g, " ").toLowerCase();
}
