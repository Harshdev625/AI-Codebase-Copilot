import type { ChatSession, SessionUsageTotals, TokenUsage } from "@/features/chat/types/chat-types";

export type { TokenUsage, SessionUsageTotals };

export function formatTokenCount(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

export function getSessionDisplayTitle(session: Pick<ChatSession, "session_title" | "summary" | "metadata">): string {
  const title = session.session_title?.trim();
  if (title) return title;
  const summary = session.summary?.trim();
  if (summary) return summary;
  const preview = (session.metadata?.title_preview as string | undefined)?.trim();
  if (preview) return preview.length > 60 ? `${preview.slice(0, 60)}…` : preview;
  return "New conversation";
}

export function getSessionUsageTotals(session: Pick<ChatSession, "metadata">): SessionUsageTotals | null {
  const totals = session.metadata?.usage_totals;
  if (!totals || typeof totals !== "object") return null;
  return totals as SessionUsageTotals;
}

export function getMessageUsage(metadata: Record<string, unknown>): TokenUsage | null {
  const usage = metadata.usage ?? (metadata.stats as Record<string, unknown> | undefined)?.usage;
  if (!usage || typeof usage !== "object") return null;
  return usage as TokenUsage;
}

export const TOKEN_CALCULATION_HELP = {
  llm: "LLM tokens come from Ollama when available (prompt_eval_count + eval_count). If the model does not report counts, we estimate ~4 characters per token.",
  context: "Context budget estimates indexed file size ÷ 4 for scope paths, plus fixed retrieval overhead. This is separate from LLM usage and does not block requests.",
} as const;
