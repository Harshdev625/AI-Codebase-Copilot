import logging

from app.graph.state import CopilotState
from app.rag.retrieval.hybrid import hybrid_retrieve


logger = logging.getLogger(__name__)


def retrieval_node(state: CopilotState) -> CopilotState:
    logger.debug(
        "graph_retrieval - request repository_id=%s query_chars=%s",
        state.get("repository_id"),
        len(str(state.get("query", ""))),
    )
    session = state["session"]
    results = hybrid_retrieve(session, repository_id=state["repository_id"], query=state["query"], top_k=8)
    logger.debug("graph_retrieval - response results=%s", len(results))
    return {"retrieved_context": results}
