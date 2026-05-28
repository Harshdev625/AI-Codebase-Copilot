'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, FolderGit2, MessageSquare, Database, CheckCircle2, Clock, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/features/dashboard/hooks/use-dashboard';
import { cn } from '@/lib/utils';

/** Compute greeting based on current hour */
function useGreeting(): string {
  const [greeting, setGreeting] = React.useState('Hello');
  React.useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);
  return greeting;
}

/** Metric card component */
function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5 hover:bg-card/70 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
        <div className="text-muted-foreground/60">{Icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-bold text-foreground">{value}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
    </div>
  );
}

/** Repository row status badge */
function StatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'completed') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
        <CheckCircle2 className="h-3 w-3" />
        Indexed
      </div>
    );
  }

  if (normalized === 'in_progress') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        <Clock className="h-3 w-3 animate-spin" />
        Indexing
      </div>
    );
  }

  if (normalized === 'failed') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
        <AlertCircle className="h-3 w-3" />
        Failed
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
      <Clock className="h-3 w-3" />
      Not Indexed
    </div>
  );
}

export default function DashboardPage() {
  const greeting = useGreeting();
  const { summary, isLoading, isError, refetch } = useDashboard();

  const userGreeting = summary?.user?.full_name || summary?.user?.email?.split('@')[0] || 'Developer';
  const metrics = summary?.metrics || { repositories_count: 0, chat_count: 0, indexed_chunks_count: 0 };
  const recentRepos = summary?.recent_repositories || [];

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            <span className="text-foreground/70">{greeting}, </span>
            <span className="gradient-text">{userGreeting}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor your repositories, indexing status, and recent activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-9 border-border/60 bg-background/70 backdrop-blur-sm hover:bg-background"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Link href="/repositories">
            <Button size="sm" className="h-9 gap-1.5 shadow-glow-md">
              <Plus className="h-4 w-4" />
              New Repository
            </Button>
          </Link>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex h-96 items-center justify-center rounded-2xl border border-border/40 bg-card/30">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-destructive">Failed to load dashboard</h3>
              <p className="mt-1 text-sm text-destructive/80">Please try refreshing the page or contact support if the problem persists.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Metrics grid */}
      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<FolderGit2 className="h-4 w-4" />}
              label="Repositories"
              value={metrics.repositories_count || 0}
              description="total"
            />
            <MetricCard
              icon={<MessageSquare className="h-4 w-4" />}
              label="Chat Sessions"
              value={metrics.chat_count || 0}
              description="created"
            />
            <MetricCard
              icon={<Database className="h-4 w-4" />}
              label="Indexed Chunks"
              value={(metrics.indexed_chunks_count || 0).toLocaleString()}
              description="code segments"
            />
            <MetricCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Status"
              value="Healthy"
              description="systems online"
            />
          </div>

          {/* Recent repositories section */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Repositories</h2>

            {recentRepos.length === 0 ? (
              <div className="rounded-2xl border border-border/40 bg-card/30 p-8 sm:p-12 text-center">
                <div className="flex justify-center mb-4">
                  <div className="rounded-full bg-primary/10 p-4">
                    <FolderGit2 className="h-6 w-6 text-primary/60" />
                  </div>
                </div>
                <h3 className="font-semibold text-foreground">No repositories yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add your first repository to get started with AI-powered code analysis.
                </p>
                <Link href="/repositories" className="mt-4 inline-block">
                  <Button className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Add Repository
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-card/50 px-4 py-3 hover:bg-card/70 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href="/repositories"
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
                      >
                        {repo.repo_id}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Branch: <span className="font-mono">{repo.default_branch}</span>
                      </p>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={repo.latest_index_status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions footer */}
          <div className="rounded-2xl border border-border/40 bg-card/30 p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">Next Steps</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Get more from your codebase intelligence workspace.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/repositories">
                <Button variant="outline" className="w-full justify-start h-9">
                  <FolderGit2 className="mr-2 h-4 w-4" />
                  Manage Repositories
                </Button>
              </Link>
              <Link href="/chat">
                <Button variant="outline" className="w-full justify-start h-9">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Start Chat
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
