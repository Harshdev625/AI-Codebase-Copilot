"""Tests for chat stream echo detection and answer quality gates."""

from app.api.v1.chat import (
    _INSUFFICIENT_CONTEXT_ANSWER,
    _is_unacceptable_answer,
    _looks_like_prompt_echo,
    _statuses_from_trace,
)


def test_echo_detects_retrieved_sources_prefix():
    text = "Retrieved codebase sources (for reference only — do not repeat verbatim):\n\nSource [S1]"
    assert _looks_like_prompt_echo(text) is True


def test_echo_detects_source_block_with_code():
    text = "Source [S1] File: README.md (Symbol: module)\nCode:\n# TimeMachine"
    assert _looks_like_prompt_echo(text) is True


def test_echo_detects_current_user_question_with_sources():
    text = "Current user question: tell me about the project\n\nSource [S1] File: readme.md"
    assert _looks_like_prompt_echo(text) is True


def test_clean_answer_not_echo():
    text = "This is a browser extension for focus tracking and productivity [S1]."
    assert _looks_like_prompt_echo(text) is False


def test_unacceptable_empty_answer():
    assert _is_unacceptable_answer("") is True


def test_unacceptable_source_file_header():
    text = "Source [S1] File: README.md\nSome content"
    assert _is_unacceptable_answer(text) is True


def test_acceptable_grounded_answer():
    text = "The project is a Chrome extension for time tracking [S1]."
    assert _is_unacceptable_answer(text) is False


def test_insufficient_context_message_is_acceptable():
    assert _is_unacceptable_answer(_INSUFFICIENT_CONTEXT_ANSWER) is False


def test_statuses_from_trace_extracts_labels():
    trace = [
        {"node": "planner", "label": "Planning intent: docs"},
        {"node": "retrieval", "label": "Retrieved 5 sources"},
    ]
    assert _statuses_from_trace(trace) == [
        "Planning intent: docs",
        "Retrieved 5 sources",
    ]
