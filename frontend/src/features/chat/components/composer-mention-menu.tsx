"use client";

import * as React from "react";
import { File, Folder, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MentionSuggestion } from "@/features/chat/hooks/use-composer-mentions";

interface ComposerMentionMenuProps {
  open: boolean;
  suggestions: MentionSuggestion[];
  selectedIndex: number;
  isLoading?: boolean;
  onSelect: (suggestion: MentionSuggestion) => void;
  className?: string;
}

export function ComposerMentionMenu({
  open,
  suggestions,
  selectedIndex,
  isLoading,
  onSelect,
  className,
}: ComposerMentionMenuProps): React.JSX.Element | null {
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(
      `[data-mention-index="${selectedIndex}"]`,
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex]);

  if (!open) return null;

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute bottom-full left-0 z-50 mb-1 max-h-[220px] w-full min-w-[240px] overflow-y-auto rounded-lg border border-[#2D313E] bg-[#161B22] py-1 shadow-xl custom-scrollbar",
        className,
      )}
      role="listbox"
      aria-label="File and folder suggestions"
    >
      {isLoading && suggestions.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#8B949E]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Searching…
        </div>
      ) : suggestions.length === 0 ? (
        <p className="px-3 py-2 text-xs text-[#8B949E]">Type a file or folder name…</p>
      ) : (
        suggestions.map((item, index) => {
          const isDir = item.type === "DIRECTORY";
          const Icon = isDir ? Folder : File;
          return (
            <button
              key={`${item.type}-${item.path}`}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              data-mention-index={index}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-mono transition-colors",
                index === selectedIndex
                  ? "bg-[#1F6FEB]/20 text-[#E2E8F0]"
                  : "text-[#C9D1D9] hover:bg-[#1F242D]",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-[#8B949E]" />
              <span className="truncate">{item.path}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
