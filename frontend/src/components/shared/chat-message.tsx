import * as React from "react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps): React.JSX.Element {
  const isUser = role === "user";

  return (
    <div className={cn("flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed shadow-sm transition-ui lg:max-w-[75%]",
          isUser
            ? "bg-primary text-primary-foreground shadow-md"
            : "border border-border bg-muted/30 text-foreground"
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </div>
  );
}
