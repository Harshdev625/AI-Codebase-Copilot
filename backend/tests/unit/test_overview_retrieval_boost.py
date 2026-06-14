"""Tests for overview/project query retrieval boosts."""

from app.rag.retrieval.hybrid import _is_high_level_query, _looks_like_docs_path


def test_high_level_query_about_project():
    assert _is_high_level_query("tell me about the project") is True


def test_high_level_query_overview():
    assert _is_high_level_query("give me an overview of the codebase") is True


def test_high_level_query_specific_symbol_is_false():
    assert _is_high_level_query("where is loginUser defined") is False


def test_docs_path_readme():
    assert _looks_like_docs_path("README.md") is True


def test_docs_path_package_json():
    assert _looks_like_docs_path("extension/package.json") is True


def test_docs_path_manifest():
    assert _looks_like_docs_path("extension/manifest.json") is True
