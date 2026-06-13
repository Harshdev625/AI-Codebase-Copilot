import * as React from "react";
import { FileCode, FileJson, FileText, FileType, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

const EXT_ICONS: Record<string, React.ElementType> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  py: FileCode,
  go: FileCode,
  rs: FileCode,
  json: FileJson,
  md: FileText,
  mdx: FileText,
};

export function FileIcon({
  path,
  className,
  isDirectory,
}: {
  path: string;
  className?: string;
  isDirectory?: boolean;
}) {
  if (isDirectory) {
    return <Folder className={cn("h-3.5 w-3.5 text-[#58A6FF]", className)} />;
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const Icon = EXT_ICONS[ext] ?? FileType;
  return <Icon className={cn("h-3.5 w-3.5 text-[#8B949E]", className)} />;
}
