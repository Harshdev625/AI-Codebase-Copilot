"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";

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
        "custom-scrollbar h-full overflow-y-auto px-6 py-4 text-sm leading-relaxed text-foreground",
        className,
      )}
      data-testid="markdown-file-viewer"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className: codeClassName, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName ?? "");
            const code = String(children).replace(/\n$/, "");
            if (match) {
              return <CodeBlock language={match[1]} code={code} />;
            }
            return (
              <code className={codeClassName} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
