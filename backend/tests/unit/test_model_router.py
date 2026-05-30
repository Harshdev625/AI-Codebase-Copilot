"""
Tests for app/llm/model_router.py
Coverage targets:
- OllamaModelRouter.chat (success, HTTP error, transport error, invalid JSON)
- OllamaModelRouter.stream_chat (success, HTTP error, transport error, empty lines)
- OllamaModelRouter.embed
- get_model_router
"""
import json
import pytest
from unittest.mock import MagicMock, patch, PropertyMock
import httpx

from app.llm.model_router import OllamaModelRouter, get_model_router


# ─────────────── fixtures ───────────────

@pytest.fixture
def router():
    with (
        patch("app.llm.model_router.get_embedding_provider", return_value=MagicMock()),
        patch("app.llm.model_router.settings") as mock_settings,
    ):
        mock_settings.ollama_base_url = "http://localhost:11434"
        mock_settings.ollama_chat_model = "llama3"
        mock_settings.ollama_chat_timeout_seconds = 30.0
        mock_settings.ollama_embedding_model = "nomic-embed-text"
        yield OllamaModelRouter()


# ─────────────── chat ───────────────

def test_chat_success(router):
    mock_response = MagicMock()
    mock_response.json.return_value = {"message": {"content": "Hello, world!"}}
    mock_response.raise_for_status = MagicMock()

    with patch("app.llm.model_router.get_http_client") as mock_client:
        mock_client.return_value.post.return_value = mock_response
        result = router.chat("Say hello", context="test context")

    assert result == "Hello, world!"


def test_chat_success_no_context(router):
    mock_response = MagicMock()
    mock_response.json.return_value = {"message": {"content": "Hi!"}}
    mock_response.raise_for_status = MagicMock()

    with patch("app.llm.model_router.get_http_client") as mock_client:
        mock_client.return_value.post.return_value = mock_response
        result = router.chat("Say hi")

    assert result == "Hi!"


def test_chat_http_status_error(router):
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    error = httpx.HTTPStatusError("Server Error", request=MagicMock(), response=mock_response)

    with patch("app.llm.model_router.get_http_client") as mock_client:
        mock_client.return_value.post.side_effect = error
        with pytest.raises(RuntimeError, match="Ollama chat"):
            router.chat("test")


def test_chat_transport_error(router):
    error = httpx.HTTPError("Connection refused")

    with patch("app.llm.model_router.get_http_client") as mock_client:
        mock_client.return_value.post.side_effect = error
        with pytest.raises(RuntimeError, match="Ollama chat request failed"):
            router.chat("test")


def test_chat_invalid_json_response(router):
    mock_response = MagicMock()
    mock_response.json.side_effect = ValueError("Bad JSON")
    mock_response.text = "not json"
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()

    with patch("app.llm.model_router.get_http_client") as mock_client:
        mock_client.return_value.post.return_value = mock_response
        with pytest.raises(RuntimeError, match="not valid JSON"):
            router.chat("test")


def test_chat_with_system_prompt(router):
    mock_response = MagicMock()
    mock_response.json.return_value = {"message": {"content": "Custom answer"}}
    mock_response.raise_for_status = MagicMock()

    with patch("app.llm.model_router.get_http_client") as mock_client:
        mock_client.return_value.post.return_value = mock_response
        result = router.chat("test", system_prompt="You are a custom AI")

    assert result == "Custom answer"


# ─────────────── stream_chat ───────────────

def test_stream_chat_success(router):
    lines = [
        json.dumps({"message": {"content": "Hello"}, "done": False}),
        json.dumps({"message": {"content": " world"}, "done": False}),
        json.dumps({"message": {"content": ""}, "done": True}),
    ]

    mock_response = MagicMock()
    mock_response.iter_lines.return_value = iter(lines)
    mock_response.raise_for_status = MagicMock()
    mock_response.__enter__ = lambda s: s
    mock_response.__exit__ = MagicMock(return_value=False)

    with patch("app.llm.model_router.get_http_client") as mock_client:
        mock_client.return_value.stream.return_value = mock_response
        chunks = list(router.stream_chat("say hello"))

    assert chunks == ["Hello", " world"]


def test_stream_chat_empty_lines(router):
    lines = [
        "",  # empty line, should be skipped
        json.dumps({"message": {"content": "text"}, "done": True}),
    ]

    mock_response = MagicMock()
    mock_response.iter_lines.return_value = iter(lines)
    mock_response.raise_for_status = MagicMock()
    mock_response.__enter__ = lambda s: s
    mock_response.__exit__ = MagicMock(return_value=False)

    with patch("app.llm.model_router.get_http_client") as mock_client:
        mock_client.return_value.stream.return_value = mock_response
        chunks = list(router.stream_chat("test"))

    assert chunks == ["text"]


def test_stream_chat_invalid_json_line(router):
    lines = [
        "not valid json",
        json.dumps({"message": {"content": "valid"}, "done": True}),
    ]

    mock_response = MagicMock()
    mock_response.iter_lines.return_value = iter(lines)
    mock_response.raise_for_status = MagicMock()
    mock_response.__enter__ = lambda s: s
    mock_response.__exit__ = MagicMock(return_value=False)

    with patch("app.llm.model_router.get_http_client") as mock_client:
        mock_client.return_value.stream.return_value = mock_response
        chunks = list(router.stream_chat("test"))

    assert chunks == ["valid"]


def test_stream_chat_http_status_error(router):
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Error"
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Error", request=MagicMock(), response=mock_response
    )
    mock_response.__enter__ = lambda s: s
    mock_response.__exit__ = MagicMock(return_value=False)

    with patch("app.llm.model_router.get_http_client") as mock_client:
        mock_client.return_value.stream.return_value = mock_response
        with pytest.raises(RuntimeError, match="Ollama stream request failed"):
            list(router.stream_chat("test"))


def test_stream_chat_transport_error(router):
    mock_response = MagicMock()
    mock_response.__enter__ = MagicMock(side_effect=httpx.HTTPError("Connection refused"))
    mock_response.__exit__ = MagicMock(return_value=False)

    with patch("app.llm.model_router.get_http_client") as mock_client:
        mock_client.return_value.stream.return_value = mock_response
        with pytest.raises(RuntimeError, match="Ollama stream request failed"):
            list(router.stream_chat("test"))


# ─────────────── embed ───────────────

def test_embed(router):
    router.embedder.embed_text.return_value = [0.1, 0.2, 0.3]
    result = router.embed("hello world")
    assert result == [0.1, 0.2, 0.3]
    router.embedder.embed_text.assert_called_once_with("hello world")


# ─────────────── get_model_router ───────────────

def test_get_model_router_returns_instance():
    with (
        patch("app.llm.model_router.get_embedding_provider", return_value=MagicMock()),
        patch("app.llm.model_router.settings") as mock_settings,
    ):
        mock_settings.ollama_base_url = "http://localhost:11434"
        mock_settings.ollama_chat_model = "llama3"
        mock_settings.ollama_chat_timeout_seconds = 30.0
        mock_settings.ollama_embedding_model = "nomic-embed-text"
        router = get_model_router()
        assert isinstance(router, OllamaModelRouter)
