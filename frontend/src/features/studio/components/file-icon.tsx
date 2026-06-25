import * as React from "react";
import {
  Braces,
  Database,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileJson2,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  GitBranch,
  Settings2,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

type IconSpec = {
  icon: React.ElementType;
  color: string;
};

const EXT_SPECS: Record<string, IconSpec> = {
  ts: { icon: FileCode2, color: "#3178c6" },
  tsx: { icon: FileCode2, color: "#3178c6" },
  mts: { icon: FileCode2, color: "#3178c6" },
  cts: { icon: FileCode2, color: "#3178c6" },
  js: { icon: FileCode2, color: "#f1e05a" },
  jsx: { icon: FileCode2, color: "#f1e05a" },
  mjs: { icon: FileCode2, color: "#f1e05a" },
  cjs: { icon: FileCode2, color: "#f1e05a" },
  py: { icon: FileCode2, color: "#3572a5" },
  pyw: { icon: FileCode2, color: "#3572a5" },
  go: { icon: FileCode2, color: "#00add8" },
  rs: { icon: FileCode2, color: "#dea584" },
  java: { icon: FileCode2, color: "#b07219" },
  kt: { icon: FileCode2, color: "#a97bff" },
  kts: { icon: FileCode2, color: "#a97bff" },
  cs: { icon: FileCode2, color: "#178600" },
  cpp: { icon: FileCode2, color: "#f34b7d" },
  cc: { icon: FileCode2, color: "#f34b7d" },
  c: { icon: FileCode2, color: "#555555" },
  h: { icon: FileCode2, color: "#555555" },
  hpp: { icon: FileCode2, color: "#555555" },
  rb: { icon: FileCode2, color: "#701516" },
  php: { icon: FileCode2, color: "#4f5d95" },
  swift: { icon: FileCode2, color: "#f05138" },
  vue: { icon: FileCode2, color: "#41b883" },
  svelte: { icon: FileCode2, color: "#ff3e00" },
  html: { icon: FileCode2, color: "#e34c26" },
  htm: { icon: FileCode2, color: "#e34c26" },
  css: { icon: FileCode2, color: "#563d7c" },
  scss: { icon: FileCode2, color: "#c6538c" },
  sass: { icon: FileCode2, color: "#c6538c" },
  less: { icon: FileCode2, color: "#1d365d" },
  json: { icon: FileJson2, color: "#cbcb41" },
  jsonc: { icon: FileJson2, color: "#cbcb41" },
  yaml: { icon: FileText, color: "#cb171e" },
  yml: { icon: FileText, color: "#cb171e" },
  toml: { icon: FileText, color: "#9c4221" },
  md: { icon: FileText, color: "#519aba" },
  mdx: { icon: FileText, color: "#519aba" },
  txt: { icon: FileText, color: "#8b949e" },
  sql: { icon: Database, color: "#e38c00" },
  sqlite: { icon: Database, color: "#e38c00" },
  sh: { icon: Terminal, color: "#89e051" },
  bash: { icon: Terminal, color: "#89e051" },
  zsh: { icon: Terminal, color: "#89e051" },
  ps1: { icon: Terminal, color: "#012456" },
  bat: { icon: Terminal, color: "#c1f12e" },
  cmd: { icon: Terminal, color: "#c1f12e" },
  xml: { icon: Braces, color: "#e37933" },
  svg: { icon: FileImage, color: "#a074c4" },
  png: { icon: FileImage, color: "#a074c4" },
  jpg: { icon: FileImage, color: "#a074c4" },
  jpeg: { icon: FileImage, color: "#a074c4" },
  gif: { icon: FileImage, color: "#a074c4" },
  webp: { icon: FileImage, color: "#a074c4" },
  ico: { icon: FileImage, color: "#a074c4" },
  zip: { icon: FileArchive, color: "#ecba5f" },
  tar: { icon: FileArchive, color: "#ecba5f" },
  gz: { icon: FileArchive, color: "#ecba5f" },
  lock: { icon: FileJson2, color: "#8b949e" },
};

const BASENAME_SPECS: Record<string, IconSpec> = {
  dockerfile: { icon: FileCode2, color: "#384d54" },
  makefile: { icon: Terminal, color: "#6d8086" },
  "readme.md": { icon: FileText, color: "#519aba" },
  "changelog.md": { icon: FileText, color: "#519aba" },
  license: { icon: FileText, color: "#d4aa00" },
  LICENSE: { icon: FileText, color: "#d4aa00" },
  ".gitignore": { icon: GitBranch, color: "#f05032" },
  ".gitattributes": { icon: GitBranch, color: "#f05032" },
  ".env": { icon: Settings2, color: "#ecd53f" },
  ".env.example": { icon: Settings2, color: "#ecd53f" },
  "package.json": { icon: FileJson2, color: "#cb3837" },
  "package-lock.json": { icon: FileJson2, color: "#cb3837" },
  "tsconfig.json": { icon: FileJson2, color: "#3178c6" },
  "jest.config.js": { icon: FileJson2, color: "#99425b" },
  "docker-compose.yml": { icon: FileCode2, color: "#384d54" },
  "docker-compose.yaml": { icon: FileCode2, color: "#384d54" },
};

function resolveFileSpec(path: string): IconSpec {
  const basename = (path.split("/").pop() ?? path).toLowerCase();
  if (BASENAME_SPECS[basename]) return BASENAME_SPECS[basename];
  if (basename.startsWith(".env")) return BASENAME_SPECS[".env"];

  const ext = basename.includes(".") ? basename.split(".").pop() ?? "" : "";
  if (ext && EXT_SPECS[ext]) return EXT_SPECS[ext];

  return { icon: File, color: "#8b949e" };
}

export function FileIcon({
  path,
  className,
  isDirectory,
  isOpen,
}: {
  path: string;
  className?: string;
  isDirectory?: boolean;
  isOpen?: boolean;
}) {
  if (isDirectory) {
    const FolderIcon = isOpen ? FolderOpen : Folder;
    return (
      <FolderIcon
        className={cn(
          "h-4 w-4 shrink-0",
          isOpen ? "fill-[#58A6FF]/20 text-[#58A6FF]" : "text-[#8B949E]",
          className,
        )}
      />
    );
  }

  const { icon: Icon, color } = resolveFileSpec(path);
  return <Icon className={cn("h-4 w-4 shrink-0", className)} style={{ color }} />;
}

export function getFileIconLabel(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ext || "file";
}
