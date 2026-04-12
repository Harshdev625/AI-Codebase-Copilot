'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, UserRound, Copy, Check, FileCode } from 'lucide-react';
import { ChatMessage } from '@/features/chat/types/chat-types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';

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
      className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 rounded-lg border border-white/6 px-2.5 py-1 text-[9px] font-bold text-zinc-600 hover:bg-white/5 hover:text-zinc-300 transition-all"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/* ── Message bubble ────────────────────────────────────── */
export function ChatMessageItemBubble({ message }: ChatMessageBubbleProps) {
  const isAssistant = message.role === 'assistant';
  const sources = message.metadata?.sources || [];

  return (
    <div className={cn(
      'relative flex gap-4 py-7 group transition-all duration-300 px-5 rounded-3xl mx-2 my-1',
      isAssistant
        ? 'bg-[hsl(240,18%,7%)] border border-violet-500/10 shadow-[inset_0_0_0_1px_hsl(265,80%,65%,0.05),0_4px_24px_-8px_hsl(265,80%,65%,0.08)] animate-fade-in'
        : 'bg-transparent hover:bg-white/2 border border-transparent hover:border-white/4'
    )}>
      {/* Gradient left border for AI messages */}
      {isAssistant && (
        <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full bg-gradient-to-b from-violet-500/60 via-indigo-500/40 to-transparent" />
      )}

      {/* Avatar */}
      <div className="flex flex-col items-center gap-2 px-1 shrink-0 pt-0.5">
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-2xl border transition-all duration-300',
          isAssistant
            ? 'bg-gradient-to-br from-violet-600/30 to-indigo-600/30 border-violet-500/20 text-violet-400 shadow-[0_0_16px_-4px_hsl(265,80%,65%,0.4)] group-hover:shadow-[0_0_24px_-4px_hsl(265,80%,65%,0.6)] group-hover:scale-105'
            : 'bg-white/4 border-white/8 text-zinc-500 group-hover:bg-white/6'
        )}>
          {isAssistant ? <Bot className="h-4.5 w-4.5" /> : <UserRound className="h-4.5 w-4.5" />}
        </div>
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 pr-3">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-[0.15em]',
            isAssistant ? 'text-violet-400' : 'text-zinc-600'
          )}>
            {isAssistant ? 'AI Copilot' : 'You'}
          </span>
          <span className="text-[9px] font-medium text-zinc-700">
            {message.created_at ? formatTime(message.created_at) : 'Just now'}
          </span>
          {isAssistant && message.metadata?.intent && (
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-[8px] font-bold bg-violet-500/8 border-violet-500/15 text-violet-500/70"
            >
              {message.metadata.intent}
            </Badge>
          )}
        </div>

        {/* Body */}
        <div className={cn(
          'text-[14px] leading-[1.75] tracking-tight antialiased',
          isAssistant ? 'text-zinc-300 font-medium' : 'text-zinc-400'
        )}>
          {isAssistant ? (
            <div className="prose prose-sm dark:prose-invert max-w-none
              prose-p:mt-0 prose-p:mb-3 prose-p:leading-[1.8] prose-p:text-zinc-400
              prose-headings:text-zinc-200 prose-headings:font-bold prose-headings:tracking-tight
              prose-code:text-violet-300 prose-code:bg-violet-500/8 prose-code:rounded-lg prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.82em] prose-code:font-bold prose-code:border prose-code:border-violet-500/15
              prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0
              prose-strong:text-zinc-200 prose-strong:font-bold
              prose-ul:text-zinc-400 prose-li:text-zinc-400
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
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>

        {/* Source chips + copy */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isAssistant && sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-800 mr-1">Sources</span>
              {sources.slice(0, 4).map((src: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 rounded-lg border border-white/6 bg-white/2 px-2 py-1 text-[9px] font-bold text-zinc-700 hover:border-violet-500/25 hover:bg-violet-500/5 hover:text-violet-400 transition-all cursor-pointer"
                >
                  <FileCode className="h-2.5 w-2.5" />
                  {src.path?.split('/').pop() || 'Ref'}
                </div>
              ))}
              {sources.length > 4 && (
                <span className="text-[9px] font-bold text-zinc-800">+{sources.length - 4} more</span>
              )}
            </div>
          )}
          <div className="ml-auto">
            <CopyButton text={message.content} />
          </div>
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
