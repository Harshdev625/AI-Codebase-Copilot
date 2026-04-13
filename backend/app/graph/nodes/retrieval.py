from app.graph.state import CopilotState
from app.rag.retrieval.hybrid import hybrid_retrieve


def retrieval_node(state: CopilotState) -> CopilotState:
    session = state["session"]
    results = hybrid_retrieve(session, repository_id=state["repository_id"], query=state["query"], top_k=8)
    return {"retrieved_context": results}
