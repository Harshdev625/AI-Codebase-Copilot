from __future__ import annotations

import ast
from hashlib import sha256
from pathlib import Path

from app.models.domain_models import CodeChunk


def chunk_python_file(repo_id: str, commit_sha: str, file_path: Path, source: str) -> list[CodeChunk]:
    tree = ast.parse(source)
    chunks: list[CodeChunk] = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            start_line = getattr(node, "lineno", 1)
            end_line = getattr(node, "end_lineno", start_line)
            snippet = "\n".join(source.splitlines()[start_line - 1 : end_line])
            symbol = node.name
            chunk_type = "class" if isinstance(node, ast.ClassDef) else "function"
            chunk_id = sha256(
                f"{repo_id}|{file_path}|{symbol}|{start_line}|{end_line}|{snippet}".encode("utf-8")
            ).hexdigest()

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

    return chunks
