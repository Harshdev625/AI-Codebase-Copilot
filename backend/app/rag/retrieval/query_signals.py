from __future__ import annotations

import re
from dataclasses import dataclass


TECH_KEYWORD_EXTENSIONS: dict[str, tuple[str, ...]] = {
    "css": (".css", ".scss", ".sass", ".less"),
    "scss": (".scss", ".sass"),
    "sass": (".scss", ".sass"),
    "stylesheet": (".css", ".scss", ".sass", ".less"),
    "styles": (".css", ".scss", ".sass", ".less"),
    "tailwind": (".css", ".tsx", ".jsx", ".html"),
    "component": (".tsx", ".jsx", ".vue", ".svelte"),
    "hook": (".ts", ".tsx", ".js", ".jsx"),
    "typescript": (".ts", ".tsx"),
    "javascript": (".js", ".jsx", ".mjs", ".cjs"),
    "python": (".py", ".pyi"),
    "markdown": (".md", ".mdx"),
    "readme": (".md", ".mdx"),
    "json": (".json", ".jsonc"),
    "html": (".html", ".htm", ".tsx", ".jsx"),
}

DOC_EXTENSIONS = (".md", ".mdx", ".txt", ".rst")
DOC_PATH_MARKERS = ("readme", "docs/", "doc/", "documentation", "changelog")


@dataclass(frozen=True)
class QuerySignals:
    preferred_extensions: tuple[str, ...]
    preferred_languages: tuple[str, ...]
    is_tech_specific: bool
    is_docs_query: bool


def _path_extension(path: str) -> str:
    lower = path.lower().replace("\\", "/")
    dot = lower.rfind(".")
    if dot <= 0:
        return ""
    return lower[dot:]


def infer_query_signals(query: str, *, intent: str | None = None) -> QuerySignals:
    q = " ".join(query.lower().split())
    extensions: set[str] = set()
    languages: set[str] = set()

    for keyword, exts in TECH_KEYWORD_EXTENSIONS.items():
        if re.search(rf"\b{re.escape(keyword)}\b", q):
            extensions.update(exts)
            if keyword in {"css", "scss", "sass", "stylesheet", "styles"}:
                languages.add("css")
            elif keyword in {"typescript", "hook"}:
                languages.add("typescript")
            elif keyword == "javascript":
                languages.add("javascript")
            elif keyword == "python":
                languages.add("python")
            elif keyword == "markdown":
                languages.add("markdown")
            elif keyword == "html":
                languages.add("html")

    is_tech_specific = bool(extensions)
    is_docs_query = intent == "docs" or any(
        token in q for token in ("documentation", "readme", "explain the project", "about the project")
    )
    if is_docs_query and not is_tech_specific:
        extensions.update(DOC_EXTENSIONS)

    return QuerySignals(
        preferred_extensions=tuple(sorted(extensions)),
        preferred_languages=tuple(sorted(languages)),
        is_tech_specific=is_tech_specific,
        is_docs_query=is_docs_query,
    )


def extension_matches_path(path: str, extensions: tuple[str, ...]) -> bool:
    if not extensions:
        return False
    ext = _path_extension(path)
    return ext in extensions


def looks_like_docs_path(path: str) -> bool:
    lower = str(path or "").lower().replace("\\", "/")
    if any(lower.endswith(ext) for ext in DOC_EXTENSIONS):
        return True
    return any(marker in lower for marker in DOC_PATH_MARKERS)


def tech_boost_for_item(
    *,
    path: str,
    language: str | None,
    signals: QuerySignals,
) -> float:
    if not signals.is_tech_specific:
        return 0.0
    boost = 0.0
    lang = str(language or "").lower()
    if signals.preferred_extensions and extension_matches_path(path, signals.preferred_extensions):
        boost += 0.12
    elif signals.preferred_languages and lang in signals.preferred_languages:
        boost += 0.08
    if looks_like_docs_path(path) and signals.is_tech_specific and not signals.is_docs_query:
        boost -= 0.08
    return boost
