import type { ChatMessage, Source } from "@/features/chat/types/chat-types";

const FEDERATED_PREFIX = "Below is the retrieved cross-repository context";
export const USER_QUERY_MARKER = "\nUser Query: ";

const WINDOWS_PATH_RE = /[A-Za-z]:\\[\w\s./\\-]+/g;
const SOURCE_BLOCK_RE = /Source\s*\[S\d+\][^\n]*\n?/gi;

/** Normalize paths for display (repo-relative, no Windows absolutes). */
export function normalizeRepoPath(path: string): string {
  if (!path) return path;
  const normalized = path.replace(WINDOWS_PATH_RE, "").trim();
  if (normalized.includes("/")) {
    const parts = normalized.split(/[/\\]/);
    return parts[parts.length - 1] || normalized;
  }
  return normalized || path;
}

/** Show only the user's question when federated context was prepended for the API. */
export function getDisplayContent(
  content: string,
  role: string,
  metadata?: Record<string, unknown>,
): string {
  if (!content) return content;

  let text = content.replace(WINDOWS_PATH_RE, (m) => {
    const parts = m.split(/[/\\]/);
    return parts[parts.length - 1] || m;
  });

  if (role === "user") {
    if (text.startsWith(FEDERATED_PREFIX) && text.includes(USER_QUERY_MARKER)) {
      return text.split(USER_QUERY_MARKER).pop()?.trim() || text;
    }
    return text;
  }

  if (role === "assistant" && metadata && normalizeSourcesFromMetadata(metadata).length > 0) {
    text = text.replace(SOURCE_BLOCK_RE, "").trim();
  }

  return text;
}

/** Map persisted `source_index` (backend) to UI `sources`. */
export function normalizeSourcesFromMetadata(metadata: Record<string, unknown>): Source[] {
  if (Array.isArray(metadata.sources) && metadata.sources.length > 0) {
    return metadata.sources as Source[];
  }
  if (Array.isArray(metadata.source_index) && metadata.source_index.length > 0) {
    return metadata.source_index as Source[];
  }
  return [];
}

export function normalizeMessageMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  const sources = normalizeSourcesFromMetadata(metadata);
  const next: Record<string, unknown> = { ...metadata, sources };

  const patchProposal = metadata.patch_proposal;
  if (patchProposal && !sources.some((s) => s.kind === "patch_proposal")) {
    next.sources = [
      ...sources,
      { kind: "patch_proposal", proposal: patchProposal } as Source,
    ];
  }

  return next;
}

export function normalizeChatMessage(message: ChatMessage): ChatMessage {
  const metadata = normalizeMessageMetadata(message.metadata ?? {});
  return {
    ...message,
    content: getDisplayContent(message.content, message.role, metadata),
    metadata,
  };
}
