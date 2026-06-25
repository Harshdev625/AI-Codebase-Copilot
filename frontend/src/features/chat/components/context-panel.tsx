import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  GitBranch,
  GitCommit,
  Info,
  Loader2,
  Pin,
  Plus,
  Search,
  Trash2,
  Zap,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileIcon } from "@/features/studio/components/file-icon";
import { useStudioStore } from "@/features/studio/store/studio-store";
import {
  useRepositoryInsights,
  useContextTokens,
  useRepositories,
  useSkippedFiles,
} from "@/features/repositories/hooks/use-repositories";
import { useSessionScope } from "@/features/chat/hooks/use-session-scope";
import {
  useContextEntries,
  useRemoveContextEntryMutation,
} from "@/features/chat/hooks/use-context-entries";
import { useChatSession } from "@/features/chat/hooks/use-chat";
import {
  formatTokenCount,
  getSessionUsageTotals,
  TOKEN_CALCULATION_HELP,
} from "@/features/chat/utils/token-usage-utils";
import { repositoryService } from "@/features/repositories/services/repository-service";
import { isLikelyFilePath } from "@/features/chat/utils/composer-mention-utils";
import { formatSkipReason } from "@/features/repositories/utils/skip-reason-labels";

// ---------------------------------------------------------------------------
// Language display metadata
// ---------------------------------------------------------------------------

const LANG_META: Record<string, { bg: string; text: string; short: string }> = {
  typescript: { bg: "bg-[#3178C6]/20", text: "text-[#58A6FF]", short: "TS" },
  javascript: { bg: "bg-[#F7DF1E]/20", text: "text-[#F0C200]", short: "JS" },
  python: { bg: "bg-[#3572A5]/20", text: "text-[#4B8BBE]", short: "PY" },
  go: { bg: "bg-[#00ADD8]/20", text: "text-[#00ADD8]", short: "GO" },
  rust: { bg: "bg-[#DEA584]/20", text: "text-[#DEA584]", short: "RS" },
  java: { bg: "bg-[#B07219]/20", text: "text-[#E76F00]", short: "JV" },
  css: { bg: "bg-[#563D7C]/20", text: "text-[#a67ee3]", short: "CS" },
  html: { bg: "bg-[#E34F26]/20", text: "text-[#FF6B35]", short: "HT" },
  json: { bg: "bg-[#8B949E]/20", text: "text-[#8B949E]", short: "JS" },
  markdown: { bg: "bg-[#8B949E]/20", text: "text-[#8B949E]", short: "MD" },
  yaml: { bg: "bg-[#8B949E]/20", text: "text-[#8B949E]", short: "YM" },
  shell: { bg: "bg-[#3FB950]/20", text: "text-[#3FB950]", short: "SH" },
  sql: { bg: "bg-[#e38c16]/20", text: "text-[#e38c16]", short: "SQ" },
  cpp: { bg: "bg-[#f34b7d]/20", text: "text-[#f34b7d]", short: "C+" },
  c: { bg: "bg-[#555555]/20", text: "text-[#aaaaaa]", short: " C" },
  ruby: { bg: "bg-[#701516]/20", text: "text-[#cc3333]", short: "RB" },
  php: { bg: "bg-[#4F5D95]/20", text: "text-[#7b84c0]", short: "PH" },
};

function getLangMeta(lang: string) {
  return (
    LANG_META[lang.toLowerCase()] ?? {
      bg: "bg-[#8B949E]/20",
      text: "text-[#8B949E]",
      short: lang.slice(0, 2).toUpperCase(),
    }
  );
}

type HealthStatus = "healthy" | "failed" | "indexing" | "unknown";

function resolveHealthStatus(jobStatus?: string): HealthStatus {
  if (jobStatus === "completed") return "healthy";
  if (jobStatus === "failed") return "failed";
  if (jobStatus === "running" || jobStatus === "in_progress" || jobStatus === "pending") {
    return "indexing";
  }
  return "unknown";
}

function isScopeDirectory(path: string): boolean {
  if (path.endsWith("/")) return true;
  const base = path.split("/").pop() ?? path;
  return !base.includes(".");
}

// ---------------------------------------------------------------------------
// Shared UI
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="border-b border-[#1E212B] last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[#1C1F26]/60"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[#6E7681] transition-transform duration-150",
            open && "rotate-180",
          )}
        />
        <span className="flex-1 text-[12px] font-semibold text-[#C9D1D9]">{title}</span>
        {badge}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

function HealthPill({ status }: { status: HealthStatus }) {
  if (status === "healthy") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#238636]/40 bg-[#238636]/10 px-2 py-0.5 text-[10px] font-semibold text-[#3FB950]">
        <CheckCircle2 className="h-3 w-3" />
        Healthy
      </span>
    );
  }
  if (status === "indexing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#58A6FF]/40 bg-[#58A6FF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#58A6FF]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Indexing
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        <AlertCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#2D313E] bg-[#1C1F26] px-2 py-0.5 text-[10px] font-semibold text-[#8B949E]">
      <Clock className="h-3 w-3" />
      Not indexed
    </span>
  );
}

function StatTile({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="rounded-md border border-[#2D313E]/60 bg-[#161B22] px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6E7681]">{label}</p>
      <p className="mt-0.5 truncate font-mono text-[13px] font-semibold text-[#E2E8F0]">
        {loading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Token Budget
// ---------------------------------------------------------------------------

function TokenBudgetSection({
  repoId,
  scopePaths,
  attachedFiles = [],
  defaultOpen,
}: {
  repoId: string;
  scopePaths: string[];
  attachedFiles?: string[];
  defaultOpen?: boolean;
}) {
  const { data: budget, isLoading } = useContextTokens(repoId, {
    scope_paths: scopePaths,
    attached_files: attachedFiles,
  });

  const pct = budget ? Math.min(100, Math.round((budget.total_tokens / budget.max_tokens) * 100)) : 0;
  const barColor = pct >= 85 ? "bg-destructive" : pct >= 60 ? "bg-amber-500" : "bg-[#3FB950]";
  const textColor =
    pct >= 85 ? "text-destructive" : pct >= 60 ? "text-amber-500" : "text-[#3FB950]";

  return (
    <Section
      title="Context estimate"
      defaultOpen={defaultOpen ?? pct >= 50}
      badge={
        budget ? (
          <span className={cn("font-mono text-[10px] font-bold", textColor)}>{pct}%</span>
        ) : null
      }
    >
      <p className="mb-2 text-[10px] leading-relaxed text-[#6E7681]">
        {TOKEN_CALCULATION_HELP.context}
      </p>
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-[#8B949E]">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-[11px]">Calculating…</span>
          </div>
        ) : budget ? (
          <>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#2D313E]">
              <div
                className={cn("h-full rounded-full transition-all duration-300", barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="space-y-1">
              {[
                { label: "Scope", value: budget.scope_tokens ?? 0 },
                { label: "Retrieval", value: budget.retrieval_tokens ?? 0 },
                { label: "Attached", value: budget.attached_tokens ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-[11px]">
                  <span className="text-[#8B949E]">{label}</span>
                  <span className="font-mono text-[#C9D1D9]">{value.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-[#2D313E]/50 pt-1.5 text-[11px]">
                <span className="font-medium text-[#E2E8F0]">Total</span>
                <span className="font-mono text-[#E2E8F0]">
                  {budget.total_tokens.toLocaleString()} / {budget.max_tokens.toLocaleString()}
                </span>
              </div>
            </div>
            {pct >= 85 && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[10px] leading-snug text-destructive">
                Context budget nearly full — remove scope paths or context entries.
              </p>
            )}
          </>
        ) : (
          <p className="text-[11px] italic text-[#8B949E]">Token budget unavailable.</p>
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Context Entries
// ---------------------------------------------------------------------------

function ContextEntriesSection({ sessionId }: { sessionId: string }) {
  const { data: entries = [], isLoading } = useContextEntries(sessionId);
  const removeMutation = useRemoveContextEntryMutation(sessionId);
  const totalTokens = entries.reduce((sum, e) => sum + (e.token_count ?? 0), 0);

  return (
    <Section
      title="Context Entries"
      defaultOpen={entries.length > 0}
      badge={
        entries.length > 0 ? (
          <span className="rounded bg-[#2D313E] px-1.5 py-0.5 font-mono text-[10px] text-[#8B949E]">
            {entries.length}
          </span>
        ) : null
      }
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-[#8B949E]">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-[11px]">Loading…</span>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-[#8B949E]">
          Files the AI retrieves during chat will appear here with token counts.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-[#8B949E]">
            <Zap className="h-3 w-3" />
            {totalTokens.toLocaleString()} tokens across {entries.length} entries
          </div>
          <div className="max-h-[220px] space-y-0.5 overflow-y-auto custom-scrollbar">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#1C1F26]"
              >
                {entry.is_pinned ? (
                  <Pin className="h-3 w-3 shrink-0 text-amber-500" />
                ) : (
                  <FileIcon path={entry.path} className="h-3.5 w-3.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-mono text-[11px] text-[#C9D1D9]"
                    title={entry.path}
                  >
                    {entry.path}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-[10px] text-[#6E7681]">
                      {(entry.token_count ?? 0).toLocaleString()} tok
                    </span>
                    {entry.entry_type === "CHUNK" && (
                      <span className="rounded bg-[#2D313E] px-1 text-[9px] uppercase text-[#8B949E]">
                        chunk
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 text-[#8B949E] transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  onClick={() => removeMutation.mutate(entry.id)}
                  disabled={removeMutation.isPending}
                  title="Remove from context"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

function ScopeSection({
  repoId,
  scopePaths,
  attachedFiles,
  activeSessionId,
  activeFilePath,
  toggleScopePath,
  toggleAttachedFile,
  addMentionPath,
}: {
  repoId: string;
  scopePaths: string[];
  attachedFiles: string[];
  activeSessionId: string | null;
  activeFilePath: string | null;
  toggleScopePath: (path: string) => void;
  toggleAttachedFile: (path: string) => void;
  addMentionPath: (path: string, isFile: boolean) => void;
}) {
  const openFileTab = useStudioStore((s) => s.openFileTab);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  const canAddCurrent =
    !!activeSessionId &&
    !!activeFilePath &&
    !scopePaths.includes(activeFilePath) &&
    !attachedFiles.includes(activeFilePath);

  const [results, setResults] = React.useState<Array<{ path: string; type: string }>>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!searchQuery.trim() || !repoId) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      repositoryService
        .searchFiles(repoId, searchQuery.trim(), 12)
        .then((res) => setResults(res.items ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, repoId]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allPaths = React.useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ path: string; pinned: boolean; isDir: boolean }> = [];
    for (const p of attachedFiles) {
      if (!seen.has(p)) {
        seen.add(p);
        items.push({ path: p, pinned: true, isDir: false });
      }
    }
    for (const p of scopePaths) {
      if (!seen.has(p)) {
        seen.add(p);
        items.push({
          path: p,
          pinned: false,
          isDir: isScopeDirectory(p),
        });
      }
    }
    return items;
  }, [scopePaths, attachedFiles]);

  const handleAddSearchResult = (path: string, type: string) => {
    if (!activeSessionId) return;
    const isFile = type === "FILE" || isLikelyFilePath(path);
    addMentionPath(path, isFile);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const handleRemove = (path: string) => {
    if (attachedFiles.includes(path)) toggleAttachedFile(path);
    if (scopePaths.includes(path)) toggleScopePath(path);
  };

  return (
    <Section
      title="Context files"
      defaultOpen
      badge={
        allPaths.length > 0 ? (
          <span className="rounded bg-[#2D313E] px-1.5 py-0.5 font-mono text-[10px] text-[#8B949E]">
            {allPaths.length}
          </span>
        ) : null
      }
    >
      <div className="space-y-2">
        {!activeSessionId ? (
          <p className="text-[11px] leading-relaxed text-[#8B949E]">
            Start a chat session to add files and folders for the AI to prioritize.
          </p>
        ) : (
          <>
            <div className="relative" ref={searchRef}>
              <div className="flex items-center gap-1.5 rounded-md border border-[#2D313E] bg-[#0D1117] px-2 py-1.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-[#6E7681]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search files to add…"
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-[#C9D1D9] placeholder:text-[#6E7681] focus:outline-none"
                />
              </div>
              {searchOpen && searchQuery.trim() && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[180px] overflow-y-auto rounded-md border border-[#2D313E] bg-[#161B22] py-1 shadow-xl custom-scrollbar">
                  {loading ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-[#8B949E]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Searching…
                    </div>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-[#8B949E]">No matching paths</p>
                  ) : (
                    results.map((item) => (
                      <button
                        key={`${item.type}-${item.path}`}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-[#C9D1D9] hover:bg-[#1F242D]"
                        onClick={() => handleAddSearchResult(item.path, item.type)}
                      >
                        <FileIcon path={item.path} isDirectory={item.type === "DIRECTORY"} className="h-3.5 w-3.5" />
                        <span className="truncate font-mono">{item.path}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {canAddCurrent && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md border border-dashed border-[#2D313E] px-2 py-1.5 text-left text-[11px] text-[#58A6FF] transition-colors hover:border-[#58A6FF]/40 hover:bg-[#58A6FF]/5"
                onClick={() => addMentionPath(activeFilePath!, true)}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Add open file: {activeFilePath!.split("/").pop()}</span>
              </button>
            )}
          </>
        )}

        {allPaths.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-[#8B949E]">
            No files in context. Search above, add the open file, or right-click in Explorer.
          </p>
        ) : (
          <div className="max-h-[220px] space-y-0.5 overflow-y-auto custom-scrollbar">
            {allPaths.map(({ path, pinned, isDir }) => {
              const isActive = activeFilePath === path;
              return (
                <div
                  key={path}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-1.5 py-1",
                    isActive ? "bg-[#37373D]" : "hover:bg-[#1C1F26]",
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => {
                      if (!isDir) openFileTab(path);
                    }}
                    title={path}
                  >
                    <FileIcon path={path} isDirectory={isDir} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate font-mono text-[11px] text-[#C9D1D9]">{path}</span>
                    {pinned && (
                      <span className="shrink-0 rounded bg-[#58A6FF]/15 px-1 py-0 text-[8px] font-bold uppercase text-[#58A6FF]">
                        pinned
                      </span>
                    )}
                  </button>
                  {activeSessionId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 text-[#8B949E] transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      onClick={() => handleRemove(path)}
                      title="Remove from context"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Skipped / excluded files
// ---------------------------------------------------------------------------

function SkippedFilesSection({
  repoId,
  filesSkipped,
  skipBreakdown,
}: {
  repoId: string;
  filesSkipped: number;
  skipBreakdown?: Record<string, number>;
}) {
  const [filterReason, setFilterReason] = React.useState<string | undefined>();
  const { data, isLoading } = useSkippedFiles(repoId, filterReason);
  const openFileTab = useStudioStore((s) => s.openFileTab);

  if (filesSkipped <= 0) return null;

  const reasons = Object.entries(skipBreakdown ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <Section
      title="Excluded from index"
      defaultOpen={filesSkipped <= 40}
      badge={
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-500">
          {filesSkipped}
        </span>
      }
    >
      <p className="mb-2 text-[11px] leading-relaxed text-[#8B949E]">
        {filesSkipped} file{filesSkipped === 1 ? "" : "s"} were not indexed. These paths are
        excluded from semantic search but may still exist in the repo.
      </p>

      {reasons.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFilterReason(undefined)}
            className={cn(
              "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
              !filterReason
                ? "border-[#58A6FF]/40 bg-[#58A6FF]/10 text-[#58A6FF]"
                : "border-[#2D313E] text-[#8B949E] hover:border-[#444D56]",
            )}
          >
            All ({filesSkipped})
          </button>
          {reasons.map(([reason, count]) => (
            <button
              key={reason}
              type="button"
              onClick={() => setFilterReason(reason)}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                filterReason === reason
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                  : "border-[#2D313E] text-[#8B949E] hover:border-[#444D56]",
              )}
              title={formatSkipReason(reason)}
            >
              {formatSkipReason(reason)} ({count})
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-[#8B949E]">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-[11px]">Loading excluded files…</span>
        </div>
      ) : !data?.items?.length ? (
        <p className="text-[11px] text-[#8B949E]">No excluded files match this filter.</p>
      ) : (
        <div className="max-h-[280px] space-y-0.5 overflow-y-auto custom-scrollbar">
          {data.items.map((file) => (
            <div
              key={file.path}
              className="group flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-[#1C1F26]"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500/80" />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="block w-full truncate text-left font-mono text-[11px] text-[#C9D1D9] hover:text-[#58A6FF]"
                  title={file.path}
                  onClick={() => openFileTab(file.path)}
                >
                  {file.path}
                </button>
                <p className="text-[10px] text-amber-500/90">{formatSkipReason(file.skip_reason)}</p>
              </div>
            </div>
          ))}
          {data.total > data.items.length && (
            <p className="pt-1 text-center text-[10px] text-[#6E7681]">
              Showing {data.items.length} of {data.total} excluded files
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Technologies
// ---------------------------------------------------------------------------

function TechnologiesSection({
  languageEntries,
  loading,
}: {
  languageEntries: [string, number][];
  loading: boolean;
}) {
  const maxCount = languageEntries[0]?.[1] ?? 1;

  return (
    <Section title="Technologies" defaultOpen={languageEntries.length > 0}>
      {loading ? (
        <div className="flex items-center gap-2 text-[#8B949E]">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-[11px]">Loading…</span>
        </div>
      ) : languageEntries.length === 0 ? (
        <p className="text-[11px] text-[#8B949E]">
          Index the repository to see language breakdown.
        </p>
      ) : (
        <div className="space-y-2.5">
          {languageEntries.map(([lang, count]) => {
            const meta = getLangMeta(lang);
            const width = Math.max(8, Math.round((count / maxCount) * 100));
            return (
              <div key={lang} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] font-mono text-[9px] font-bold",
                        meta.bg,
                        meta.text,
                      )}
                    >
                      {meta.short}
                    </div>
                    <span className="truncate text-[11px] capitalize text-[#C9D1D9]">{lang}</span>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-[#8B949E]">
                    {count.toLocaleString()}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-[#2D313E]">
                  <div className={cn("h-full rounded-full", meta.bg)} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Session LLM usage
// ---------------------------------------------------------------------------

function SessionUsageSection({ sessionId }: { sessionId: string }) {
  const { data: session, isLoading } = useChatSession(sessionId);
  const totals = session ? getSessionUsageTotals(session) : null;

  return (
    <Section
      title="Session usage"
      defaultOpen
      badge={
        totals?.total_tokens ? (
          <span className="font-mono text-[10px] text-[#8B949E]">
            {formatTokenCount(totals.total_tokens)}
          </span>
        ) : null
      }
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-[#8B949E]">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-[11px]">Loading…</span>
        </div>
      ) : !totals || !totals.request_count ? (
        <p className="text-[11px] leading-relaxed text-[#8B949E]">
          Send a message to record LLM token usage for this session.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Requests" value={String(totals.request_count ?? 0)} />
            <StatTile label="Total tokens" value={formatTokenCount(totals.total_tokens)} />
            <StatTile label="Prompt" value={formatTokenCount(totals.prompt_tokens)} />
            <StatTile label="Completion" value={formatTokenCount(totals.completion_tokens)} />
          </div>
          <div className="flex items-start gap-2 rounded-md border border-[#2D313E]/60 bg-[#161B22] px-2 py-1.5 text-[10px] leading-relaxed text-[#6E7681]">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{TOKEN_CALCULATION_HELP.llm}</span>
          </div>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Compact strip (AI dock)
// ---------------------------------------------------------------------------

function CompactContextStrip({
  repoId,
  scopePaths,
  healthStatus,
  sessionId,
}: {
  repoId: string;
  scopePaths: string[];
  healthStatus: HealthStatus;
  sessionId: string | null;
}) {
  const { data: budget } = useContextTokens(repoId, { scope_paths: scopePaths });
  const { data: entries = [] } = useContextEntries(sessionId);
  const pct = budget ? Math.min(100, Math.round((budget.total_tokens / budget.max_tokens) * 100)) : 0;

  return (
    <div className="flex h-full items-center gap-4 overflow-x-auto px-3 py-2 text-[11px]">
      <HealthPill status={healthStatus} />
      <span className="text-[#8B949E]">
        Scope:{" "}
        <span className="font-mono font-semibold text-[#C9D1D9]">{scopePaths.length}</span>
      </span>
      {budget && (
        <span className="text-[#8B949E]">
          Tokens:{" "}
          <span
            className={cn(
              "font-mono font-semibold",
              pct >= 85 ? "text-destructive" : pct >= 60 ? "text-amber-500" : "text-[#3FB950]",
            )}
          >
            {pct}%
          </span>
        </span>
      )}
      {sessionId && (
        <span className="text-[#8B949E]">
          Entries:{" "}
          <span className="font-mono font-semibold text-[#C9D1D9]">{entries.length}</span>
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ContextPanelProps {
  repositoryId?: string;
  /** When true, renders content only (no outer chrome). Used by Studio context column. */
  embedded?: boolean;
  /** Slim summary row for AI dock footer. */
  compact?: boolean;
}

export function ContextPanel({
  repositoryId,
  embedded = false,
  compact = false,
}: ContextPanelProps) {
  const { selectedRepositoryId, activeSessionId, activeFilePath } = useStudioStore();
  const { repositories } = useRepositories();
  const repoId = repositoryId || selectedRepositoryId || "";
  const selectedRepository = repositories.find((r) => r.id === repoId);
  const { data: insights, isLoading: insightsLoading } = useRepositoryInsights(repoId);
  const { scopePaths, attachedFiles, toggleScopePath, toggleAttachedFile, addMentionPath } =
    useSessionScope(activeSessionId);

  const repoName = selectedRepository?.repo_id || repoId || "Repository";
  const repoShortName = repoName.split("/").pop() || repoName;
  const branchName = selectedRepository?.default_branch || "main";
  const commitSha =
    insights?.latest_commit ||
    (selectedRepository?.latest_job_stats?.commit_sha as string | undefined);
  const lastCommit = commitSha ? commitSha.substring(0, 7) : "—";
  const filesIndexed = insights?.files_indexed ?? 0;
  const filesTotal = insights?.files_total ?? 0;
  const filesSkipped = insights?.files_skipped ?? 0;
  const chunksIndexed =
    insights?.chunk_count ?? selectedRepository?.latest_indexed_chunks ?? 0;

  const languageEntries: [string, number][] = Object.entries(
    (insights?.language_breakdown as Record<string, number> | undefined) ?? {},
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const healthStatus = resolveHealthStatus(
    insights?.indexing_health?.latest_job_status as string | undefined,
  );

  if (compact) {
    if (!repoId) return null;
    return (
      <CompactContextStrip
        repoId={repoId}
        scopePaths={scopePaths}
        healthStatus={healthStatus}
        sessionId={activeSessionId}
      />
    );
  }

  const content = (
    <div className={cn(!embedded && "flex h-full flex-col bg-[#13151A]")}>
      {/* Repo summary */}
      <div className="border-b border-[#1E212B] px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="truncate text-[13px] font-semibold text-[#E2E8F0]" title={repoName}>
              {repoShortName}
            </h4>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className="h-5 gap-1 border-none bg-[#58A6FF]/10 px-1.5 text-[10px] font-medium text-[#58A6FF] hover:bg-[#58A6FF]/15"
              >
                <GitBranch className="h-2.5 w-2.5" />
                {branchName}
              </Badge>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#8B949E]">
                <GitCommit className="h-3 w-3" />
                {lastCommit}
              </span>
            </div>
          </div>
          <HealthPill status={healthStatus} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatTile
            label="Indexed"
            value={`${Number(filesIndexed).toLocaleString()} / ${Number(filesTotal).toLocaleString()}`}
            loading={insightsLoading}
          />
          <StatTile
            label="Chunks"
            value={Number(chunksIndexed).toLocaleString()}
            loading={insightsLoading}
          />
        </div>

        {filesSkipped > 0 && (
          <p className="mt-2 text-[10px] text-amber-500/90">
            {filesSkipped.toLocaleString()} excluded — see list below for reasons
          </p>
        )}
      </div>

      {/* Sections */}
      <div className="min-h-0 flex-1">
        <ScopeSection
          repoId={repoId}
          scopePaths={scopePaths}
          attachedFiles={attachedFiles}
          activeSessionId={activeSessionId}
          activeFilePath={activeFilePath}
          toggleScopePath={toggleScopePath}
          toggleAttachedFile={toggleAttachedFile}
          addMentionPath={addMentionPath}
        />

        {repoId && filesSkipped > 0 && (
          <SkippedFilesSection
            repoId={repoId}
            filesSkipped={filesSkipped}
            skipBreakdown={insights?.skip_reason_breakdown}
          />
        )}

        {repoId && (
          <TokenBudgetSection
            repoId={repoId}
            scopePaths={scopePaths}
            attachedFiles={attachedFiles}
          />
        )}

        {activeSessionId && <SessionUsageSection sessionId={activeSessionId} />}

        {activeSessionId && <ContextEntriesSection sessionId={activeSessionId} />}

        <TechnologiesSection languageEntries={languageEntries} loading={insightsLoading} />

        {!activeSessionId && (
          <div className="border-b border-[#1E212B] px-3 py-3 last:border-b-0">
            <div className="flex items-start gap-2 rounded-md border border-[#2D313E]/60 bg-[#161B22] px-2.5 py-2">
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6E7681]" />
              <p className="text-[11px] leading-relaxed text-[#8B949E]">
                Start a chat session to track context entries and token usage for this repository.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-l border-[#1E212B] bg-[#13151A]">
      <div className="shrink-0 border-b border-[#1E212B] px-4 py-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#8B949E]">
          Context
        </h3>
        <p className="mt-0.5 truncate text-xs font-medium text-[#C9D1D9]">{repoShortName}</p>
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">{content}</div>
    </aside>
  );
}
