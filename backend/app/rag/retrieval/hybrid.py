from __future__ import annotations

from collections import defaultdict
import logging
import re
from typing import Any
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.rag.embeddings.provider import get_embedding_provider, validate_embedding_dimension
from app.rag.retrieval.query_signals import infer_query_signals, tech_boost_for_item
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
    patch_chunk_ids: set[str] | None = None,
    query_signals=None,
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

        docs_boost = 0.0
        if is_high_level and _looks_like_docs_path(path):
            if not (query_signals and query_signals.is_tech_specific):
                docs_boost = 0.08
        is_patch_chunk = item.get("is_patch_chunk") or (patch_chunk_ids and item_id in patch_chunk_ids)
        patch_boost = 0.15 if is_patch_chunk else 0.0
        tech_boost = 0.0
        if query_signals is not None:
            tech_boost = tech_boost_for_item(
                path=path,
                language=str(item.get("language") or ""),
                signals=query_signals,
            )

        final_score = (
            0.55 * rrf_norm.get(item_id, 0.0)
            + 0.20 * dense_norm.get(item_id, 0.0)
            + 0.15 * lexical_norm.get(item_id, 0.0)
            + 0.10 * overlap_score
            + docs_boost
            + patch_boost
            + tech_boost
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
    patch_id: str | None = None,
) -> list[dict]:
    logger.debug(
        "retrieval_dense_postgres_embedding - request repository_id=%s top_k=%s patch_id=%s",
        repository_id,
        top_k,
        patch_id,
    )
    
    table_name = "patch_chunks" if patch_id else "code_chunks"
    status_clause = "AND patch_id = :patch_id" if patch_id else "AND status = 'ACTIVE' AND embedding IS NOT NULL"
    score_expression = "1.0 AS score" if patch_id else "1 - (embedding <=> CAST(:embedding AS vector)) AS score"
    order_by = "" if patch_id else "ORDER BY embedding <=> CAST(:embedding AS vector)"

    params = {"repository_id": repository_id, "top_k": top_k}
    if patch_id:
        params["patch_id"] = patch_id
    else:
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
        params["embedding"] = vector_literal
    
    scope_clause = ""
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
               start_line, end_line, language, chunk_type,
               {score_expression}
        FROM {table_name}
        WHERE repository_id = :repository_id
          {status_clause}
          {scope_clause}
        {order_by}
        LIMIT :top_k
        """
    )
    rows = session.execute(stmt, params).mappings()
    result = [dict(row) for row in rows]
    logger.debug("retrieval_dense_postgres_embedding - response repository_id=%s count=%s", repository_id, len(result))
    return result


def dense_search(session: Session, repository_id: str, query: str, top_k: int = 20, scope_paths: list[str] | None = None, patch_id: str | None = None) -> list[dict]:
    logger.debug("retrieval_dense - request repository_id=%s top_k=%s patch_id=%s", repository_id, top_k, patch_id)
    try:
        embedding = get_embedding_provider().embed_text(query)
        validate_embedding_dimension(embedding)
    except Exception as exc:
        logger.warning(
            "retrieval_dense - embed failed repository_id=%s error=%s",
            repository_id,
            exc,
        )
        return []

    try:
        matches = QdrantService().search(
            vector=embedding,
            repository_id=repository_id,
            limit=top_k * 3 if scope_paths else top_k,
            patch_id=patch_id
        )
    except RuntimeError as exc:
        logger.warning(
            "retrieval_dense - qdrant failed; falling back to postgres repository_id=%s error=%s",
            repository_id,
            exc,
        )
        return _dense_search_postgres_with_embedding(session, repository_id, embedding, top_k=top_k, scope_paths=scope_paths, patch_id=patch_id)

    if not matches:
        logger.debug("retrieval_dense - qdrant empty; falling back to postgres repository_id=%s", repository_id)
        return _dense_search_postgres_with_embedding(session, repository_id, embedding, top_k=top_k, scope_paths=scope_paths, patch_id=patch_id)

    matched_ids = [str(item.get("id")) for item in matches]
    score_map = {str(item.get("id")): float(item.get("score", 0.0)) for item in matches}

    placeholders = ", ".join(f":mid{i}" for i in range(len(matched_ids)))
    table_name = "patch_chunks" if patch_id else "code_chunks"
    status_clause = "" if patch_id else "AND status = 'ACTIVE'"
    
    stmt = text(
        f"SELECT id, path, symbol, content, repository_id, repo_id, start_line, end_line, language, chunk_type FROM {table_name} WHERE id IN ({placeholders}) {status_clause}"
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
        if patch_id:
            row["is_patch_chunk"] = True
        
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
    return _dense_search_postgres_with_embedding(session, repository_id, embedding, top_k=top_k, scope_paths=scope_paths, patch_id=patch_id)


def lexical_search(session: Session, repository_id: str, query: str, top_k: int = 20, scope_paths: list[str] | None = None, patch_id: str | None = None) -> list[dict]:
    if not query.strip():
        return []
    logger.debug("retrieval_lexical - request repository_id=%s top_k=%s patch_id=%s", repository_id, top_k, patch_id)

    scope_clause = ""
    params = {"query": query, "repository_id": repository_id, "top_k": top_k}
    if patch_id:
        params["patch_id"] = patch_id
        
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

    table_name = "patch_chunks" if patch_id else "code_chunks"
    status_clause = "AND patch_id = :patch_id" if patch_id else "AND status = 'ACTIVE'"

    if is_sqlite:
        stmt = text(
            f"""
            SELECT id, path, symbol, content, repository_id, repo_id,
                   start_line, end_line, language, chunk_type,
                   1.0 AS score
            FROM {table_name}
            WHERE repository_id = :repository_id
              {status_clause}
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
                   start_line, end_line, language, chunk_type,
                   ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', :query)) AS score
            FROM {table_name}
            WHERE repository_id = :repository_id
              {status_clause}
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
        if patch_id:
            item["is_patch_chunk"] = True
        filtered.append(item)
    logger.debug("retrieval_lexical - response repository_id=%s count=%s", repository_id, len(filtered))
    return filtered


def path_lexical_search(
    session: Session,
    repository_id: str,
    query: str,
    top_k: int = 20,
    scope_paths: list[str] | None = None,
    patch_id: str | None = None,
) -> list[dict]:
    """Lexical search over path + symbol (complements content-only lexical_search)."""
    if not query.strip():
        return []

    scope_clause = ""
    params: dict[str, Any] = {"query": query, "repository_id": repository_id, "top_k": top_k}
    if patch_id:
        params["patch_id"] = patch_id
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

    table_name = "patch_chunks" if patch_id else "code_chunks"
    status_clause = "AND patch_id = :patch_id" if patch_id else "AND status = 'ACTIVE'"

    if is_sqlite:
        stmt = text(
            f"""
            SELECT id, path, symbol, content, repository_id, repo_id,
                   start_line, end_line, language, chunk_type,
                   1.0 AS score
            FROM {table_name}
            WHERE repository_id = :repository_id
              {status_clause}
              {scope_clause}
              AND (path LIKE :like_query OR symbol LIKE :like_query)
            LIMIT :top_k
            """
        )
        params["like_query"] = f"%{query}%"
    else:
        stmt = text(
            f"""
            SELECT id, path, symbol, content, repository_id, repo_id,
                   start_line, end_line, language, chunk_type,
                   ts_rank_cd(
                     to_tsvector('english', coalesce(path, '') || ' ' || coalesce(symbol, '')),
                     plainto_tsquery('english', :query)
                   ) AS score
            FROM {table_name}
            WHERE repository_id = :repository_id
              {status_clause}
              {scope_clause}
              AND to_tsvector('english', coalesce(path, '') || ' ' || coalesce(symbol, ''))
                  @@ plainto_tsquery('english', :query)
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
        if patch_id:
            item["is_patch_chunk"] = True
        filtered.append(item)
    return filtered


HIGH_LEVEL_QUERY_TOKENS = {
    "architecture",
    "overview",
    "structure",
    "design",
    "how does",
    "explain",
    "what is",
    "tell me about",
    "about the project",
    "about this project",
    "about the repo",
    "document",
    "documentation",
    "project",
}

DOC_PATH_TOKENS = {
    "readme",
    "docs/",
    "doc/",
    ".md",
    "documentation",
    "architecture",
    "package.json",
    "manifest.json",
}


def _is_high_level_query(query: str) -> bool:
    q = " ".join(query.lower().split())
    return any(token in q for token in HIGH_LEVEL_QUERY_TOKENS)


def _looks_like_docs_path(path: str) -> bool:
    lower = str(path or "").lower().replace("\\", "/")
    return any(token in lower for token in DOC_PATH_TOKENS)


def hybrid_retrieve(
    session: Session,
    repository_id: str,
    query: str,
    top_k: int = 8,
    scope_paths: list[str] | None = None,
    patch_id: str | None = None,
    intent: str | None = None,
) -> list[dict]:
    logger.info("retrieval_hybrid - request repository_id=%s top_k=%s patch_id=%s", repository_id, top_k, patch_id)
    candidate_pool = max(top_k, settings.retrieval_rerank_candidate_pool)
    if scope_paths:
        candidate_pool = max(candidate_pool, 50)

    excluded_paths = set()
    if patch_id:
        rows = session.execute(
            text("SELECT file_path FROM act_patch_files WHERE patch_id = :pid AND action IN ('MODIFIED', 'DELETED')"),
            {"pid": patch_id}
        ).mappings().all()
        excluded_paths = {r["file_path"] for r in rows}

    dense_base = dense_search(session, repository_id, query, top_k=candidate_pool, scope_paths=scope_paths)
    lexical_base = lexical_search(session, repository_id, query, top_k=candidate_pool, scope_paths=scope_paths)
    path_lexical_base = path_lexical_search(
        session, repository_id, query, top_k=candidate_pool, scope_paths=scope_paths
    )

    if patch_id:
        dense_base = [item for item in dense_base if item.get("path") not in excluded_paths]
        lexical_base = [item for item in lexical_base if item.get("path") not in excluded_paths]

        dense_patch = dense_search(session, repository_id, query, top_k=candidate_pool, scope_paths=scope_paths, patch_id=patch_id)
        lexical_patch = lexical_search(session, repository_id, query, top_k=candidate_pool, scope_paths=scope_paths, patch_id=patch_id)

        dense = [*dense_base, *dense_patch]
        lexical = [*lexical_base, *lexical_patch, *path_lexical_base]

        dense_ids = [str(item["id"]) for item in dense_base]
        lexical_ids = [str(item["id"]) for item in lexical_base]
        path_lexical_ids = [str(item["id"]) for item in path_lexical_base]
        patch_dense_ids = [str(item["id"]) for item in dense_patch]
        patch_lexical_ids = [str(item["id"]) for item in lexical_patch]

        rankings = [dense_ids, lexical_ids, path_lexical_ids, patch_dense_ids, patch_lexical_ids]
        patch_chunk_ids = {str(item["id"]) for item in dense_patch} | {str(item["id"]) for item in lexical_patch}
    else:
        dense = dense_base
        lexical = [*lexical_base, *path_lexical_base]
        dense_ids = [str(item["id"]) for item in dense]
        lexical_ids = [str(item["id"]) for item in lexical_base]
        path_lexical_ids = [str(item["id"]) for item in path_lexical_base]
        rankings = [dense_ids, lexical_ids, path_lexical_ids]
        patch_chunk_ids = set()

    query_signals = infer_query_signals(query, intent=intent)
    extra_rankings: list[list[str]] = []
    is_high_level_query = _is_high_level_query(query)
    if is_high_level_query and not query_signals.is_tech_specific:
        doc_candidates = [*lexical, *dense]
        doc_ids = [str(item["id"]) for item in doc_candidates if _looks_like_docs_path(str(item.get("path", "")))]
        if doc_ids:
            extra_rankings.append(doc_ids)

    rankings = [*rankings, *extra_rankings]
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
            patch_chunk_ids=patch_chunk_ids,
            query_signals=query_signals,
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

