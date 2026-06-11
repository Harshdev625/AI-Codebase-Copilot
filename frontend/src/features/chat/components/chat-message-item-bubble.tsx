'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, UserRound, Copy, Check, FileCode } from 'lucide-react';
import { ChatMessage } from '@/features/chat/types/chat-types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';
import { PatchDiffViewer } from './patch-diff-viewer';
import { useParams, useRouter } from 'next/navigation';
import type { Source } from '@/features/chat/types/chat-types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  mode?: string;
}

/* ── Copy button ─────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 rounded-lg border border-border/50 px-2.5 py-1 text-[9px] font-bold text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/* ── Source Explorer V2 ────────────────────────────────── */
function SourceExplorerV2({ sources }: { sources: Source[] }) {
  const router = useRouter();

  if (sources.length === 0) return null;

  return (
    <div className="mt-6 mb-2">
      <div className="flex items-center gap-2 mb-3 px-1">
        <FileCode className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Retrieved Context</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {sources.map((src, idx) => {
          const score = typeof src.rerank_score === 'number' ? src.rerank_score : (typeof src.score === 'number' ? src.score : null);
          const scoreDisplay = score !== null ? (score * 100).toFixed(1) + '%' : 'N/A';
          return (
            <div key={idx} className="group relative rounded-xl border border-border/50 bg-accent/10 px-3 py-2.5 hover:bg-accent/30 transition-colors flex flex-col gap-1 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                 <span className="text-xs font-semibold text-foreground truncate" title={src.path}>{src.path.split('/').pop() || src.path}</span>
                 <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{scoreDisplay}</Badge>
              </div>
              <div className="text-[10px] text-muted-foreground/80 truncate">
                {src.path}
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-[10px] font-mono text-primary/70 bg-primary/10 px-1 py-0.5 rounded truncate">
                  {src.symbol || 'module'}
                </span>
                {src.start_line !== undefined && src.end_line !== undefined && (
                  <span className="text-[10px] text-muted-foreground">
                    L{src.start_line}-L{src.end_line}
                  </span>
                )}
              </div>
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                 <button 
                   onClick={() => router.push(`/repositories/${src.repository_id || src.repo_id}/code?path=${encodeURIComponent(src.path)}${src.start_line ? `&line=${src.start_line}` : ''}`)}
                   className="text-xs font-bold text-primary hover:underline"
                 >
                   Open Full File
                 </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Message bubble ────────────────────────────────────── */
export function ChatMessageItemBubble({ message, mode }: ChatMessageBubbleProps) {
  const isAssistant = message.role === 'assistant';
  const metadata = message.metadata ?? {};
  const intent = typeof metadata.intent === 'string' ? metadata.intent : '';
  const sources = Array.isArray(metadata.sources) ? metadata.sources : [];
  
  const patchProposal = sources.find((src) => src.kind === 'patch_proposal');
  const normalSources = sources.filter((src) => src.kind !== 'patch_proposal');

  const params = useParams();
  const repositoryId = typeof params.repositoryId === 'string' ? params.repositoryId : '';

  const isDocumentMode = isAssistant && (mode === 'PLAN' || mode === 'ACT');

  return (
    <div className={cn(
      'relative flex gap-3 transition-all duration-300 group py-4 border-b border-border/40 last:border-0',
      isDocumentMode ? 'px-6 mx-0 bg-card/60 backdrop-blur-md rounded-2xl border border-border/40 shadow-sm my-2' : 'px-4 mx-0',
      !isDocumentMode && isAssistant ? 'animate-fade-in' : ''
    )}>
      {/* Avatar */}
      {!isDocumentMode && (
        <div className="flex flex-col items-center shrink-0 pt-0.5">
          <div className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md border transition-all duration-300',
            isAssistant
              ? 'bg-primary/20 border-primary/30 text-primary shadow-sm'
              : 'bg-muted border-border text-muted-foreground'
          )}>
            {isAssistant ? <Bot className="h-3.5 w-3.5" /> : <UserRound className="h-3 w-3" />}
          </div>
        </div>
      )}

      {/* Content column */}
      <div className="flex-1 min-w-0 pr-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn(
            'text-[12px] font-semibold',
            isAssistant ? 'text-foreground' : 'text-foreground'
          )}>
            {isAssistant ? 'AI Assistant' : 'You'}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {message.created_at ? formatTime(message.created_at) : 'Just now'}
          </span>
          {isAssistant && intent && (
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-[8px] font-bold bg-primary/15 border-primary/25 text-primary/70"
            >
              {intent}
            </Badge>
          )}
        </div>

        {/* Thinking Process */}
        {isAssistant && Array.isArray(metadata.statuses) && metadata.statuses.length > 0 && (
          <details className="group mb-4">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground flex items-center gap-2 hover:text-foreground transition-colors select-none">
              <span className="group-open:rotate-90 transition-transform text-[8px]">▶</span>
              Thinking Process
            </summary>
            <div className="mt-2 pl-4 border-l-2 border-border/50 flex flex-col gap-1.5">
              {metadata.statuses.map((status: string, idx: number) => (
                <div key={idx} className="text-[11px] text-muted-foreground/80 flex items-center gap-2 animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                  {status}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Body */}
        <div className={cn(
          'text-[14px] leading-[1.75] tracking-tight antialiased',
          isAssistant ? 'text-foreground/90 font-medium' : 'text-foreground/70'
        )}>
          {isAssistant ? (
            <div className="prose prose-sm dark:prose-invert max-w-none
              prose-p:mt-0 prose-p:mb-3 prose-p:leading-[1.8] prose-p:text-foreground/70
              prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight
              prose-code:text-primary/90 prose-code:bg-primary/15 prose-code:rounded-lg prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.82em] prose-code:font-bold prose-code:border prose-code:border-primary/25
              prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0
              prose-strong:text-foreground prose-strong:font-bold
              prose-ul:text-foreground/70 prose-li:text-foreground/70
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match;
                    if (isInline) {
                      return <code className={className} {...props}>{children}</code>;
                    }
                    return (
                      <CodeBlock
                        code={String(children).replace(/\n$/, '')}
                        language={match[1]}
                        className="my-5"
                      />
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              
              {isAssistant && patchProposal && patchProposal.proposal && repositoryId && (
                <PatchDiffViewer 
                  repositoryId={repositoryId}
                  diff={patchProposal.proposal.diff}
                  summary={patchProposal.proposal.summary}
                />
              )}
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>

        {!isAssistant && Array.isArray(metadata.scope_paths) && metadata.scope_paths.length > 0 && (
          <div className="mt-4 mb-2">
            <div className="flex items-center gap-2 mb-2 px-1">
              <FileCode className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manual Context</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {metadata.scope_paths.map((path: string, idx: number) => (
                <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-accent/20 border border-border/50 rounded-md text-[11px] text-foreground/80 font-mono">
                  <span className="truncate max-w-[200px]">{path.split('/').pop()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAssistant && normalSources.length > 0 && (
          <SourceExplorerV2 sources={normalSources as any} />
        )}

        {/* Copy button */}
        <div className="mt-4 flex flex-wrap items-center gap-2 justify-end">
          <CopyButton text={message.content} />
        </div>
      </div>
    </div>
  );
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}
