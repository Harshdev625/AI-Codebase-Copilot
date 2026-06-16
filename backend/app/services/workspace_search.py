"""VS Code-style workspace text search (ripgrep with Python fallback)."""

from __future__ import annotations

import fnmatch
import json
import logging
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

DEFAULT_EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "__pycache__",
    ".venv",
    "venv",
    "coverage",
    ".turbo",
    ".cache",
    "vendor",
}

DEFAULT_EXCLUDE_GLOBS = [
    "**/node_modules/**",
    "**/.git/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/__pycache__/**",
    "**/.venv/**",
    "**/venv/**",
    "**/*.min.js",
    "**/*.min.css",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
]

TEXT_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".py", ".pyw", ".go", ".rs", ".java", ".kt", ".kts",
    ".c", ".h", ".cpp", ".hpp", ".cc", ".cs",
    ".rb", ".php", ".swift", ".vue", ".svelte",
    ".html", ".htm", ".css", ".scss", ".sass", ".less",
    ".json", ".jsonc", ".yaml", ".yml", ".toml",
    ".md", ".mdx", ".txt", ".xml", ".sql",
    ".sh", ".bash", ".zsh", ".ps1", ".bat", ".cmd",
    ".env", ".gitignore", ".dockerfile", ".gradle",
    ".tf", ".proto", ".r", ".lua", ".vim",
}


@dataclass
class SearchMatch:
    line: int
    column: int
    preview: str

    def to_dict(self) -> dict:
        return {"line": self.line, "column": self.column, "preview": self.preview}


@dataclass
class SearchFileResult:
    path: str
    matches: list[SearchMatch] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "matches": [m.to_dict() for m in self.matches],
        }


@dataclass
class WorkspaceSearchResult:
    files: list[SearchFileResult]
    total_matches: int
    total_files: int
    truncated: bool
    engine: str

    def to_dict(self) -> dict:
        return {
            "files": [f.to_dict() for f in self.files],
            "total_matches": self.total_matches,
            "total_files": self.total_files,
            "truncated": self.truncated,
            "engine": self.engine,
        }


def _normalize_posix(path: str) -> str:
    return path.replace("\\", "/")


def _glob_match(path: str, pattern: str) -> bool:
    p = _normalize_posix(path)
    pat = _normalize_posix(pattern)
    if pat.startswith("**/"):
        return fnmatch.fnmatch(p, pat[3:]) or fnmatch.fnmatch(p, pat)
    return fnmatch.fnmatch(p, pat)


def _path_allowed(
    rel_path: str,
    include_globs: list[str] | None,
    exclude_globs: list[str],
) -> bool:
    if include_globs:
        if not any(_glob_match(rel_path, g) for g in include_globs):
            return False
    return not any(_glob_match(rel_path, g) for g in exclude_globs)


def _is_probably_text(path: Path) -> bool:
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return True
    name = path.name.lower()
    if name in {"dockerfile", "makefile", "license", "readme"}:
        return True
    if name.startswith(".env"):
        return True
    return path.suffix == "" and path.stat().st_size < 512_000


def _build_pattern(query: str, *, case_sensitive: bool, whole_word: bool, use_regex: bool) -> re.Pattern:
    if use_regex:
        flags = 0 if case_sensitive else re.IGNORECASE
        return re.compile(query, flags)
    escaped = re.escape(query)
    if whole_word:
        escaped = rf"\b{escaped}\b"
    flags = 0 if case_sensitive else re.IGNORECASE
    return re.compile(escaped, flags)


def _find_column(line: str, match: re.Match) -> int:
    return match.start() + 1


def _trim_preview(line: str, max_len: int = 200) -> str:
    stripped = line.rstrip("\n\r")
    if len(stripped) <= max_len:
        return stripped
    return stripped[: max_len - 1] + "…"


def search_workspace_python(
    root: Path,
    query: str,
    *,
    case_sensitive: bool = False,
    whole_word: bool = False,
    use_regex: bool = False,
    include_globs: list[str] | None = None,
    exclude_globs: list[str] | None = None,
    max_results: int = 500,
    max_matches_per_file: int = 50,
) -> WorkspaceSearchResult:
    if not query.strip():
        return WorkspaceSearchResult([], 0, 0, False, "python")

    excludes = list(DEFAULT_EXCLUDE_GLOBS)
    if exclude_globs:
        excludes.extend(exclude_globs)

    pattern = _build_pattern(query, case_sensitive=case_sensitive, whole_word=whole_word, use_regex=use_regex)
    root = root.resolve()

    files: list[SearchFileResult] = []
    total_matches = 0
    truncated = False

    for file_path in root.rglob("*"):
        if not file_path.is_file():
            continue
        rel = _normalize_posix(str(file_path.relative_to(root)))
        parts = rel.split("/")
        if any(part in DEFAULT_EXCLUDE_DIRS for part in parts):
            continue
        if not _path_allowed(rel, include_globs, excludes):
            continue
        if not _is_probably_text(file_path):
            continue
        try:
            if file_path.stat().st_size > 2_000_000:
                continue
            text = file_path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        file_matches: list[SearchMatch] = []
        for line_no, line in enumerate(text.splitlines(), start=1):
            for m in pattern.finditer(line):
                file_matches.append(
                    SearchMatch(
                        line=line_no,
                        column=_find_column(line, m),
                        preview=_trim_preview(line),
                    )
                )
                if len(file_matches) >= max_matches_per_file:
                    break
            if len(file_matches) >= max_matches_per_file:
                break

        if file_matches:
            files.append(SearchFileResult(path=rel, matches=file_matches))
            total_matches += len(file_matches)
            if total_matches >= max_results:
                truncated = True
                break

    files.sort(key=lambda f: f.path.lower())
    return WorkspaceSearchResult(
        files=files,
        total_matches=total_matches,
        total_files=len(files),
        truncated=truncated,
        engine="python",
    )


def search_workspace_ripgrep(
    root: Path,
    query: str,
    *,
    case_sensitive: bool = False,
    whole_word: bool = False,
    use_regex: bool = False,
    include_globs: list[str] | None = None,
    exclude_globs: list[str] | None = None,
    max_results: int = 500,
    max_matches_per_file: int = 50,
) -> WorkspaceSearchResult | None:
    if shutil.which("rg") is None:
        return None
    if not query.strip():
        return WorkspaceSearchResult([], 0, 0, False, "ripgrep")

    cmd: list[str] = [
        "rg",
        "--json",
        "--line-number",
        "--column",
        "--no-heading",
        "--max-count",
        str(max_matches_per_file),
        "--max-filesize",
        "2M",
    ]
    if not case_sensitive:
        cmd.append("-i")
    if whole_word:
        cmd.append("-w")
    if use_regex:
        cmd.extend(["-e", query])
    else:
        cmd.extend(["-F", query])

    for g in DEFAULT_EXCLUDE_GLOBS:
        cmd.extend(["--glob", f"!{g}"])
    if exclude_globs:
        for g in exclude_globs:
            cmd.extend(["--glob", f"!{g.lstrip('!')}"])
    if include_globs:
        for g in include_globs:
            cmd.extend(["--glob", g])

    cmd.append(str(root))

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        logger.warning("workspace_search_ripgrep - failed error=%s", exc)
        return None

    if proc.returncode not in (0, 1):
        logger.warning(
            "workspace_search_ripgrep - exit code=%s stderr=%s",
            proc.returncode,
            (proc.stderr or "")[:200],
        )
        return None

    by_path: dict[str, list[SearchMatch]] = {}
    total_matches = 0
    truncated = False

    for raw_line in proc.stdout.splitlines():
        if total_matches >= max_results:
            truncated = True
            break
        try:
            event = json.loads(raw_line)
        except json.JSONDecodeError:
            continue
        if event.get("type") != "match":
            continue
        data = event.get("data", {})
        rel_path = _normalize_posix(str(data.get("path", {}).get("text", "")))
        if not rel_path:
            continue
        # rg returns absolute or relative depending on platform; normalize to relative
        try:
            rel_path = _normalize_posix(str(Path(rel_path).resolve().relative_to(root.resolve())))
        except ValueError:
            rel_path = _normalize_posix(rel_path)

        line_no = int(data.get("line_number", 1))
        submatches = data.get("submatches") or []
        column = int(submatches[0].get("start", 0)) + 1 if submatches else 1
        preview = ""
        lines = data.get("lines") or {}
        if isinstance(lines, dict):
            preview = _trim_preview(str(lines.get("text", "")))

        if rel_path not in by_path:
            by_path[rel_path] = []
        by_path[rel_path].append(SearchMatch(line=line_no, column=column, preview=preview))
        total_matches += 1

    files = [SearchFileResult(path=p, matches=ms) for p, ms in sorted(by_path.items(), key=lambda x: x[0].lower())]
    return WorkspaceSearchResult(
        files=files,
        total_matches=total_matches,
        total_files=len(files),
        truncated=truncated,
        engine="ripgrep",
    )


def search_workspace(
    root: Path,
    query: str,
    *,
    case_sensitive: bool = False,
    whole_word: bool = False,
    use_regex: bool = False,
    include_globs: list[str] | None = None,
    exclude_globs: list[str] | None = None,
    max_results: int = 500,
    max_matches_per_file: int = 50,
) -> WorkspaceSearchResult:
    rg_result = search_workspace_ripgrep(
        root,
        query,
        case_sensitive=case_sensitive,
        whole_word=whole_word,
        use_regex=use_regex,
        include_globs=include_globs,
        exclude_globs=exclude_globs,
        max_results=max_results,
        max_matches_per_file=max_matches_per_file,
    )
    if rg_result is not None:
        return rg_result
    return search_workspace_python(
        root,
        query,
        case_sensitive=case_sensitive,
        whole_word=whole_word,
        use_regex=use_regex,
        include_globs=include_globs,
        exclude_globs=exclude_globs,
        max_results=max_results,
        max_matches_per_file=max_matches_per_file,
    )
