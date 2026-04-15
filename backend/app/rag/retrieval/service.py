from __future__ import annotations

import hashlib
import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.observability.metrics import runtime_metrics
from app.rag.retrieval.hybrid import hybrid_retrieve, project_federated_retrieve
from app.services.cache_service import get_cache_service


logger = logging.getLogger(__name__)


class RetrievalService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.cache = get_cache_service()

    def retrieve_repository(self, *, repository_id: str, query: str, top_k: int = 8) -> list[dict[str, Any]]:
        cache_key = self._cache_key(scope=f"repo:{repository_id}", query=query, top_k=top_k)
        cached = self.cache.get_json(cache_key)
        if cached and isinstance(cached.get("items"), list):
            runtime_metrics.increment("retrieval_cache_hits_total", scope="repository")
            return [dict(item) for item in cached["items"]]

        runtime_metrics.increment("retrieval_cache_misses_total", scope="repository")
        with runtime_metrics.timer("retrieval_latency_ms", scope="repository"):
            items = hybrid_retrieve(self.session, repository_id=repository_id, query=query, top_k=top_k)

        selected = self._post_process(items, query=query, top_k=top_k)
        self.cache.set_json(cache_key, {"items": selected}, ttl_seconds=settings.retrieval_cache_ttl_seconds)
        runtime_metrics.increment("retrieval_requests_total", scope="repository")
        runtime_metrics.increment("retrieved_chunks_total", amount=len(selected), scope="repository")
        return selected

    def retrieve_project(self, *, project_id: str, query: str, top_k: int = 8, per_repo_k: int = 6) -> list[dict[str, Any]]:
        cache_key = self._cache_key(scope=f"project:{project_id}", query=query, top_k=top_k)
        cached = self.cache.get_json(cache_key)
        if cached and isinstance(cached.get("items"), list):
            runtime_metrics.increment("retrieval_cache_hits_total", scope="project")
            return [dict(item) for item in cached["items"]]

        runtime_metrics.increment("retrieval_cache_misses_total", scope="project")
        with runtime_metrics.timer("retrieval_latency_ms", scope="project"):
            items = project_federated_retrieve(
                self.session,
                project_id=project_id,
                query=query,
                top_k=top_k,
                per_repo_k=per_repo_k,
            )

        selected = self._post_process(items, query=query, top_k=top_k)
        self.cache.set_json(cache_key, {"items": selected}, ttl_seconds=settings.retrieval_cache_ttl_seconds)
        runtime_metrics.increment("retrieval_requests_total", scope="project")
        runtime_metrics.increment("retrieved_chunks_total", amount=len(selected), scope="project")
        return selected

    def _post_process(self, items: list[dict[str, Any]], *, query: str, top_k: int) -> list[dict[str, Any]]:
        if not items:
            return []

        query_tokens = self._tokenize(query)
        deduped: list[dict[str, Any]] = []
        seen_keys: set[tuple[str, str, str]] = set()
        context_chars = 0

        for item in items:
            path = str(item.get("path") or "")
            symbol = str(item.get("symbol") or "")
            repo = str(item.get("repository_id") or item.get("repo_id") or "")
            dedupe_key = (repo, path, symbol)
            if dedupe_key in seen_keys:
                continue

            content = str(item.get("content") or "")
            overlap = self._overlap_count(query_tokens, self._tokenize(f"{path}\n{symbol}\n{content[:1200]}"))
            if query_tokens and overlap < settings.retrieval_min_token_overlap:
                score = float(item.get("rerank_score") or item.get("federation_score") or item.get("score") or 0.0)
                if score < 0.12:
                    continue

            trimmed_content = content[: settings.retrieval_max_chunk_chars]
            projected_context = context_chars + len(trimmed_content)
            if deduped and projected_context > settings.retrieval_context_char_budget:
                break

            normalized = dict(item)
            normalized["content"] = trimmed_content
            normalized["token_overlap"] = overlap
            deduped.append(normalized)
            seen_keys.add(dedupe_key)
            context_chars = projected_context
            if len(deduped) >= top_k:
                break

        return deduped

    def _cache_key(self, *, scope: str, query: str, top_k: int) -> str:
        query_hash = hashlib.sha256(" ".join(query.lower().split()).encode("utf-8")).hexdigest()[:20]
        return f"retrieval:v1:{scope}:{top_k}:{query_hash}"

    def _tokenize(self, text: str) -> set[str]:
        return {
            token
            for token in re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{1,}", text.lower())
            if len(token) >= 2
        }

    def _overlap_count(self, left: set[str], right: set[str]) -> int:
        if not left or not right:
            return 0
        return len(left.intersection(right))


def get_retrieval_service(session: Session) -> RetrievalService:
    return RetrievalService(session)
