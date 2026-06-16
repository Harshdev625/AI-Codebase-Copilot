"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Components } from "react-markdown";

import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";

import { MermaidDiagram } from "./mermaid-diagram";

const MARKDOWN_PROSE =
  "prose prose-sm max-w-none dark:prose-invert " +
  "prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-[#E6EDF3] " +
  "prose-h1:text-2xl prose-h1:mb-4 prose-h1:mt-2 " +
  "prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:border-[#2D313E] prose-h2:pb-2 " +
  "prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 " +
  "prose-p:text-[#C9D1D9] prose-p:leading-7 prose-p:my-3 " +
  "prose-a:text-[#58A6FF] prose-a:no-underline hover:prose-a:underline " +
  "prose-strong:text-[#E6EDF3] prose-strong:font-semibold " +
  "prose-ul:my-3 prose-ol:my-3 prose-li:text-[#C9D1D9] prose-li:my-1 " +
  "prose-blockquote:border-[#58A6FF] prose-blockquote:text-[#8B949E] prose-blockquote:italic " +
  "prose-hr:border-[#2D313E] prose-hr:my-8 " +
  "prose-table:my-4 prose-table:block prose-table:overflow-x-auto " +
  "prose-th:border prose-th:border-[#2D313E] prose-th:bg-[#161B22] prose-th:px-3 prose-th:py-2 prose-th:text-left " +
  "prose-td:border prose-td:border-[#2D313E] prose-td:px-3 prose-td:py-2 " +
  "prose-code:before:content-none prose-code:after:content-none " +
  "prose-code:text-[#E6EDF3] prose-code:bg-[#1C2128] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.9em] " +
  "prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-4";

const markdownComponents: Components = {
  pre: ({ children }) => <>{children}</>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? ""}
      loading="lazy"
      className="inline-block h-auto max-w-full"
    />
  ),
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className ?? "");
    const code = String(children).replace(/\n$/, "");
    if (match?.[1] === "mermaid") {
      return <MermaidDiagram code={code} />;
    }
    if (match) {
      return <CodeBlock language={match[1]} code={code} className="my-4" />;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export function MarkdownFileViewer({
  content,
  className,
}: {
  content: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "studio-markdown-preview custom-scrollbar h-full overflow-y-auto bg-[#0B0D14] px-8 py-6",
        MARKDOWN_PROSE,
        className,
      )}
      data-testid="markdown-file-viewer"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
