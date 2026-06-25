from app.llm.token_usage import estimate_tokens, extract_ollama_usage, merge_usage_totals


def test_estimate_tokens():
    assert estimate_tokens("") == 0
    assert estimate_tokens("abcd") == 1
    assert estimate_tokens("a" * 8) == 2


def test_extract_ollama_usage_from_body():
    usage = extract_ollama_usage(
        {"prompt_eval_count": 100, "eval_count": 50, "model": "llama3"},
        prompt_text="ignored",
        completion_text="ignored",
    )
    assert usage["prompt_tokens"] == 100
    assert usage["completion_tokens"] == 50
    assert usage["total_tokens"] == 150
    assert usage["source"] == "ollama"


def test_extract_ollama_usage_estimated_fallback():
    usage = extract_ollama_usage({}, prompt_text="hello world", completion_text="answer")
    assert usage["source"] == "estimated"
    assert usage["total_tokens"] > 0


def test_merge_usage_totals():
    totals = merge_usage_totals(None, {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15})
    assert totals["request_count"] == 1
    totals = merge_usage_totals(totals, {"prompt_tokens": 3, "completion_tokens": 2, "total_tokens": 5})
    assert totals["request_count"] == 2
    assert totals["total_tokens"] == 20
