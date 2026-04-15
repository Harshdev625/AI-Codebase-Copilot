'use client';

import * as React from 'react';
import {
  Filter,
  Loader2,
  Network,
  RefreshCw,
  Search,
  Sparkles,
  Workflow,
} from 'lucide-react';

import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { useToast } from '@/components/shared/toast-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  api,
  type ArchitectureGraphEdge,
  type ArchitectureGraphNode,
  type ArchitectureGraphResponse,
  toApiError,
} from '@/lib/api';
import { cn } from '@/lib/utils';

function languageColor(language: string): string {
  const normalized = (language || '').toLowerCase();
  if (normalized.includes('py')) return 'bg-cyan-500/20 text-cyan-200 border-cyan-400/30';
  if (normalized.includes('ts') || normalized.includes('js')) return 'bg-violet-500/20 text-violet-200 border-violet-400/30';
  if (normalized.includes('java') || normalized.includes('kt')) return 'bg-amber-500/20 text-amber-200 border-amber-400/30';
  if (normalized.includes('go') || normalized.includes('rs')) return 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30';
  return 'bg-white/10 text-zinc-300 border-white/20';
}

function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: ArchitectureGraphNode[];
  edges: ArchitectureGraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  const viewNodes = React.useMemo(() => nodes.slice(0, 42), [nodes]);
  const nodeMap = React.useMemo(() => {
    const map = new Map<string, ArchitectureGraphNode>();
    viewNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [viewNodes]);

  const edgeSet = React.useMemo(
    () =>
      edges
        .filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target))
        .slice(0, 90),
    [edges, nodeMap]
  );

  const positions = React.useMemo(() => {
    const pointMap = new Map<string, { x: number; y: number }>();
    const count = Math.max(viewNodes.length, 1);
    const columns = Math.max(4, Math.ceil(Math.sqrt(count)));

    viewNodes.forEach((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const jitterX = (index % 3) * 18;
      const jitterY = (index % 5) * 12;
      pointMap.set(node.id, {
        x: 90 + col * 170 + jitterX,
        y: 70 + row * 130 + jitterY,
      });
    });

    return pointMap;
  }, [viewNodes]);

  return (
    <div className="relative h-[560px] w-full overflow-auto rounded-2xl border border-white/10 bg-[hsl(240,18%,6%)]">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-20" />
      <svg className="absolute left-0 top-0 h-full w-full" viewBox="0 0 1800 1200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="edgeGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(34,211,238,0.42)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0.1)" />
          </linearGradient>
        </defs>

        {edgeSet.map((edge) => {
          const source = positions.get(edge.source);
          const target = positions.get(edge.target);
          if (!source || !target) return null;
          const midX = (source.x + target.x) / 2;
          const controlY = Math.min(source.y, target.y) - 34;
          const isSelected = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);

          return (
            <path
              key={edge.id}
              d={`M ${source.x} ${source.y} Q ${midX} ${controlY} ${target.x} ${target.y}`}
              fill="none"
              stroke="url(#edgeGlow)"
              strokeWidth={isSelected ? 2.2 : 1.2}
              opacity={isSelected ? 0.95 : 0.45}
            />
          );
        })}
      </svg>

      <div className="relative h-[1200px] w-[1800px] p-6">
        {viewNodes.map((node) => {
          const point = positions.get(node.id);
          if (!point) return null;

          const isSelected = selectedNodeId === node.id;

          return (
            <button
              key={node.id}
              type="button"
              className={cn(
                'absolute w-[165px] rounded-xl border px-3 py-2 text-left backdrop-blur-sm transition-all duration-200',
                isSelected
                  ? 'border-cyan-300/60 bg-cyan-500/12 shadow-[0_0_22px_-8px_rgba(34,211,238,0.8)]'
                  : 'border-white/12 bg-white/5 hover:border-cyan-300/40 hover:bg-white/10'
              )}
              style={{ transform: `translate(${point.x - 82}px, ${point.y - 34}px)` }}
              onClick={() => onSelectNode(node.id)}
            >
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">{node.chunk_type}</p>
              <p className="mt-1 truncate text-sm font-semibold text-zinc-100">{node.symbol || 'module'}</p>
              <p className="mt-1 truncate text-[11px] text-zinc-400">{node.path?.split('/').slice(-2).join('/') || node.path}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminArchitecturePage(): React.JSX.Element {
  const toast = useToast();
  const [graph, setGraph] = React.useState<ArchitectureGraphResponse | null>(null);
  const [search, setSearch] = React.useState('');
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadGraph = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.admin.architectureGraph({ limit: 900 });
      setGraph(response);
      if (!selectedNodeId && response.nodes.length > 0) {
        setSelectedNodeId(response.nodes[0].id);
      }
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error('Graph load failed', message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNodeId, toast]);

  React.useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const filteredNodes = React.useMemo(() => {
    const nodes = graph?.nodes ?? [];
    if (!search.trim()) return nodes;
    const q = search.toLowerCase();
    return nodes.filter(
      (node) =>
        node.path?.toLowerCase().includes(q) ||
        node.symbol?.toLowerCase().includes(q) ||
        node.language?.toLowerCase().includes(q)
    );
  }, [graph, search]);

  const selectedNode = React.useMemo(
    () => filteredNodes.find((node) => node.id === selectedNodeId) ?? null,
    [filteredNodes, selectedNodeId]
  );

  const selectedEdges = React.useMemo(() => {
    if (!graph || !selectedNodeId) return [];
    return graph.edges.filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId).slice(0, 16);
  }, [graph, selectedNodeId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Architecture Graph Explorer"
        description="Interactive dependency and call-edge explorer for indexed repositories."
        className="border-white/10"
        actions={
          <Button
            variant="glass"
            className="h-9 gap-2 border-cyan-400/20 text-cyan-200 hover:border-cyan-300/40"
            onClick={() => void loadGraph()}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Graph
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void loadGraph()} /> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-[hsl(240,18%,7%)] p-4">
          <div className="flex items-center gap-2 text-zinc-300">
            <Network className="h-4 w-4 text-cyan-300" />
            <span className="text-xs uppercase tracking-[0.2em]">Nodes</span>
          </div>
          {isLoading ? <Skeleton className="mt-2 h-8 w-20 rounded-lg" /> : <p className="mt-2 text-2xl font-semibold text-zinc-100 tabular-nums">{graph?.stats.node_count ?? 0}</p>}
        </article>

        <article className="rounded-2xl border border-white/10 bg-[hsl(240,18%,7%)] p-4">
          <div className="flex items-center gap-2 text-zinc-300">
            <Workflow className="h-4 w-4 text-cyan-300" />
            <span className="text-xs uppercase tracking-[0.2em]">Edges</span>
          </div>
          {isLoading ? <Skeleton className="mt-2 h-8 w-20 rounded-lg" /> : <p className="mt-2 text-2xl font-semibold text-zinc-100 tabular-nums">{graph?.stats.edge_count ?? 0}</p>}
        </article>

        <article className="rounded-2xl border border-white/10 bg-[hsl(240,18%,7%)] p-4">
          <div className="flex items-center gap-2 text-zinc-300">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            <span className="text-xs uppercase tracking-[0.2em]">Selection</span>
          </div>
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-32 rounded-lg" />
          ) : (
            <p className="mt-2 truncate text-sm font-semibold text-zinc-200">{selectedNode?.symbol || 'No node selected'}</p>
          )}
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <article className="space-y-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[hsl(240,18%,7%)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                className="h-10 w-full rounded-xl border border-white/10 bg-[hsl(240,18%,6%)] pl-9 pr-3 text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-500/20"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search node path, symbol, language..."
              />
            </div>
            <Badge variant="outline" className="border-cyan-400/25 bg-cyan-500/10 text-cyan-200">
              <Filter className="mr-1.5 h-3 w-3" />
              {filteredNodes.length} visible nodes
            </Badge>
          </div>

          {isLoading ? (
            <Skeleton className="h-[560px] w-full rounded-2xl border border-white/10" />
          ) : (
            <GraphCanvas
              nodes={filteredNodes}
              edges={graph?.edges ?? []}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          )}
        </article>

        <article className="rounded-2xl border border-white/10 bg-[hsl(240,18%,7%)] p-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Node Inspector</h3>
          {isLoading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
          ) : selectedNode ? (
            <>
              <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-semibold text-zinc-100">{selectedNode.symbol || 'module'}</p>
                <p className="break-all text-xs text-zinc-400">{selectedNode.path}</p>
                <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', languageColor(selectedNode.language))}>
                  {selectedNode.language || 'unknown'}
                </span>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Connected Edges</p>
                <div className="mt-2 max-h-72 space-y-2 overflow-auto pr-1">
                  {selectedEdges.length > 0 ? (
                    selectedEdges.map((edge) => (
                      <div key={edge.id} className="rounded-lg border border-white/10 bg-[hsl(240,18%,6%)] p-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-zinc-200">{edge.edge_type}</p>
                          <span className="text-[10px] text-zinc-500">w={edge.weight.toFixed(2)}</span>
                        </div>
                        <p className="mt-1 break-all text-[10px] text-zinc-500">
                          {edge.source === selectedNode.id ? 'Outbound' : 'Inbound'} edge
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg border border-white/10 bg-[hsl(240,18%,6%)] p-3 text-xs text-zinc-500">No connected edges found for this node.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 rounded-xl border border-white/10 bg-[hsl(240,18%,6%)] p-3 text-xs text-zinc-500">
              Select a node in the graph to inspect dependency edges and metadata.
            </p>
          )}
        </article>
      </section>
    </div>
  );
}
