from __future__ import annotations

import ast
import logging
import uuid
from pathlib import Path

from app.models.domain_models import CodeChunk


logger = logging.getLogger(__name__)


def chunk_python_file(repo_id: str, commit_sha: str, file_path: Path, source: str) -> list[CodeChunk]:
    logger.debug("chunk_python_ast - start repo_id=%s path=%s", repo_id, file_path)
    tree = ast.parse(source)
    chunks: list[CodeChunk] = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            start_line = getattr(node, "lineno", 1)
            end_line = getattr(node, "end_lineno", start_line)
            snippet = "\n".join(source.splitlines()[start_line - 1 : end_line])
            symbol = node.name
            chunk_type = "class" if isinstance(node, ast.ClassDef) else "function"
            # Use UUID5 for deterministic, Qdrant-compatible IDs
            raw_key = f"{repo_id}|{file_path}|{symbol}|{start_line}|{end_line}|{snippet}"
            chunk_id = str(uuid.uuid5(uuid.NAMESPACE_OID, raw_key))

            chunks.append(
                CodeChunk(
                    id=chunk_id,
                    repo_id=repo_id,
                    commit_sha=commit_sha,
                    path=str(file_path),
                    language="python",
                    symbol=symbol,
                    chunk_type=chunk_type,
                    start_line=start_line,
                    end_line=end_line,
                    content=snippet,
                )
            )

    logger.debug("chunk_python_ast - completed repo_id=%s path=%s chunks=%s", repo_id, file_path, len(chunks))
    return chunks
