'use client';

import * as React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  filename?: string;
  className?: string;
}

export function CodeBlock({
  code,
  language = 'text',
  showLineNumbers = false,
  filename,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('group relative rounded-xl overflow-hidden border border-border/40', className)}>
      {/* Header */}
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          </div>
          {filename && (
            <span className="ml-2 text-[10px] font-mono text-zinc-400">{filename}</span>
          )}
          {!filename && language !== 'text' && (
            <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {language}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold text-zinc-400 transition-all hover:bg-white/5 hover:text-white"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers={showLineNumbers}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: '#18181b',
          fontSize: '0.8125rem',
          lineHeight: '1.6',
          padding: '1rem 1.25rem',
        }}
        lineNumberStyle={{
          color: '#52525b',
          minWidth: '2.5em',
          paddingRight: '1em',
          userSelect: 'none',
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
