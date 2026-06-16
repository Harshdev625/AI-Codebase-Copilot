"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Loader2,
  Regex,
  Search,
  SearchX,
  WholeWord,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatSearchResultPath, toRepoRelativePath } from "@/lib/path-utils";
import { FileIcon } from "@/features/studio/components/file-icon";
import { useStudioStore } from "@/features/studio/store/studio-store";
import {
  useRepositories,
  useRepositoryRetrieveMutation,
  useRepositoryWorkspaceSearchMutation,
} from "@/features/repositories/hooks/use-repositories";
import type {
  WorkspaceSearchFileResult,
  WorkspaceSearchMatch,
  WorkspaceSearchResponse,
} from "@/features/repositories/types/repository-types";

type SearchMode = "text" | "semantic";

interface SearchPanelProps {
  onResultClick?: (path: string, content: string, initialLine?: number, initialEndLine?: number) => void;
}

function parseGlobs(raw: string): string[] | undefined {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function highlightPreview(preview: string, query: string, useRegex: boolean): React.ReactNode {
  if (!query.trim() || useRegex) return preview;
  const idx = preview.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return preview;
  return (
    <>
      {preview.slice(0, idx)}
      <mark className="rounded bg-[#9e6a03]/40 text-[#E2E8F0]">{preview.slice(idx, idx + query.length)}</mark>
      {preview.slice(idx + query.length)}
    </>
  );
}

function NestedFilePath({
  path,
  workspaceHint,
}: {
  path: string;
  workspaceHint?: string | null;
}) {
  const { fileName, parentPath, relativePath } = formatSearchResultPath(path, workspaceHint);
  return (
    <div className="min-w-0 flex-1 leading-tight">
      <div className="truncate text-[11px] font-medium text-[#C9D1D9]" title={relativePath}>
        {fileName}
      </div>
      {parentPath ? (
        <div className="truncate text-[10px] text-[#6E7681]" title={relativePath}>
          {parentPath}
        </div>
      ) : null}
    </div>
  );
}

function MatchRow({
  match,
  query,
  useRegex,
  isActive,
  onClick,
  onMouseEnter,
}: {
  match: WorkspaceSearchMatch;
  query: string;
  useRegex: boolean;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex w-full items-start gap-2 rounded px-2 py-1 text-left font-mono text-[11px] leading-relaxed",
        isActive ? "bg-[#37373D] text-[#E2E8F0]" : "text-[#8B949E] hover:bg-[#1C1F26]",
      )}
    >
      <span className="w-8 shrink-0 text-right text-[#6E7681]">{match.line}</span>
      <span className="min-w-0 flex-1 truncate">{highlightPreview(match.preview, query, useRegex)}</span>
    </button>
  );
}

function FileGroup({
  file,
  query,
  useRegex,
  activeKey,
  onSelect,
  onHover,
  defaultOpen,
  workspaceHint,
}: {
  file: WorkspaceSearchFileResult;
  query: string;
  useRegex: boolean;
  activeKey: string | null;
  onSelect: (path: string, line: number, column?: number) => void;
  onHover: (key: string) => void;
  defaultOpen?: boolean;
  workspaceHint?: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);

  return (
    <div className="mb-1">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded px-1 py-1 hover:bg-[#1C1F26]"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-[#6E7681]" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-[#6E7681]" />
        )}
        <FileIcon path={file.path} className="h-3.5 w-3.5" />
        <NestedFilePath path={file.path} workspaceHint={workspaceHint} />
        <span className="ml-auto shrink-0 font-mono text-[10px] text-[#6E7681]">{file.matches.length}</span>
      </button>
      {open && (
        <div className="ml-4 border-l border-[#2D313E]/60 pl-1">
          {file.matches.map((m) => {
            const key = `${file.path}:${m.line}:${m.column}`;
            return (
              <MatchRow
                key={key}
                match={m}
                query={query}
                useRegex={useRegex}
                isActive={activeKey === key}
                onClick={() => onSelect(file.path, m.line, m.column)}
                onMouseEnter={() => onHover(key)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SearchPanel({ onResultClick }: SearchPanelProps = {}) {
  const { selectedRepositoryId, openFileTab, searchQuery, setSearchQuery } = useStudioStore();
  const { repositories } = useRepositories();
  const selectedRepository = repositories.find((r) => r.id === selectedRepositoryId);
  const workspaceHint =
    selectedRepository?.local_path ??
    selectedRepository?.repo_id?.split("/").pop() ??
    null;
  const searchMutation = useRepositoryWorkspaceSearchMutation(selectedRepository?.id || "");

  const [mode, setMode] = useState<SearchMode>("text");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [includeGlobs, setIncludeGlobs] = useState("");
  const [excludeGlobs, setExcludeGlobs] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [result, setResult] = useState<WorkspaceSearchResponse | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q || !selectedRepository?.id || mode !== "text") return;
    setHasSearched(true);
    const res = await searchMutation.mutateAsync({
      query: q,
      case_sensitive: caseSensitive,
      whole_word: wholeWord,
      use_regex: useRegex,
      include_globs: parseGlobs(includeGlobs),
      exclude_globs: parseGlobs(excludeGlobs),
      max_results: 500,
    });
    setResult(res);
    const first = res.files[0]?.matches[0];
    if (first && res.files[0]) {
      setActiveKey(`${res.files[0].path}:${first.line}:${first.column}`);
    } else {
      setActiveKey(null);
    }
  }, [
    searchQuery,
    selectedRepository?.id,
    mode,
    searchMutation,
    caseSensitive,
    wholeWord,
    useRegex,
    includeGlobs,
    excludeGlobs,
  ]);

  useEffect(() => {
    if (mode !== "text" || !searchQuery.trim() || !selectedRepository?.id) return;
    const q = searchQuery.trim();
    const t = window.setTimeout(() => {
      setHasSearched(true);
      searchMutation
        .mutateAsync({
          query: q,
          case_sensitive: caseSensitive,
          whole_word: wholeWord,
          use_regex: useRegex,
          include_globs: parseGlobs(includeGlobs),
          exclude_globs: parseGlobs(excludeGlobs),
          max_results: 500,
        })
        .then((res) => {
          setResult(res);
          const first = res.files[0]?.matches[0];
          const firstPath = res.files[0]?.path;
          if (first && firstPath) {
            setActiveKey(`${firstPath}:${first.line}:${first.column}`);
          } else {
            setActiveKey(null);
          }
        })
        .catch(() => setResult(null));
    }, 400);
    return () => window.clearTimeout(t);
  }, [
    searchQuery,
    caseSensitive,
    wholeWord,
    useRegex,
    includeGlobs,
    excludeGlobs,
    mode,
    selectedRepository?.id,
    searchMutation.mutateAsync,
  ]);

  const flatKeys = useMemo(() => {
    if (!result) return [] as string[];
    const keys: string[] = [];
    result.files.forEach((f) =>
      f.matches.forEach((m) => keys.push(`${f.path}:${m.line}:${m.column}`)),
    );
    return keys;
  }, [result]);

  const openAt = useCallback(
    (
      path: string,
      line: number,
      opts?: { endLine?: number; column?: number; snippet?: string },
    ) => {
      const relPath = toRepoRelativePath(path, workspaceHint);
      const highlight = {
        query: mode === "text" && !useRegex ? searchQuery.trim() : undefined,
        column: opts?.column,
        snippet: opts?.snippet,
      };
      if (onResultClick) {
        onResultClick(relPath, "", line, opts?.endLine);
        return;
      }
      openFileTab(relPath, line, undefined, opts?.endLine, highlight);
    },
    [onResultClick, openFileTab, mode, useRegex, searchQuery, workspaceHint],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeKey && flatKeys.length > 0) {
        const sep = activeKey.lastIndexOf(":");
        const colSep = activeKey.lastIndexOf(":", sep - 1);
        const path = activeKey.slice(0, colSep);
        const line = Number(activeKey.slice(colSep + 1, sep));
        const column = Number(activeKey.slice(sep + 1));
        openAt(path, line, { column: Number.isFinite(column) ? column : undefined });
        return;
      }
      void runSearch();
      return;
    }
    if (!flatKeys.length) return;
    const idx = activeKey ? flatKeys.indexOf(activeKey) : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = idx < flatKeys.length - 1 ? idx + 1 : 0;
      setActiveKey(flatKeys[next]);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = idx > 0 ? idx - 1 : flatKeys.length - 1;
      setActiveKey(flatKeys[next]);
    }
  };

  if (!selectedRepository) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <p className="text-sm text-[#8B949E]">Select a repository to search.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#13151A]">
      <div className="shrink-0 space-y-2 border-b border-[#1E212B] p-3">
        <div className="flex gap-1">
          {(["text", "semantic"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                mode === m
                  ? "bg-[#58A6FF]/15 text-[#58A6FF]"
                  : "text-[#6E7681] hover:text-[#C9D1D9]",
              )}
            >
              {m === "text" ? "Text" : "Semantic"}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#6E7681]" />
          <Input
            ref={inputRef}
            placeholder={mode === "text" ? "Search in files…" : "Semantic search (AI)…"}
            className="h-8 border-[#2D313E] bg-[#0B0D14] pl-8 pr-20 text-xs text-[#C9D1D9] placeholder:text-[#6E7681]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {mode === "text" && (
            <div className="absolute right-1 top-1 flex gap-0.5">
              <ToggleIcon
                active={caseSensitive}
                onClick={() => setCaseSensitive((v) => !v)}
                title="Match case"
              >
                <CaseSensitive className="h-3.5 w-3.5" />
              </ToggleIcon>
              <ToggleIcon active={wholeWord} onClick={() => setWholeWord((v) => !v)} title="Whole word">
                <WholeWord className="h-3.5 w-3.5" />
              </ToggleIcon>
              <ToggleIcon active={useRegex} onClick={() => setUseRegex((v) => !v)} title="Use regex">
                <Regex className="h-3.5 w-3.5" />
              </ToggleIcon>
            </div>
          )}
        </div>

        {mode === "text" && (
          <>
            <button
              type="button"
              className="text-[10px] text-[#6E7681] hover:text-[#8B949E]"
              onClick={() => setShowFilters((v) => !v)}
            >
              {showFilters ? "Hide filters" : "Files to include / exclude"}
            </button>
            {showFilters && (
              <div className="space-y-1.5">
                <Input
                  placeholder="Include: **/*.ts, **/*.tsx"
                  value={includeGlobs}
                  onChange={(e) => setIncludeGlobs(e.target.value)}
                  className="h-7 border-[#2D313E] bg-[#0B0D14] text-[10px]"
                />
                <Input
                  placeholder="Exclude: **/tests/**"
                  value={excludeGlobs}
                  onChange={(e) => setExcludeGlobs(e.target.value)}
                  className="h-7 border-[#2D313E] bg-[#0B0D14] text-[10px]"
                />
              </div>
            )}
          </>
        )}

        {mode === "text" && hasSearched && result && !searchMutation.isPending && (
          <p className="text-[10px] text-[#6E7681]">
            {result.total_matches} result{result.total_matches === 1 ? "" : "s"} in {result.total_files} file
            {result.total_files === 1 ? "" : "s"}
            {result.truncated ? " (truncated)" : ""}
            {result.engine ? ` · ${result.engine}` : ""}
          </p>
        )}
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-2">
        {mode === "semantic" ? (
          <SemanticSearchFallback
            repositoryId={selectedRepository.id}
            query={searchQuery}
            onOpen={openAt}
            workspaceHint={workspaceHint}
          />
        ) : searchMutation.isPending ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#6E7681]" />
          </div>
        ) : hasSearched && result && result.files.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-[#8B949E]">
            <SearchX className="h-8 w-8 opacity-30" />
            <p className="text-sm">No results for &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          result?.files.map((file) => (
            <FileGroup
              key={file.path}
              file={file}
              query={searchQuery}
              useRegex={useRegex}
              activeKey={activeKey}
              onSelect={openAt}
              onHover={setActiveKey}
              workspaceHint={workspaceHint}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ToggleIcon({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded",
        active ? "bg-[#58A6FF]/20 text-[#58A6FF]" : "text-[#6E7681] hover:bg-[#1C1F26] hover:text-[#C9D1D9]",
      )}
    >
      {children}
    </button>
  );
}

function SemanticSearchFallback({
  repositoryId,
  query,
  onOpen,
  workspaceHint,
}: {
  repositoryId: string;
  query: string;
  onOpen: (
    path: string,
    line: number,
    opts?: { endLine?: number; snippet?: string },
  ) => void;
  workspaceHint?: string | null;
}) {
  const mutation = useRepositoryRetrieveMutation(repositoryId);
  const [items, setItems] = useState<
    Array<{ id: string; path: string; content: string; start_line: number; end_line: number }>
  >([]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setItems([]);
      return;
    }
    const t = window.setTimeout(() => {
      mutation
        .mutateAsync({ query: q, top_k: 20 })
        .then((res) => {
          const q = query.trim();
          const list = res.items || [];
          const ranked = [...list].sort((a, b) => {
            const score = (item: (typeof list)[number]) => {
              const needle = q.toLowerCase();
              let s = 0;
              if (item.content.toLowerCase().includes(needle)) s += 2;
              if (item.path.toLowerCase().includes(needle)) s += 1;
              return s;
            };
            return score(b) - score(a);
          });
          setItems(ranked);
        })
        .catch(() => setItems([]));
    }, 500);
    return () => window.clearTimeout(t);
  }, [query, mutation.mutateAsync]);

  if (!query.trim()) {
    return (
      <p className="p-4 text-center text-[11px] text-[#6E7681]">
        Semantic search finds related code by meaning. For exact text matches, switch to Text.
      </p>
    );
  }
  if (mutation.isPending) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-[#6E7681]" />
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="p-4 text-center text-[11px] text-[#6E7681]">No semantic matches.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-[10px] text-[#6E7681]">
        Results are ranked by meaning. Use <span className="text-[#8B949E]">Text</span> for exact matches.
      </p>
      {items.map((item, idx) => {
        const rel = toRepoRelativePath(item.path, workspaceHint);
        const hasLiteral = query.trim()
          ? `${item.path} ${item.content}`.toLowerCase().includes(query.trim().toLowerCase())
          : false;
        return (
        <button
          key={`${item.id}-${idx}`}
          type="button"
          onClick={() =>
            onOpen(rel, item.start_line ?? 1, {
              endLine: item.end_line,
              snippet: item.content,
            })
          }
          className="w-full rounded-lg border border-[#2D313E]/60 bg-[#161B22] p-2 text-left hover:bg-[#1C1F26]"
        >
          <div className="flex items-start gap-2">
            <FileIcon path={rel} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <NestedFilePath path={item.path} workspaceHint={workspaceHint} />
            {item.start_line > 0 && (
              <span className="ml-auto shrink-0 font-mono text-[10px] text-[#6E7681]">
                L{item.start_line}
                {item.end_line > item.start_line ? `–${item.end_line}` : ""}
              </span>
            )}
          </div>
          {!hasLiteral && query.trim() && (
            <span className="mt-0.5 inline-block text-[9px] uppercase tracking-wide text-[#6E7681]">
              Similar · not exact match
            </span>
          )}
          <pre className="mt-1 max-h-16 overflow-hidden text-[10px] text-[#8B949E]">
            {highlightPreview(item.content, query, false)}
          </pre>
        </button>
      );
      })}
    </div>
  );
}
