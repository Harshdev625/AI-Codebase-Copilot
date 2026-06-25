from app.llm.prompt_builder import build_context_packet, BASE_SYSTEM_PROMPT

def test_build_context_packet_empty():
    context, index = build_context_packet(query="test", snippets=[])
    assert context == ""
    assert len(index) == 0

def test_build_context_packet_with_history():
    history = [
        {"query": "Hello", "answer": "Hi there"},
        {"query": "How are you?"} # Missing answer
    ]
    context, index = build_context_packet(query="what is your name", snippets=[], history=history)
    assert "Recent conversation context:" in context
    assert "- User: Hello" in context
    assert "- Assistant: Hi there" in context
    assert "- User: How are you?" in context
    assert "Current user question:" not in context
    assert len(index) == 0

def test_build_context_packet_with_snippets():
    snippets = [
        {
            "repo_id": "repo-1",
            "path": "main.py",
            "symbol": "main",
            "start_line": 10,
            "end_line": 20,
            "rerank_score": 0.95,
            "content": "def main(): pass"
        },
        {
            # Testing fallbacks and missing fields
            "content": "some text"
        }
    ]
    context, index = build_context_packet(query="test", snippets=snippets)
    assert "Source [S1]" in context
    assert "File: main.py" in context
    assert "Lines: 10-20" in context
    assert "Score: 0.9500" in context
    assert "def main(): pass" in context

    assert "Source [S2]" in context
    assert "File: unknown" in context
    assert "some text" in context

    assert len(index) == 2
    assert index[0]["source_id"] == "S1"
    assert index[0]["repository_name"] == "repo-1"
    assert index[0]["path"] == "main.py"
    
    assert index[1]["source_id"] == "S2"
    assert index[1]["repository_name"] == "unknown-repo"
    assert index[1]["path"] == "unknown"

def test_build_context_packet_budget_limit():
    from app.core.config import settings
    # Temporarily modify budget
    old_budget = settings.retrieval_context_char_budget
    settings.retrieval_context_char_budget = 200
    try:
        snippets = [
            {"content": "a" * 60},
            {"content": "b" * 150}, # This one will be skipped because it exceeds budget
        ]
        context, index = build_context_packet(query="test", snippets=snippets)
        assert len(index) == 1
        assert "a" * 60 in context
        assert "b" * 150 not in context
    finally:
        settings.retrieval_context_char_budget = old_budget
