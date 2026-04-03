from __future__ import annotations

from collections import defaultdict
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.rag.embeddings.provider import get_embedding_provider, validate_embedding_dimension
from app.rag.retrieval.code_graph import graph_expand_context
from app.services.qdrant_service import QdrantService


NOISY_PATH_TOKENS = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "pipfile.lock",
    "dist/",
    "build/",
    "node_modules/",
    ".next/",
    "coverage/",
}


def _is_noisy_path(path: str) -> bool:
    lower = path.lower().replace("\\", "/")
    return any(token in lower for token in NOISY_PATH_TOKENS)


def reciprocal_rank_fusion(rankings: list[list[str]], k: int = 60) -> list[str]:
    scores: dict[str, float] = defaultdict(float)
    for ranking in rankings:
        for rank, item_id in enumerate(ranking, start=1):
            scores[item_id] += 1.0 / (k + rank)
    return [item_id for item_id, _ in sorted(scores.items(), key=lambda x: x[1], reverse=True)]


def _to_vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in values) + "]"


def _dense_search_postgres_with_embedding(
    session: Session,
    repository_id: str,
    embedding: list[float],
    top_k: int = 20,
) -> list[dict]:
    validate_embedding_dimension(embedding)
    vector_literal = _to_vector_literal(embedding)
    stmt = text(
        """
        SELECT id, path, symbol, content,
               1 - (embedding <=> CAST(:embedding AS vector)) AS score
        FROM code_chunks
        WHERE repository_id = :repository_id
          AND embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :top_k
        """
    )
    rows = session.execute(
        stmt,
        {"embedding": vector_literal, "repository_id": repository_id, "top_k": top_k},
    ).mappings()
    return [dict(row) for row in rows]


def _dense_search_postgres(session: Session, repository_id: str, query: str, top_k: int = 20) -> list[dict]:
    try:
        embedding = get_embedding_provider().embed_text(query)
    except RuntimeError:
        return []  # Ollama unavailable; skip dense search
    validate_embedding_dimension(embedding)
    vector_literal = _to_vector_literal(embedding)
    stmt = text(
        """
        SELECT id, path, symbol, content,
               1 - (embedding <=> CAST(:embedding AS vector)) AS score
        FROM code_chunks
        WHERE repository_id = :repository_id
          AND embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :top_k
        """
    )
    rows = session.execute(
        stmt,
        {"embedding": vector_literal, "repository_id": repository_id, "top_k": top_k},
    ).mappings()
    return [dict(row) for row in rows]


def dense_search(session: Session, repository_id: str, query: str, top_k: int = 20) -> list[dict]:
    try:
        embedding = get_embedding_provider().embed_text(query)
    except RuntimeError:
        return []  # Ollama unavailable; dense search not possible
    validate_embedding_dimension(embedding)

    try:
        matches = QdrantService().search(vector=embedding, repository_id=repository_id, limit=top_k)
    except RuntimeError:
        return _dense_search_postgres_with_embedding(session, repository_id, embedding, top_k=top_k)

    if not matches:
        # Qdrant can be reachable but missing points/payload indexes.
        # Fall back to Postgres dense search if embeddings are stored there.
        return _dense_search_postgres_with_embedding(session, repository_id, embedding, top_k=top_k)

    matched_ids = [str(item.get("id")) for item in matches]
    score_map = {str(item.get("id")): float(item.get("score", 0.0)) for item in matches}

    # Fetch only the matched rows by primary key (efficient vs. full table scan)
    placeholders = ", ".join(f":mid{i}" for i in range(len(matched_ids)))
    stmt = text(
        f"SELECT id, path, symbol, content FROM code_chunks WHERE id IN ({placeholders})"
    )
    params = {f"mid{i}": chunk_id for i, chunk_id in enumerate(matched_ids)}
    rows = session.execute(stmt, params).mappings().all()
    rows_by_id = {str(row["id"]): dict(row) for row in rows}

    merged: list[dict] = []
    for item_id in matched_ids:
        row = rows_by_id.get(item_id)
        if not row:
            continue
        row["score"] = score_map.get(item_id, 0.0)
        if _is_noisy_path(str(row.get("path", ""))):
            continue
        merged.append(row)
    if merged:
        return merged

    # Qdrant returned matches, but none could be hydrated (e.g., stale IDs).
    return _dense_search_postgres_with_embedding(session, repository_id, embedding, top_k=top_k)


def lexical_search(session: Session, repository_id: str, query: str, top_k: int = 20) -> list[dict]:
    if not query.strip():
        return []

    stmt = text(
        """
        SELECT id, path, symbol, content,
               ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', :query)) AS score
        FROM code_chunks
        WHERE repository_id = :repository_id
          AND to_tsvector('english', content) @@ plainto_tsquery('english', :query)
        ORDER BY score DESC
        LIMIT :top_k
        """
    )
    rows = session.execute(
        stmt,
        {"query": query, "repository_id": repository_id, "top_k": top_k},
    ).mappings()
    filtered: list[dict] = []
    for row in rows:
        item = dict(row)
        if _is_noisy_path(str(item.get("path", ""))):
            continue
        filtered.append(item)
    return filtered


def hybrid_retrieve(session: Session, repository_id: str, query: str, top_k: int = 8) -> list[dict]:
    dense = dense_search(session, repository_id, query, top_k=25)
    lexical = lexical_search(session, repository_id, query, top_k=25)

    dense_ids = [item["id"] for item in dense]
    lexical_ids = [item["id"] for item in lexical]
    merged_ids = reciprocal_rank_fusion([dense_ids, lexical_ids])[:top_k]

    items_by_id = {str(item["id"]): item for item in [*dense, *lexical]}
    ordered_items = [items_by_id[item_id] for item_id in merged_ids if item_id in items_by_id]

    if len(ordered_items) >= top_k:
        return ordered_items[:top_k]

    try:
        graph_items = graph_expand_context(session, repository_id, merged_ids, limit=max(top_k * 2, 8))
    except Exception:
        graph_items = []

    seen_ids = {str(item.get("id")) for item in ordered_items}
    for graph_item in graph_items:
        item_id = str(graph_item.get("id"))
        if not item_id or item_id in seen_ids:
            continue
        ordered_items.append(graph_item)
        seen_ids.add(item_id)
        if len(ordered_items) >= top_k:
            break

    return ordered_items[:top_k]
