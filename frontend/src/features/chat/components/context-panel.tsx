import * as React from "react";
import {
  Database,
  FileText,
  Loader2,
  ChevronDown,
  CheckCircle2,
  Clock,
  Folder,
  AlertCircle,
  Pin,
  PinOff,
  Trash2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/features/studio/store/studio-store";
import {
  useRepositoryInsights,
  useContextTokens,
  useRepositories,
} from "@/features/repositories/hooks/use-repositories";
import { useSessionScope } from "@/features/chat/hooks/use-session-scope";
import {
  useContextEntries,
  useRemoveContextEntryMutation,
} from "@/features/chat/hooks/use-context-entries";

// ---------------------------------------------------------------------------
// Language display metadata
// ---------------------------------------------------------------------------

const LANG_META: Record<string, { bg: string; text: string; short: string }> = {
  typescript:  { bg: "bg-[#3178C6]/20", text: "text-[#58A6FF]",  short: "TS" },
  javascript:  { bg: "bg-[#F7DF1E]/20", text: "text-[#F0C200]",  short: "JS" },
  python:      { bg: "bg-[#3572A5]/20", text: "text-[#4B8BBE]",  short: "PY" },
  go:          { bg: "bg-[#00ADD8]/20", text: "text-[#00ADD8]",  short: "GO" },
  rust:        { bg: "bg-[#DEA584]/20", text: "text-[#DEA584]",  short: "RS" },
  java:        { bg: "bg-[#B07219]/20", text: "text-[#E76F00]",  short: "JV" },
  css:         { bg: "bg-[#563D7C]/20", text: "text-[#a67ee3]",  short: "CS" },
  html:        { bg: "bg-[#E34F26]/20", text: "text-[#FF6B35]",  short: "HT" },
  json:        { bg: "bg-[#8B949E]/20", text: "text-[#8B949E]",  short: "JS" },
  markdown:    { bg: "bg-[#8B949E]/20", text: "text-[#8B949E]",  short: "MD" },
  yaml:        { bg: "bg-[#8B949E]/20", text: "text-[#8B949E]",  short: "YM" },
  shell:       { bg: "bg-[#3FB950]/20", text: "text-[#3FB950]",  short: "SH" },
  sql:         { bg: "bg-[#e38c16]/20", text: "text-[#e38c16]",  short: "SQ" },
  cpp:         { bg: "bg-[#f34b7d]/20", text: "text-[#f34b7d]",  short: "C+" },
  c:           { bg: "bg-[#555555]/20", text: "text-[#aaaaaa]",  short: " C" },
  ruby:        { bg: "bg-[#701516]/20", text: "text-[#cc3333]",  short: "RB" },
  php:         { bg: "bg-[#4F5D95]/20", text: "text-[#7b84c0]",  short: "PH" },
};

function getLangMeta(lang: string) {
  return LANG_META[lang.toLowerCase()] ?? {
    bg: "bg-[#8B949E]/20",
    text: "text-[#8B949E]",
    short: lang.slice(0, 2).toUpperCase(),
  };
}

// ---------------------------------------------------------------------------
// Accordion
// ---------------------------------------------------------------------------

function Accordion({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-lg bg-[#1C1F26] border border-[#2D313E] overflow-hidden">
      <div
        className="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[#2D313E]/50 transition-colors select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <h4 className="text-[#E2E8F0] text-[13px] font-medium">{title}</h4>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-[#8B949E] transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </div>
      {open && <div className="border-t border-[#2D313E]">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Token Budget section
// ---------------------------------------------------------------------------

function TokenBudgetSection({
  repoId,
  scopePaths,
}: {
  repoId: string;
  scopePaths: string[];
}) {
  const { data: budget, isLoading } = useContextTokens(repoId, {
    scope_paths: scopePaths,
  });

  const pct = budget ? Math.min(100, Math.round((budget.total_tokens / budget.max_tokens) * 100)) : 0;
  const barColor =
    pct >= 85 ? "bg-destructive" : pct >= 60 ? "bg-amber-500" : "bg-[#3FB950]";
  const textColor =
    pct >= 85 ? "text-destructive" : pct >= 60 ? "text-amber-500" : "text-[#3FB950]";

  return (
    <Accordion title="Token Budget" defaultOpen={false}>
      <div className="p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-[#8B949E]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-[12px]">Calculating…</span>
          </div>
        ) : budget ? (
          <>
            {/* Utilization header */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#8B949E]">Utilization</span>
              <span className={cn("text-[11px] font-bold font-mono", textColor)}>
                {pct}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-[#2D313E] rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-300", barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Breakdown */}
            <div className="space-y-1.5">
              {[
                { label: "Scope tokens",     value: budget.scope_tokens     ?? 0 },
                { label: "Retrieval tokens", value: budget.retrieval_tokens ?? 0 },
                { label: "Attached tokens",  value: budget.attached_tokens  ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[11px] text-[#8B949E]">{label}</span>
                  <span className="text-[11px] font-mono text-[#C9D1D9]">
                    {value.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-[#2D313E]/50 pt-1.5">
                <span className="text-[11px] font-medium text-[#E2E8F0]">Total</span>
                <span className="text-[11px] font-mono text-[#E2E8F0]">
                  {budget.total_tokens.toLocaleString()} / {budget.max_tokens.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Warning banners */}
            {pct >= 85 && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-md p-2">
                <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                <span className="text-[11px] text-destructive leading-tight">
                  Context budget nearly exhausted. Remove entries or reduce scope.
                </span>
              </div>
            )}
            {pct >= 60 && pct < 85 && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-[11px] text-amber-500 leading-tight">
                  Context budget is getting full.
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-[11px] text-[#8B949E] italic">
            Token budget unavailable.
          </p>
        )}
      </div>
    </Accordion>
  );
}

// ---------------------------------------------------------------------------
// Context Entries section
// ---------------------------------------------------------------------------

function ContextEntriesSection({ sessionId }: { sessionId: string }) {
  const { data: entries = [], isLoading } = useContextEntries(sessionId);
  const removeMutation = useRemoveContextEntryMutation(sessionId);

  const totalTokens = entries.reduce((sum, e) => sum + (e.token_count ?? 0), 0);

  return (
    <Accordion
      title={`Context Entries${entries.length > 0 ? ` (${entries.length})` : ""}`}
      defaultOpen={false}
    >
      <div className="p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-[#8B949E]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-[12px]">Loading…</span>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-[11px] text-[#8B949E] italic px-1">
            No context entries. Files retrieved by the AI during this session
            will appear here.
          </p>
        ) : (
          <>
            {/* Total tokens summary */}
            <div className="flex items-center gap-1.5 px-1 pb-1 border-b border-[#2D313E]/50">
              <Zap className="w-3 h-3 text-[#8B949E]" />
              <span className="text-[11px] text-[#8B949E]">
                {totalTokens.toLocaleString()} tokens total
              </span>
            </div>

            {/* Entry list */}
            <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[#2D313E]/40 transition-colors"
                >
                  {/* Pin indicator */}
                  <div className="shrink-0">
                    {entry.is_pinned ? (
                      <Pin className="w-3 h-3 text-amber-500" />
                    ) : (
                      <div className="w-3 h-3" />
                    )}
                  </div>

                  {/* Path + metadata */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[11px] font-mono text-[#C9D1D9] truncate leading-tight"
                      title={entry.path}
                    >
                      {entry.path.split("/").pop() ?? entry.path}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[#8B949E]">
                        {(entry.token_count ?? 0).toLocaleString()} tokens
                      </span>
                      {entry.entry_type === "CHUNK" && (
                        <span className="text-[10px] text-[#8B949E] bg-[#2D313E] px-1 rounded">
                          chunk
                        </span>
                      )}
                      {entry.expires_at && (
                        <span className="text-[10px] text-amber-500/80" title={`Expires: ${entry.expires_at}`}>
                          exp
                        </span>
                      )}
                      {entry.priority > 0 && (
                        <span className="text-[10px] text-[#8B949E]">
                          p{entry.priority}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-[#8B949E] hover:text-destructive hover:bg-destructive/10 transition-opacity"
                    onClick={() => removeMutation.mutate(entry.id)}
                    disabled={removeMutation.isPending}
                    title="Remove from context"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Accordion>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContextPanelProps {
  repositoryId?: string;
}

export function ContextPanel({ repositoryId }: ContextPanelProps) {
  const { selectedRepositoryId, activeSessionId } = useStudioStore();
  const { repositories } = useRepositories();
  const repoId = repositoryId || selectedRepositoryId || "";
  const selectedRepository = repositories.find((r) => r.id === repoId);
  const { data: insights, isLoading: insightsLoading } = useRepositoryInsights(repoId);

  const { scopePaths, toggleScopePath } = useSessionScope(activeSessionId);

  // Derived values from real data
  const repoName     = selectedRepository?.repo_id || repoId || "NO REPOSITORY";
  const branchName   = selectedRepository?.default_branch || "main";
  const commitSha    = insights?.latest_commit || (selectedRepository?.latest_job_stats?.commit_sha as string | undefined);
  const lastCommit   = commitSha ? commitSha.substring(0, 7) : "unknown";
  const filesIndexed = insights?.files_indexed ?? selectedRepository?.latest_job_stats?.total_files ?? 0;
  const chunksIndexed = insights?.chunk_count ?? selectedRepository?.latest_indexed_chunks ?? 0;

  // Language breakdown — top-5 by count, descending
  const languageEntries: [string, number][] = Object.entries(
    (insights?.language_breakdown as Record<string, number> | undefined) ?? {}
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Health status from actual indexing health data
  const jobStatus = insights?.indexing_health?.latest_job_status as string | undefined;
  const healthStatus: "healthy" | "failed" | "indexing" | "unknown" =
    jobStatus === "completed"                                                   ? "healthy"
    : jobStatus === "failed"                                                    ? "failed"
    : jobStatus === "running" || jobStatus === "in_progress" || jobStatus === "pending" ? "indexing"
    : "unknown";

  return (
    <aside className="w-[280px] shrink-0 h-full flex flex-col bg-[#13151A] border-l border-[#1E212B]">
      {/* Header */}
      <div className="flex items-center px-5 pt-5 pb-4 shrink-0">
        <h3 className="text-[#C9D1D9] text-[11px] font-bold tracking-wider uppercase">
          CONTEXT: {repoName.split("/").pop() || "REPOSITORY"}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 custom-scrollbar">
        {/* ---------------------------------------------------------------- */}
        {/* Repo Info                                                        */}
        {/* ---------------------------------------------------------------- */}
        <div className="rounded-lg bg-[#1C1F26] border border-[#2D313E] overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[#2D313E]">
            <h4 className="text-[#E2E8F0] text-[13px] font-medium">Repo Info</h4>
          </div>
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#8B949E] text-[12px]">Branch</span>
              <Badge
                variant="secondary"
                className="text-[10px] px-2 py-0.5 rounded-full font-medium text-[#58A6FF] bg-[#58A6FF]/10 hover:bg-[#58A6FF]/20 border-none"
              >
                {branchName}
              </Badge>
            </div>

            <div className="flex items-center justify-between border-t border-[#2D313E]/50 pt-2">
              <span className="text-[#8B949E] text-[12px]">Commit</span>
              <span className="text-[12px] font-mono text-[#C9D1D9]">{lastCommit}</span>
            </div>

            <div className="flex items-center justify-between border-t border-[#2D313E]/50 pt-2">
              <span className="text-[#8B949E] text-[12px]">Files Indexed</span>
              <span className="text-[12px] text-[#C9D1D9]">
                {insightsLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin inline" />
                ) : (
                  (filesIndexed as number).toLocaleString() + " files"
                )}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-[#2D313E]/50 pt-2">
              <span className="text-[#8B949E] text-[12px]">Chunks</span>
              <span className="text-[12px] text-[#C9D1D9]">
                {insightsLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin inline" />
                ) : (
                  (chunksIndexed as number).toLocaleString()
                )}
              </span>
            </div>

            {/* Health status */}
            <div className="pt-3 pb-1">
              {healthStatus === "healthy" && (
                <>
                  <div className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-[#238636]/10 border border-[#238636] text-[#3FB950] text-[12px] font-bold cursor-default transition-all hover:bg-[#238636]/20">
                    <CheckCircle2 className="w-4 h-4" /> Healthy
                  </div>
                  <p className="text-center mt-2 text-[10px] text-[#8B949E]">
                    Index Status:{" "}
                    <span className="text-[#3FB950]">Synchronized & Healthy</span>
                  </p>
                </>
              )}
              {healthStatus === "indexing" && (
                <>
                  <div className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-[#58A6FF]/10 border border-[#58A6FF]/40 text-[#58A6FF] text-[12px] font-bold cursor-default">
                    <Loader2 className="w-4 h-4 animate-spin" /> Indexing…
                  </div>
                  <p className="text-center mt-2 text-[10px] text-[#8B949E]">
                    Index Status:{" "}
                    <span className="text-[#58A6FF]">Indexing in progress</span>
                  </p>
                </>
              )}
              {healthStatus === "failed" && (
                <>
                  <div className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-destructive/10 border border-destructive/40 text-destructive text-[12px] font-bold cursor-default">
                    <AlertCircle className="w-4 h-4" /> Needs Attention
                  </div>
                  <p className="text-center mt-2 text-[10px] text-[#8B949E]">
                    Index Status:{" "}
                    <span className="text-destructive">Last indexing job failed</span>
                  </p>
                </>
              )}
              {healthStatus === "unknown" && (
                <>
                  <div className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-[#2D313E] border border-[#2D313E] text-[#8B949E] text-[12px] font-bold cursor-default">
                    <Clock className="w-4 h-4" /> Not Indexed
                  </div>
                  <p className="text-center mt-2 text-[10px] text-[#8B949E]">
                    Index Status: <span className="text-[#8B949E]">Not yet indexed</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Token Budget — requires active repo                             */}
        {/* ---------------------------------------------------------------- */}
        {repoId && (
          <TokenBudgetSection repoId={repoId} scopePaths={scopePaths} />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Context Entries — requires active session                       */}
        {/* ---------------------------------------------------------------- */}
        {activeSessionId && (
          <ContextEntriesSection sessionId={activeSessionId} />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Scope / Active Context                                          */}
        {/* ---------------------------------------------------------------- */}
        <Accordion
          title={`Scope Context${scopePaths.length > 0 ? ` (${scopePaths.length})` : ""}`}
        >
          <div className="p-3 space-y-1.5">
            {scopePaths.length === 0 ? (
              <p className="text-[11px] text-[#8B949E] italic px-1">
                No scope set. Use the Explorer to add files or folders to
                context.
              </p>
            ) : (
              scopePaths.map((p) => (
                <div key={p} className="flex items-center gap-2 text-[#C9D1D9] group">
                  <Folder className="w-3.5 h-3.5 text-[#8B949E] shrink-0" />
                  <span className="text-[11px] font-mono truncate flex-1" title={p}>
                    {p}
                  </span>
                  {activeSessionId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-[#8B949E] hover:text-destructive hover:bg-destructive/10"
                      onClick={() => toggleScopePath(p)}
                      title="Remove from scope"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </Accordion>

        {/* ---------------------------------------------------------------- */}
        {/* Technologies — driven by insights.language_breakdown            */}
        {/* ---------------------------------------------------------------- */}
        <Accordion title="Technologies">
          <div className="p-3 space-y-2.5">
            {insightsLoading && (
              <div className="flex items-center gap-2 text-[#8B949E]">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[12px]">Loading…</span>
              </div>
            )}
            {!insightsLoading && languageEntries.length === 0 && (
              <p className="text-[11px] text-[#8B949E] italic">
                No language data yet. Index the repository to populate this
                section.
              </p>
            )}
            {languageEntries.map(([lang, count]) => {
              const meta = getLangMeta(lang);
              return (
                <div
                  key={lang}
                  className="flex items-center justify-between text-[#C9D1D9]"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "w-5 h-5 rounded-[4px] flex items-center justify-center text-[10px] font-bold font-mono",
                        meta.bg,
                        meta.text
                      )}
                    >
                      {meta.short}
                    </div>
                    <span className="text-[12px] capitalize">{lang}</span>
                  </div>
                  <span className="text-[11px] text-[#8B949E] font-mono">
                    {count.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </Accordion>

        {/* ---------------------------------------------------------------- */}
        {/* Current Context summary                                         */}
        {/* ---------------------------------------------------------------- */}
        <Accordion title="Current Context" defaultOpen={false}>
          <div className="p-3">
            <div className="flex items-center gap-2 text-[#C9D1D9]">
              <FileText className="w-3.5 h-3.5 text-[#8B949E]" />
              <span className="text-[12px]">
                {scopePaths.length === 0
                  ? "No files in scope"
                  : `${scopePaths.length} path${scopePaths.length === 1 ? "" : "s"} in scope`}
              </span>
            </div>
            {insights?.files_skipped != null && insights.files_skipped > 0 && (
              <div className="mt-2 flex items-center gap-2 text-[#8B949E]">
                <span className="text-[11px]">
                  {insights.files_skipped.toLocaleString()} files skipped during
                  indexing
                </span>
              </div>
            )}
          </div>
        </Accordion>
      </div>
    </aside>
  );
}
