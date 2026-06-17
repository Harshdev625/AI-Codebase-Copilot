import logging
import time

from app.graph.state import CopilotState
from app.observability.metrics import runtime_metrics
from app.rag.retrieval.hybrid import hybrid_retrieve
from app.rag.retrieval.service import get_retrieval_service


logger = logging.getLogger(__name__)


def retrieval_node(state: CopilotState) -> CopilotState:
    logger.debug(
        "graph_retrieval - request repository_id=%s query_chars=%s",
        state.get("repository_id"),
        len(str(state.get("query", ""))),
    )
    session = state["session"]
    scope_paths = state.get("scope_paths")
    intent = str(state.get("intent") or "")
    started = time.perf_counter()
    if hasattr(session, "execute"):
        retrieval_service = get_retrieval_service(session)
        results = retrieval_service.retrieve_repository(
            repository_id=state["repository_id"],
            query=state["query"],
            top_k=8,
            scope_paths=scope_paths,
            intent=intent or None,
        )
    else:
        results = hybrid_retrieve(
            session,
            repository_id=state["repository_id"],
            query=state["query"],
            top_k=8,
            scope_paths=scope_paths,
            intent=intent or None,
        )
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    runtime_metrics.observe_ms("graph_retrieval_node_latency_ms", elapsed_ms)
    runtime_metrics.increment("graph_retrieval_node_calls_total")
    runtime_metrics.increment("graph_retrieved_chunks_total", amount=len(results))

    source_index = [
        {
            "path": item.get("path"),
            "symbol": item.get("symbol"),
            "repository_id": item.get("repository_id") or item.get("repo_id"),
            "score": item.get("rerank_score") or item.get("federation_score") or item.get("score"),
        }
        for item in results[:8]
    ]
    source_preview = [
        {
            "path": str(item.get("path") or ""),
            "score": item.get("rerank_score") or item.get("federation_score") or item.get("score"),
        }
        for item in results[:5]
        if item.get("path")
    ]
    logger.debug("graph_retrieval - response results=%s", len(results))

    trace = list(state.get("run_trace") or [])
    trace.append(
        {
            "node": "retrieval",
            "label": f"Retrieved {len(results)} sources",
            "ts": time.time(),
            "detail": {
                "retrieved_count": len(results),
                "scope_paths": scope_paths or [],
                "source_preview": source_preview,
            },
        }
    )
    return {"retrieved_context": results, "source_index": source_index, "run_trace": trace}
