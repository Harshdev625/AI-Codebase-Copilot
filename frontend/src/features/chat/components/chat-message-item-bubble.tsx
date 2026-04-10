'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, UserRound, Copy, Check, FileCode, Database } from 'lucide-react';
import { ChatMessage } from '@/features/chat/types/chat-types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

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
      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-all"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function ChatMessageItemBubble({ message }: ChatMessageBubbleProps) {
  const isAssistant = message.role === 'assistant';
  const sources = message.metadata?.sources || [];

  return (
    <div className={cn(
      'relative flex gap-5 py-8 group transition-all duration-500 px-6 rounded-[32px] mx-4 my-2',
      isAssistant 
        ? 'bg-card border border-primary/20 shadow-premium animate-fade-in' 
        : 'bg-muted/30 border border-transparent hover:border-border/40 hover:bg-muted/40'
    )}>
      {/* Avatar column */}
      <div className="flex flex-col items-center gap-2 px-2 shrink-0">
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-[14px] border border-border/40 shadow-sm transition-all duration-300',
          isAssistant
            ? 'bg-gradient-to-br from-primary to-indigo-600 text-white shadow-primary/20 scale-100 group-hover:scale-110'
            : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
        )}>
          {isAssistant ? <Bot className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
        </div>
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 pr-4">
        {/* Header/Meta */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/80">
            {isAssistant ? 'Intelligence AI' : 'Agent Operator'}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground/30">
            {message.created_at ? formatDate(message.created_at) : 'Just now'}
          </span>
          {isAssistant && message.metadata?.intent && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[9px] font-bold bg-muted/30 border-border/20 text-muted-foreground/60 transition-all group-hover:text-primary group-hover:border-primary/20">
              {message.metadata.intent}
            </Badge>
          )}
        </div>

        {/* Message body */}
        <div className={cn(
          'text-[15px] leading-[1.7] tracking-tight antialiased',
          isAssistant ? 'text-foreground/90 font-medium' : 'text-foreground/70'
        )}>
          {isAssistant ? (
            <div className="prose prose-sm dark:prose-invert max-w-none 
              prose-p:mt-0 prose-p:mb-4 prose-p:leading-[1.8]
              prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tighter
              prose-code:text-primary prose-code:bg-primary/5 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-bold
              prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0
              prose-strong:text-foreground prose-strong:font-bold
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match;
                    if (isInline) {
                      return <code className={className} {...props}>{children}</code>;
                    }
                    return (
                      <CodeBlock
                        code={String(children).replace(/\n$/, '')}
                        language={match[1]}
                        className="my-6"
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

        {/* Action Tray */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Reference Chips */}
          {isAssistant && sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
               <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/20 mr-1">Sources</span>
               {sources.slice(0, 4).map((src: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/10 px-2 py-1 text-[10px] font-bold text-muted-foreground/50 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all cursor-pointer">
                    <FileCode className="h-2.5 w-2.5" />
                    {src.path?.split('/').pop() || 'Ref'}
                  </div>
               ))}
               {sources.length > 4 && (
                  <div className="text-[10px] font-bold text-muted-foreground/20">+{sources.length - 4} more</div>
               )}
            </div>
          )}
          
          <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={message.content} />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}
