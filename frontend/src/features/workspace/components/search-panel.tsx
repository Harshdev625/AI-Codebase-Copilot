import React, { useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { useRepositoryRetrieveMutation, useRepositories } from '@/features/repositories/hooks/use-repositories';
import { Search, Loader2, FileCode, SearchX, Code2, Text } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SearchPanelProps {
  /**
   * Optional result-click handler override.
   * When provided (e.g. in Studio canvas), called with file path, content, and
   * start line instead of opening a workspace tab. Content is fetched from the
   * API first (same as the default flow) and then forwarded to the callback.
   */
  onResultClick?: (path: string, content: string, initialLine?: number) => void;
}

export function SearchPanel({ onResultClick }: SearchPanelProps = {}) {
  const { 
    selectedRepositoryId, openTab, 
    searchQuery: query, setSearchQuery: setQuery, 
    searchResults: results, setSearchResults: setResults, 
    hasSearched, setHasSearched 
  } = useWorkspaceStore();
  const { repositories } = useRepositories();
  const selectedRepository = repositories.find(r => r.id === selectedRepositoryId);
  
  const searchMutation = useRepositoryRetrieveMutation(selectedRepository?.id || '');

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || !selectedRepository) return;

    setHasSearched(true);
    const res = await searchMutation.mutateAsync({ query, top_k: 20 });
    setResults(res.items || []);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const openResult = async (item: any) => {
    try {
      const { repositoryService } = await import('@/features/repositories/services/repository-service');
      const resContent = await repositoryService.getFileContent(selectedRepository?.id || '', item.path);
      const content = resContent.content ?? '';

      if (onResultClick) {
        onResultClick(item.path, content, item.start_line);
        return;
      }

      openTab({
        id: `file-${selectedRepository?.id}-${item.path}`,
        type: 'code',
        title: item.path.split('/').pop() || item.path,
        filePath: item.path,
        content: content,
        initialLine: item.start_line
      });
    } catch (err) {
      console.error(err);
      if (onResultClick) {
        onResultClick(item.path, item.content, item.start_line);
        return;
      }
      openTab({
        id: `file-${selectedRepository?.id}-${item.path}`,
        type: 'code',
        title: item.path.split('/').pop() || item.path,
        filePath: item.path,
        content: item.content,
        initialLine: item.start_line
      });
    }
  };

  if (!selectedRepository) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-center">
        <p className="text-sm text-muted-foreground">Select a repository to search.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b space-y-3 shrink-0 bg-surface">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace Search</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Semantic or exact search..."
              className="pl-8 text-xs h-8 bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/50"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button 
            size="sm" 
            className="h-8 px-3 text-xs" 
            onClick={handleSearch}
            disabled={searchMutation.isPending || !query.trim()}
          >
            {searchMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Find"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {searchMutation.isPending ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasSearched && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-3">
            <SearchX className="w-8 h-8 opacity-20" />
            <p className="text-sm">No results found for &quot;{query}&quot;</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {results.map((item, idx) => {
              const score = item.rerank_score ?? item.score;
              const isSymbol = item.symbol && item.symbol !== 'module';
              return (
                <div 
                  key={`${item.id}-${idx}`}
                  className="p-3 rounded-lg border border-border/40 bg-card hover:bg-accent/20 cursor-pointer transition-colors group flex flex-col gap-2"
                  onClick={() => openResult(item)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isSymbol ? (
                        <Code2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <FileCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-foreground truncate" title={item.path}>
                        {item.path.split('/').pop()}
                      </span>
                    </div>
                    {score !== undefined && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                        {(score * 100).toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {item.path}
                  </div>
                  <div className="bg-muted/30 rounded p-2 text-[10px] font-mono text-muted-foreground/90 overflow-hidden relative">
                    <div className="max-h-20 overflow-hidden relative">
                      <pre className="whitespace-pre-wrap leading-relaxed">{item.content}</pre>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted/30 to-transparent" />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    {isSymbol ? (
                      <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded truncate max-w-[150px]">
                        {item.symbol}
                      </span>
                    ) : (
                      <span className="text-[9px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded uppercase">
                        {item.language || 'TEXT'}
                      </span>
                    )}
                    <span className="text-[9px] text-muted-foreground font-mono">
                      L{item.start_line}-L{item.end_line}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
