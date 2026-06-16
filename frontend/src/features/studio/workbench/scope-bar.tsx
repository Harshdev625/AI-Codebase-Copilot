"use client";

import * as React from "react";
import { FolderTree, X } from "lucide-react";

import { useSessionScope } from "@/features/chat/hooks/use-session-scope";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { useStudioWorkbenchSessionOptional } from "@/features/studio/context/studio-workbench-context";

/** Always-visible scope summary when AI dock is closed. */
export function ScopeBar(): React.JSX.Element {
  const workbench = useStudioWorkbenchSessionOptional();
  const storeSessionId = useStudioStore((s) => s.activeSessionId);
  const sessionId = workbench?.activeSessionId ?? storeSessionId;
  const { scopePaths, toggleScopePath } = useSessionScope(sessionId);

  if (scopePaths.length === 0) {
    return (
      <div className="shrink-0 border-t border-[#1E212B] px-3 py-2 text-[11px] text-[#8B949E]">
        <span className="flex items-center gap-1.5">
          <FolderTree className="h-3 w-3" />
          No scope paths — add from Explorer
        </span>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-[#1E212B] px-3 py-2" data-testid="scope-bar">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8B949E]">
        <FolderTree className="h-3 w-3" />
        Scope ({scopePaths.length})
      </div>
      <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto custom-scrollbar">
        {scopePaths.map((path) => (
          <span
            key={path}
            className="inline-flex max-w-full items-center gap-0.5 truncate rounded border border-[#2D313E] bg-[#1A1C23] px-1.5 py-0.5 font-mono text-[10px] text-[#C9D1D9]"
            title={path}
          >
            <span className="truncate">{path}</span>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-[#8B949E] hover:text-destructive hover:bg-destructive/10"
              aria-label={`Remove ${path} from scope`}
              onClick={() => toggleScopePath(path)}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
