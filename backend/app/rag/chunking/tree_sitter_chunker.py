from pathlib import Path

from app.models.domain_models import CodeChunk


def chunk_with_tree_sitter(repo_id: str, commit_sha: str, file_path: Path, source: str) -> list[CodeChunk]:
    # Placeholder for multi-language parsing with tree-sitter.
    # Keep minimal starter and expand with grammar-specific queries.
    _ = (repo_id, commit_sha, file_path, source)
    return []
