from app.rag.retrieval.query_signals import infer_query_signals, tech_boost_for_item


def test_infer_css_query_signals() -> None:
    signals = infer_query_signals("refactor the CSS for chat bubble styles")
    assert ".css" in signals.preferred_extensions
    assert signals.is_tech_specific is True


def test_tech_boost_prefers_css_path() -> None:
    signals = infer_query_signals("update css styling")
    boost = tech_boost_for_item(path="src/chat.css", language="css", signals=signals)
    assert boost > 0.0


def test_tech_boost_penalizes_md_for_css_query() -> None:
    signals = infer_query_signals("explain css layout")
    boost = tech_boost_for_item(path="README.md", language="markdown", signals=signals)
    assert boost < 0.0
