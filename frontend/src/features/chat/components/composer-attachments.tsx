"use client";

import * as React from "react";
import { X } from "lucide-react";

import { FileIcon } from "@/features/studio/components/file-icon";
import { cn } from "@/lib/utils";
import { isLikelyFilePath } from "@/features/chat/utils/composer-mention-utils";

interface ComposerAttachmentsProps {
  scopePaths: string[];
  attachedFiles: string[];
  onRemoveScope: (path: string) => void;
  onRemoveAttached: (path: string) => void;
  className?: string;
}

function fileLabel(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/** Horizontal attachment strip — referenced files/folders live outside the textarea. */
export function ComposerAttachments({
  scopePaths,
  attachedFiles,
  onRemoveScope,
  onRemoveAttached,
  className,
}: ComposerAttachmentsProps): React.JSX.Element | null {
  const folderOnly = scopePaths.filter(
    (p) => !attachedFiles.includes(p) && !isLikelyFilePath(p),
  );
  const scopedFiles = scopePaths.filter(
    (p) => isLikelyFilePath(p) && !attachedFiles.includes(p),
  );

  const items = [
    ...attachedFiles.map((path) => ({ path, kind: "file" as const })),
    ...scopedFiles.map((path) => ({ path, kind: "file" as const })),
    ...folderOnly.map((path) => ({ path, kind: "folder" as const })),
  ];

  if (items.length === 0) return null;

  const handleRemove = (path: string, kind: "file" | "folder") => {
    if (kind === "file") {
      if (attachedFiles.includes(path)) onRemoveAttached(path);
      if (scopePaths.includes(path)) onRemoveScope(path);
    } else {
      onRemoveScope(path);
    }
  };

  return (
    <div
      className={cn(
        "mx-1 flex items-center gap-1.5 border-b border-[#2D313E]/60 px-1 pb-2 pt-0.5",
        className,
      )}
    >
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#6E7681]">
        Context
      </span>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto custom-scrollbar">
        {items.map(({ path, kind }) => (
          <span
            key={`${kind}-${path}`}
            className="inline-flex max-w-[160px] shrink-0 items-center gap-1 rounded-md border border-[#2D313E] bg-[#1A1C23] py-0.5 pl-1.5 pr-0.5 text-[10px] text-[#C9D1D9]"
            title={path}
          >
            <FileIcon path={path} isDirectory={kind === "folder"} className="h-3 w-3 shrink-0" />
            <span className="truncate font-mono">{fileLabel(path)}</span>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-[#8B949E] hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Remove ${path}`}
              onClick={() => handleRemove(path, kind)}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
