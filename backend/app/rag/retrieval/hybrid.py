from __future__ import annotations

from collections import defaultdict
import logging
import re
from typing import Any
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.rag.embeddings.provider import get_embedding_provider, validate_embedding_dimension
from app.services.qdrant_service import QdrantService


logger = logging.getLogger(__name__)


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


def _rrf_score_map(rankings: list[list[str]], k: int = 60) -> dict[str, float]:
    scores: dict[str, float] = defaultdict(float)
    for ranking in rankings:
        for rank, item_id in enumerate(ranking, start=1):
            scores[item_id] += 1.0 / (k + rank)
    return scores


def _tokenize_query(query: str) -> set[str]:
    return {token for token in re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{1,}", query.lower()) if len(token) >= 2}


def _minmax_normalize(values: dict[str, float]) -> dict[str, float]:
    if not values:
        return {}
    min_value = min(values.values())
    max_value = max(values.values())
    if max_value <= min_value:
        return {key: 0.0 for key in values}
    scale = max_value - min_value
    return {key: (value - min_value) / scale for key, value in values.items()}


def _rerank_candidates(
    *,
    query: str,
    candidates: list[dict],
    dense: list[dict],
    lexical: list[dict],
    rankings: list[list[str]],
    is_high_level: bool,
) -> list[dict]:
    if len(candidates) <= 1:
        return candidates

    query_tokens = _tokenize_query(query)
    dense_scores = {str(item.get("id")): float(item.get("score") or 0.0) for item in dense}
    lexical_scores = {str(item.get("id")): float(item.get("score") or 0.0) for item in lexical}

    rrf_scores = _rrf_score_map(rankings)
    rrf_norm = _minmax_normalize(rrf_scores)
    dense_norm = _minmax_normalize(dense_scores)
    lexical_norm = _minmax_normalize(lexical_scores)

    scored: list[tuple[float, dict]] = []
    for item in candidates:
        item_id = str(item.get("id"))
        path = str(item.get("path") or "")
        symbol = str(item.get("symbol") or "")
        snippet = str(item.get("content") or "")[:1200]

        overlap_score = 0.0
        if query_tokens:
            haystack_tokens = _tokenize_query(f"{path} {symbol} {snippet}")
            overlap = len(query_tokens.intersection(haystack_tokens))
            overlap_score = overlap / max(len(query_tokens), 1)

        docs_boost = 0.08 if is_high_level and _looks_like_docs_path(path) else 0.0

        final_score = (
            0.55 * rrf_norm.get(item_id, 0.0)
            + 0.20 * dense_norm.get(item_id, 0.0)
            + 0.15 * lexical_norm.get(item_id, 0.0)
            + 0.10 * overlap_score
            + docs_boost
        )
        enriched = dict(item)
        enriched["rerank_score"] = round(final_score, 6)
        scored.append((final_score, enriched))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in scored]


def _to_vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in values) + "]"


def _dense_search_postgres_with_embedding(
    session: Session,
    repository_id: str,
    embedding: list[float],
    top_k: int = 20,
    scope_paths: list[str] | None = None,
) -> list[dict]:
    logger.debug(
        "retrieval_dense_postgres_embedding - request repository_id=%s top_k=%s",
        repository_id,
        top_k,
    )
    try:
        validate_embedding_dimension(embedding)
    except Exception as exc:
        logger.warning(
            "retrieval_dense_postgres_embedding - invalid embedding repository_id=%s error=%s",
            repository_id,
            exc,
        )
        return []
    vector_literal = _to_vector_literal(embedding)
    
    scope_clause = ""
    params = {"embedding": vector_literal, "repository_id": repository_id, "top_k": top_k}
    if scope_paths:
        scope_conditions = []
        for i, path in enumerate(scope_paths):
            param_key = f"scope_{i}"
            scope_conditions.append(f"path LIKE :{param_key}")
            params[param_key] = f"{path}%"
        scope_clause = f"AND ({' OR '.join(scope_conditions)})"

    stmt = text(
        f"""
        SELECT id, path, symbol, content, repository_id, repo_id,
               1 - (embedding <=> CAST(:embedding AS vector)) AS score
        FROM code_chunks
        WHERE repository_id = :repository_id
          AND status = 'ACTIVE'
          {scope_clause}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :top_k
        """
    )
    rows = session.execute(stmt, params).mappings()
    result = [dict(row) for row in rows]
    logger.debug("retrieval_dense_postgres_embedding - response repository_id=%s count=%s", repository_id, len(result))
    return result




def dense_search(session: Session, repository_id: str, query: str, top_k: int = 20, scope_paths: list[str] | None = None) -> list[dict]:
    logger.debug("retrieval_dense - request repository_id=%s top_k=%s", repository_id, top_k)
    try:
        embedding = get_embedding_provider().embed_text(query)
        validate_embedding_dimension(embedding)
    except Exception as exc:
        logger.warning(
            "retrieval_dense - embed failed repository_id=%s error=%s",
            repository_id,
            exc,
        )
        return []  # Ollama unavailable; dense search not possible

    try:
        matches = QdrantService().search(vector=embedding, repository_id=repository_id, limit=top_k * 3 if scope_paths else top_k)
    except RuntimeError as exc:
        logger.warning(
            "retrieval_dense - qdrant failed; falling back to postgres repository_id=%s error=%s",
            repository_id,
            exc,
        )
        return _dense_search_postgres_with_embedding(session, repository_id, embedding, top_k=top_k, scope_paths=scope_paths)

    if not matches:
        logger.debug("retrieval_dense - qdrant empty; falling back to postgres repository_id=%s", repository_id)
        return _dense_search_postgres_with_embedding(session, repository_id, embedding, top_k=top_k, scope_paths=scope_paths)

    matched_ids = [str(item.get("id")) for item in matches]
    score_map = {str(item.get("id")): float(item.get("score", 0.0)) for item in matches}

    placeholders = ", ".join(f":mid{i}" for i in range(len(matched_ids)))
    stmt = text(
        f"SELECT id, path, symbol, content, repository_id, repo_id FROM code_chunks WHERE id IN ({placeholders}) AND status = 'ACTIVE'"
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
        
        path = str(row.get("path", ""))
        if _is_noisy_path(path):
            continue
        if scope_paths and not any(path.startswith(sp) for sp in scope_paths):
            continue
            
        merged.append(row)
    if merged:
        logger.debug("retrieval_dense - response repository_id=%s count=%s source=qdrant", repository_id, len(merged))
        return merged[:top_k]

    logger.debug("retrieval_dense - qdrant stale ids or filtered out; falling back to postgres repository_id=%s", repository_id)
    return _dense_search_postgres_with_embedding(session, repository_id, embedding, top_k=top_k, scope_paths=scope_paths)


def lexical_search(session: Session, repository_id: str, query: str, top_k: int = 20, scope_paths: list[str] | None = None) -> list[dict]:
    if not query.strip():
        return []
    logger.debug("retrieval_lexical - request repository_id=%s top_k=%s", repository_id, top_k)

    scope_clause = ""
    params = {"query": query, "repository_id": repository_id, "top_k": top_k}
    if scope_paths:
        scope_conditions = []
        for i, path in enumerate(scope_paths):
            param_key = f"scope_{i}"
            scope_conditions.append(f"path LIKE :{param_key}")
            params[param_key] = f"{path}%"
        scope_clause = f"AND ({' OR '.join(scope_conditions)})"

    bind = getattr(session, "bind", None)
    dialect = getattr(getattr(bind, "dialect", None), "name", None)
    is_sqlite = bool(dialect and str(dialect).lower() == "sqlite")

    if is_sqlite:
        stmt = text(
            f"""
            SELECT id, path, symbol, content, repository_id, repo_id,
                   1.0 AS score
            FROM code_chunks
            WHERE repository_id = :repository_id
              AND status = 'ACTIVE'
              {scope_clause}
              AND content LIKE :like_query
            LIMIT :top_k
            """
        )
        params["like_query"] = f"%{query}%"
    else:
        stmt = text(
            f"""
            SELECT id, path, symbol, content, repository_id, repo_id,
                   ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', :query)) AS score
            FROM code_chunks
            WHERE repository_id = :repository_id
              AND status = 'ACTIVE'
              {scope_clause}
              AND to_tsvector('english', content) @@ plainto_tsquery('english', :query)
            ORDER BY score DESC
            LIMIT :top_k
            """
        )
    rows = session.execute(stmt, params).mappings()
    filtered: list[dict] = []
    for row in rows:
        item = dict(row)
        if _is_noisy_path(str(item.get("path", ""))):
            continue
        filtered.append(item)
    logger.debug("retrieval_lexical - response repository_id=%s count=%s", repository_id, len(filtered))
    return filtered




HIGH_LEVEL_QUERY_TOKENS = {
    "architecture",
    "overview",
    "structure",
    "design",
    "how does",
    "explain",
    "what is",
    "document",
    "documentation",
}

DOC_PATH_TOKENS = {
    "readme",
    "docs/",
    "doc/",
    ".md",
    "documentation",
    "architecture",
}


def _is_high_level_query(query: str) -> bool:
    q = " ".join(query.lower().split())
    return any(token in q for token in HIGH_LEVEL_QUERY_TOKENS)


def _looks_like_docs_path(path: str) -> bool:
    lower = str(path or "").lower().replace("\\", "/")
    return any(token in lower for token in DOC_PATH_TOKENS)


def hybrid_retrieve(session: Session, repository_id: str, query: str, top_k: int = 8, scope_paths: list[str] | None = None) -> list[dict]:
    logger.info("retrieval_hybrid - request repository_id=%s top_k=%s", repository_id, top_k)
    candidate_pool = max(top_k, settings.retrieval_rerank_candidate_pool)
    if scope_paths:
        candidate_pool = max(candidate_pool, 50)  # Need more candidates to ensure we hit scopes
    dense = dense_search(session, repository_id, query, top_k=candidate_pool, scope_paths=scope_paths)
    lexical = lexical_search(session, repository_id, query, top_k=candidate_pool, scope_paths=scope_paths)

    # For "architecture" and similar high-level questions, boost documentation-ish files
    # so the model sees entrypoints/README/docs, not just arbitrary constructors.
    extra_rankings: list[list[str]] = []
    is_high_level_query = _is_high_level_query(query)
    if is_high_level_query:
        doc_candidates = [*lexical, *dense]
        doc_ids = [str(item["id"]) for item in doc_candidates if _looks_like_docs_path(str(item.get("path", "")))]
        if doc_ids:
            extra_rankings.append(doc_ids)

    dense_ids = [str(item["id"]) for item in dense]
    lexical_ids = [str(item["id"]) for item in lexical]
    rankings = [dense_ids, lexical_ids, *extra_rankings]
    merged_ids = reciprocal_rank_fusion(rankings)[:candidate_pool]

    items_by_id = {str(item["id"]): item for item in [*dense, *lexical]}
    candidate_items = [items_by_id[item_id] for item_id in merged_ids if item_id in items_by_id]
    if settings.retrieval_rerank_enabled:
        ordered_items = _rerank_candidates(
            query=query,
            candidates=candidate_items,
            dense=dense,
            lexical=lexical,
            rankings=rankings,
            is_high_level=is_high_level_query,
        )
    else:
        ordered_items = candidate_items

    if len(ordered_items) >= top_k:
        logger.info(
            "retrieval_hybrid - response repository_id=%s dense=%s lexical=%s rerank=%s final=%s",
            repository_id,
            len(dense),
            len(lexical),
            settings.retrieval_rerank_enabled,
            top_k,
        )
        return ordered_items[:top_k]
    logger.info(
        "retrieval_hybrid - response repository_id=%s dense=%s lexical=%s final=%s",
        repository_id,
        len(dense),
        len(lexical),
        len(ordered_items[:top_k]),
    )
    return ordered_items[:top_k]


def _federation_score(item: dict[str, Any], query: str) -> float:
    base = float(item.get("rerank_score") or item.get("score") or 0.0)
    path = str(item.get("path") or "")
    symbol = str(item.get("symbol") or "")
    content = str(item.get("content") or "")[:800]
    q_tokens = _tokenize_query(query)
    if not q_tokens:
        return base
    hit_tokens = _tokenize_query(f"{path} {symbol} {content}")
    overlap = len(q_tokens.intersection(hit_tokens)) / max(len(q_tokens), 1)
    return base + (0.12 * overlap)


def project_federated_retrieve(*args, **kwargs) -> list[dict]:
    raise RuntimeError("Project-scoped retrieval is not supported in the simplified schema.")
