'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, UserRound, Copy, Check, ChevronDown, FileCode } from 'lucide-react';
import { ChatMessage } from '@/features/chat/types/chat-types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';
import { PatchDiffViewer } from './patch-diff-viewer';
import type { Source } from '@/features/chat/types/chat-types';
import { getDisplayContent, normalizeRepoPath, normalizeSourcesFromMetadata } from '@/features/chat/utils/chat-message-utils';
import { formatChatTimestamp } from '@/features/chat/utils/chat-timestamp-utils';
import { formatTokenCount, getMessageUsage } from '@/features/chat/utils/token-usage-utils';
import { FileIcon } from '@/features/studio/components/file-icon';
import { useStudioStore } from '@/features/studio/store/studio-store';
import { LiveThinkingStrip } from './live-thinking-strip';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  mode?: string;
  repositoryId?: string;
}

const USER_BUBBLE =
  'border-[#818cf8]/35 bg-[#1e1b4b]/55 text-[#e8eaf6] shadow-[inset_0_1px_0_0_rgba(129,140,248,0.08)]';
const USER_AVATAR = 'border-[#818cf8]/40 bg-[#818cf8]/15 text-[#a5b4fc]';
const ASSISTANT_BUBBLE =
  'border-[#5CD4C2]/35 bg-[#0f2a28]/80 text-[#e6fffa] shadow-[inset_0_1px_0_0_rgba(92,212,194,0.1)]';
const ASSISTANT_AVATAR = 'border-[#5CD4C2]/40 bg-[#5CD4C2]/15 text-[#5CD4C2]';

const PROSE_CLASSES = cn(
  'prose prose-sm dark:prose-invert max-w-full min-w-0',
  'prose-p:my-1 prose-p:leading-relaxed prose-p:break-words',
  'prose-headings:break-words prose-li:break-words',
  'prose-code:break-words prose-code:text-[#5CD4C2] prose-code:bg-[#5CD4C2]/10',
  'prose-code:rounded prose-code:px-1 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none',
  'prose-pre:max-w-full prose-pre:overflow-x-auto',
  'prose-table:block prose-table:max-w-full prose-table:overflow-x-auto',
  '[&_*]:max-w-full',
);

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[9px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-all"
    >
      {copied ? <Check className="h-3 w-3 text-[#5CD4C2]" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function SourceExplorerV2({ sources }: { sources: Source[] }) {
  const { openFileInEditor } = useStudioStore();
  const [open, setOpen] = React.useState(false);

  if (sources.length === 0) return null;

  return (
    <details
      className="mt-3 min-w-0 group"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#5CD4C2]/80 hover:text-[#5CD4C2]">
        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
        <FileCode className="h-3 w-3" />
        Retrieved Context ({sources.length})
      </summary>
      <div className="mt-2 grid min-w-0 grid-cols-1 gap-1.5">
        {sources.map((src, idx) => {
          const score = typeof src.rerank_score === 'number' ? src.rerank_score : (typeof src.score === 'number' ? src.score : null);
          const scoreDisplay = score !== null ? (score * 100).toFixed(0) : '—';
          const displayPath = normalizeRepoPath(src.path);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => openFileInEditor(src.path, src.start_line)}
              className="min-w-0 text-left rounded-lg border border-[#5CD4C2]/20 bg-black/20 px-2.5 py-2 hover:bg-[#5CD4C2]/10 transition-colors"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <FileIcon path={src.path} className="h-3 w-3 shrink-0" />
                  <span className="truncate text-[11px] font-semibold" title={src.path}>{displayPath}</span>
                </span>
                <Badge variant="outline" className="shrink-0 border-[#5CD4C2]/30 text-[8px] px-1 py-0 h-3.5" title="Relevance score">{scoreDisplay}</Badge>
              </div>
            </button>
          );
        })}
      </div>
    </details>
  );
}

export function ChatMessageItemBubble({ message, repositoryId: repositoryIdProp }: ChatMessageBubbleProps) {
  const { selectedRepositoryId } = useStudioStore();
  const isAssistant = message.role === 'assistant';
  const metadata = message.metadata ?? {};
  const intent = typeof metadata.intent === 'string' ? metadata.intent : '';
  const sources = normalizeSourcesFromMetadata(metadata);
  const displayContent = getDisplayContent(message.content, message.role, metadata);

  const patchProposal = sources.find((src) => src.kind === 'patch_proposal');
  const normalSources = sources.filter((src) => src.kind !== 'patch_proposal');
  const usage = isAssistant ? getMessageUsage(metadata) : null;

  const repositoryId = repositoryIdProp || selectedRepositoryId || '';
  const timestamp = message.created_at ? formatChatTimestamp(message.created_at) : 'Just now';
  const isStreaming = Boolean(metadata.isStreaming);

  const sortedSources = React.useMemo(() => {
    return [...normalSources].sort((a, b) => {
      const scoreA =
        typeof a.rerank_score === 'number' ? a.rerank_score : typeof a.score === 'number' ? a.score : 0;
      const scoreB =
        typeof b.rerank_score === 'number' ? b.rerank_score : typeof b.score === 'number' ? b.score : 0;
      return scoreB - scoreA;
    });
  }, [normalSources]);

  return (
    <div className="group w-full min-w-0 box-border px-3 py-2">
      <div
        className={cn(
          'flex w-full min-w-0 items-end gap-2',
          isAssistant ? 'justify-end' : 'justify-start',
        )}
      >
        {!isAssistant && (
          <div
            className={cn(
              'mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
              USER_AVATAR,
            )}
          >
            <UserRound className="h-3.5 w-3.5" />
          </div>
        )}

        <div
          className={cn(
            'min-w-0 max-w-[min(88%,48rem)] overflow-hidden rounded-2xl border px-4 py-3',
            isAssistant ? cn(ASSISTANT_BUBBLE, 'rounded-br-md') : cn(USER_BUBBLE, 'rounded-bl-md'),
          )}
        >
          <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[12px] font-semibold">
              {isAssistant ? 'AI Assistant' : 'You'}
            </span>
            <span className="text-[10px] opacity-60">{timestamp}</span>
            {isAssistant && intent && (
              <Badge className="border-[#5CD4C2]/30 bg-[#5CD4C2]/15 px-1.5 py-0 text-[8px] font-bold text-[#5CD4C2]">
                {intent}
              </Badge>
            )}
            {usage?.total_tokens != null && usage.total_tokens > 0 && (
              <Badge variant="outline" className="border-white/15 px-1.5 py-0 text-[8px] font-mono opacity-70">
                {formatTokenCount(usage.total_tokens)} tok
              </Badge>
            )}
          </div>

          {isAssistant && isStreaming && (
            <LiveThinkingStrip metadata={metadata} sources={sortedSources as Source[]} />
          )}

          <div className="min-w-0 overflow-x-hidden text-[14px] leading-relaxed">
            {isAssistant ? (
              <div className={PROSE_CLASSES}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      if (!match) {
                        return <code className={className} {...props}>{children}</code>;
                      }
                      return (
                        <div className="my-3 min-w-0 max-w-full overflow-x-auto">
                          <CodeBlock
                            code={String(children).replace(/\n$/, '')}
                            language={match[1]}
                          />
                        </div>
                      );
                    },
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
                {patchProposal?.proposal && repositoryId && (
                  <div className="min-w-0 max-w-full overflow-x-auto">
                    <PatchDiffViewer
                      repositoryId={repositoryId}
                      diff={patchProposal.proposal.diff}
                      summary={patchProposal.proposal.summary}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{displayContent}</div>
            )}
          </div>

          {!isAssistant && Array.isArray(metadata.scope_paths) && metadata.scope_paths.length > 0 && (
            <div className="mt-2 flex min-w-0 flex-wrap gap-1">
              {metadata.scope_paths.map((path: string, idx: number) => (
                <span
                  key={idx}
                  className="inline-flex max-w-full items-center gap-1 rounded border border-[#818cf8]/30 bg-[#818cf8]/10 px-1.5 py-0.5 text-[10px] font-mono truncate"
                  title={path}
                >
                  <FileIcon path={path} className="h-3 w-3 shrink-0" />
                  <span className="truncate">{path.split('/').pop()}</span>
                </span>
              ))}
            </div>
          )}

          {isAssistant && !isStreaming && sortedSources.length > 0 && (
            <SourceExplorerV2 sources={sortedSources as Source[]} />
          )}

          <div className="mt-2 flex justify-end">
            <CopyButton text={displayContent} />
          </div>
        </div>

        {isAssistant && (
          <div
            className={cn(
              'mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
              ASSISTANT_AVATAR,
            )}
          >
            <Bot className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
