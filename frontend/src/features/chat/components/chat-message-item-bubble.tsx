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
import { useParams } from 'next/navigation';

interface ChatMessageBubbleProps {
  message: ChatMessage;
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

/* ── Message bubble ────────────────────────────────────── */
export function ChatMessageItemBubble({ message }: ChatMessageBubbleProps) {
  const isAssistant = message.role === 'assistant';
  const metadata = message.metadata ?? {};
  const intent = typeof metadata.intent === 'string' ? metadata.intent : '';
  const sources = Array.isArray(metadata.sources) ? metadata.sources : [];
  
  const patchProposal = sources.find((src) => src.kind === 'patch_proposal');
  const normalSources = sources.filter((src) => src.kind !== 'patch_proposal');

  const params = useParams();
  const repositoryId = typeof params.repositoryId === 'string' ? params.repositoryId : '';

  return (
    <div className={cn(
      'relative flex gap-4 py-7 group transition-all duration-300 px-5 rounded-3xl mx-2 my-1',
      isAssistant
        ? 'bg-card border border-primary/12 shadow-[0_4px_24px_-8px] shadow-primary/8 animate-fade-in'
        : 'bg-transparent hover:bg-accent/20 border border-transparent hover:border-border'
    )}>
      {/* Gradient left border for AI messages */}
      {isAssistant && (
        <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full bg-gradient-to-b from-primary/60 via-primary/40 to-transparent" />
      )}

      {/* Avatar */}
      <div className="flex flex-col items-center gap-2 px-1 shrink-0 pt-0.5">
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-2xl border transition-all duration-300',
          isAssistant
            ? 'bg-primary/30 border-primary/20 text-primary shadow-[0_0_16px_-4px] shadow-primary/40 group-hover:shadow-[0_0_24px_-4px] group-hover:shadow-primary/60 group-hover:scale-105'
            : 'bg-accent/40 border-border/50 text-muted-foreground group-hover:bg-accent/60'
        )}>
          {isAssistant ? <Bot className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
        </div>
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 pr-3">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-[0.15em]',
            isAssistant ? 'text-primary' : 'text-muted-foreground'
          )}>
            {isAssistant ? 'TimeMachine' : 'You'}
          </span>
          <span className="text-[9px] font-medium text-muted-foreground/60">
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
