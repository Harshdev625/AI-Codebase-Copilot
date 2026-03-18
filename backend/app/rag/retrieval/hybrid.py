from __future__ import annotations

from collections import defaultdict
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.rag.embeddings.provider import get_embedding_provider, validate_embedding_dimension
from app.services.qdrant_service import QdrantService


def reciprocal_rank_fusion(rankings: list[list[str]], k: int = 60) -> list[str]:
    scores: dict[str, float] = defaultdict(float)
    for ranking in rankings:
        for rank, item_id in enumerate(ranking, start=1):
            scores[item_id] += 1.0 / (k + rank)
    return [item_id for item_id, _ in sorted(scores.items(), key=lambda x: x[1], reverse=True)]


def _to_vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in values) + "]"


def _dense_search_postgres(session: Session, repo_id: str, query: str, top_k: int = 20) -> list[dict]:
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
        WHERE repo_id = :repo_id
          AND embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :top_k
        """
    )
    rows = session.execute(
        stmt,
        {"embedding": vector_literal, "repo_id": repo_id, "top_k": top_k},
    ).mappings()
    return [dict(row) for row in rows]


def dense_search(session: Session, repo_id: str, query: str, top_k: int = 20) -> list[dict]:
    try:
        embedding = get_embedding_provider().embed_text(query)
    except RuntimeError:
        return []  # Ollama unavailable; dense search not possible
    validate_embedding_dimension(embedding)

    try:
        matches = QdrantService().search(vector=embedding, repo_id=repo_id, limit=top_k)
    except RuntimeError:
        return _dense_search_postgres(session, repo_id, query, top_k=top_k)

    if not matches:
        return []

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
        merged.append(row)
    return merged


def lexical_search(session: Session, repo_id: str, query: str, top_k: int = 20) -> list[dict]:
    stmt = text(
        """
        SELECT id, path, symbol, content,
               ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', :query)) AS score
        FROM code_chunks
        WHERE repo_id = :repo_id
        ORDER BY score DESC
        LIMIT :top_k
        """
    )
    rows = session.execute(stmt, {"query": query, "repo_id": repo_id, "top_k": top_k}).mappings()
    return [dict(row) for row in rows]


def hybrid_retrieve(session: Session, repo_id: str, query: str, top_k: int = 8) -> list[dict]:
    dense = dense_search(session, repo_id, query, top_k=25)
    lexical = lexical_search(session, repo_id, query, top_k=25)

    dense_ids = [item["id"] for item in dense]
    lexical_ids = [item["id"] for item in lexical]
    merged_ids = reciprocal_rank_fusion([dense_ids, lexical_ids])[:top_k]

    items_by_id = {item["id"]: item for item in [*dense, *lexical]}
    return [items_by_id[item_id] for item_id in merged_ids if item_id in items_by_id]
