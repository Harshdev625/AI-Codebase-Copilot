import type { ChatMessage, Source } from "@/features/chat/types/chat-types";

const FEDERATED_PREFIX = "Below is the retrieved cross-repository context";
export const USER_QUERY_MARKER = "\nUser Query: ";
export const CHAT_QUERY_MAX_LENGTH = 4000;
export const FEDERATED_CONTEXT_PREFIX = `${FEDERATED_PREFIX} for this query:\n\n`;

/** Combine federated retrieval context + user query within API max length. */
export function buildFederatedChatQuery(
  formattedContext: string,
  userQuery: string,
  maxLength: number = CHAT_QUERY_MAX_LENGTH,
): string {
  const suffix = `${USER_QUERY_MARKER}${userQuery}`;
  const maxContextLen = Math.max(256, maxLength - suffix.length);
  let context = formattedContext;
  if (context.length > maxContextLen) {
    const notice = "\n\n...(retrieved context truncated to fit API limit)...\n\n";
    context = context.slice(0, Math.max(0, maxContextLen - notice.length)) + notice;
  }
  return `${context}${suffix}`;
}

const WINDOWS_PATH_RE = /[A-Za-z]:\\[\w\s./\\-]+/g;
const SOURCE_BLOCK_RE = /Source\s*\[S\d+\][^\n]*\n?/gi;
const PROMPT_ECHO_SOURCE_BLOCK_RE =
  /(?:^|\n)---\s*\n+Source\s*\[S\d+\][\s\S]*?(?=(?:\n---\s*\n+Source\s*\[S\d+\])|$)/gi;

export function stripPromptEchoFromAssistant(text: string): string {
  let cleaned = text;
  // Strip "Retrieved codebase sources ..." context header (new format)
  if (cleaned.startsWith("Retrieved codebase sources")) {
    const afterHeader = cleaned.indexOf("\n\n");
    if (afterHeader !== -1) {
      cleaned = cleaned.slice(afterHeader + 2);
    }
  }
  // Strip old "Context:" header
  if (cleaned.startsWith("Context:")) {
    cleaned = cleaned.replace(/^Context:\s*\n?/, "");
  }
  // Strip "Current user question:" line
  if (cleaned.includes("Current user question:")) {
    cleaned = cleaned.replace(/^Current user question:.*?(?:\n|$)/m, "").trim();
  }
  cleaned = cleaned.replace(PROMPT_ECHO_SOURCE_BLOCK_RE, "");
  cleaned = cleaned.replace(/^---+(\s*\n)*/gm, "");
  if (
    cleaned.startsWith("Retrieved codebase sources") ||
    cleaned.startsWith("Context:") ||
    cleaned.includes("Current user question:")
  ) {
    cleaned = cleaned.trim();
  }
  return cleaned;
}

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

  if (
    role === "assistant" &&
    (text.startsWith("Context:") ||
      text.startsWith("Retrieved codebase sources") ||
      (text.includes("Current user question:") && /Source\s*\[S\d+\]/i.test(text)))
  ) {
    text = stripPromptEchoFromAssistant(text);
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
