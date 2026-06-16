"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { repositoryService } from "@/features/repositories/services/repository-service";

export interface MentionSuggestion {
  path: string;
  type: "FILE" | "DIRECTORY";
}

export interface MentionState {
  active: boolean;
  query: string;
  startIndex: number;
  selectedIndex: number;
}

const INITIAL_MENTION: MentionState = {
  active: false,
  query: "",
  startIndex: -1,
  selectedIndex: 0,
};

/** Detect @mention trigger at caret and manage autocomplete state. */
export function useComposerMentions(
  text: string,
  caretIndex: number,
  repositoryId?: string,
) {
  const [mention, setMention] = React.useState<MentionState>(INITIAL_MENTION);

  React.useEffect(() => {
    const before = text.slice(0, caretIndex);
    const atIndex = before.lastIndexOf("@");
    if (atIndex === -1) {
      setMention(INITIAL_MENTION);
      return;
    }
    const afterAt = before.slice(atIndex + 1);
    if (/\s/.test(afterAt)) {
      setMention(INITIAL_MENTION);
      return;
    }
    setMention((prev) => ({
      active: true,
      query: afterAt,
      startIndex: atIndex,
      selectedIndex: prev.active && prev.query === afterAt ? prev.selectedIndex : 0,
    }));
  }, [text, caretIndex]);

  const { data, isLoading } = useQuery({
    queryKey: ["repository-files-search", repositoryId, mention.query],
    queryFn: () =>
      repositoryService.searchFiles(repositoryId!, mention.query, 20),
    enabled: Boolean(repositoryId) && mention.active && mention.query.length >= 1,
    staleTime: 10_000,
  });

  const suggestions: MentionSuggestion[] = React.useMemo(() => {
    const items = data?.items ?? [];
    return items.map((item) => ({
      path: item.path,
      type: item.type as "FILE" | "DIRECTORY",
    }));
  }, [data?.items]);

  const clampedIndex = Math.min(
    mention.selectedIndex,
    Math.max(0, suggestions.length - 1),
  );

  const selectSuggestion = React.useCallback(
    (_suggestion: MentionSuggestion): { nextText: string; nextCaret: number } => {
      const before = text.slice(0, mention.startIndex);
      const after = text.slice(caretIndex);
      const nextText = (before + after).replace(/  +/g, " ").trimStart();
      const nextCaret = Math.min(before.length, nextText.length);
      setMention(INITIAL_MENTION);
      return { nextText, nextCaret };
    },
    [text, caretIndex, mention.startIndex],
  );

  const moveSelection = React.useCallback((delta: number) => {
    setMention((prev) => {
      if (!prev.active) return prev;
      const max = Math.max(0, suggestions.length - 1);
      const next = Math.max(0, Math.min(max, prev.selectedIndex + delta));
      return { ...prev, selectedIndex: next };
    });
  }, [suggestions.length]);

  const dismiss = React.useCallback(() => {
    setMention(INITIAL_MENTION);
  }, []);

  return {
    mention: { ...mention, selectedIndex: clampedIndex },
    suggestions,
    isLoading,
    selectSuggestion,
    moveSelection,
    dismiss,
  };
}
