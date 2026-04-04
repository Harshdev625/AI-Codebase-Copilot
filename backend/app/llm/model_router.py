from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import settings
from app.core.http_client import get_http_client
from app.rag.embeddings.provider import get_embedding_provider


class OllamaModelRouter:
    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.chat_model = settings.ollama_chat_model
        self.timeout = settings.ollama_timeout_seconds
        self.embedder = get_embedding_provider()

    def chat(self, prompt: str, context: str = "") -> str:
        full_context = context
        short_context = context[:6000] if context else ""
        last_error: RuntimeError | None = None

        for candidate_context in (full_context, short_context):
            user_prompt = prompt if not candidate_context else f"Context:\n{candidate_context}\n\nQuestion:\n{prompt}"
            payload: dict[str, Any] = {
                "model": self.chat_model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are AI Codebase Copilot."
                            "\n\nRules:"
                            "\n- Use ONLY the provided code context."
                            "\n- Do NOT assume files or features that are not in the context."
                            "\n- Do NOT introduce technologies/frameworks that are not explicitly present in the context text."
                            "\n- If the context is insufficient, say so and list what is missing."
                            "\n- When explaining architecture, output a short module-by-module outline."
                            "\n- For every major claim, include at least one file path that appears in the provided context."
                        ),
                    },
                    {"role": "user", "content": user_prompt},
                ],
                "options": {
                    "temperature": 0.0,
                },
                "stream": False,
            }
            try:
                response = get_http_client().post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                    # First-token/model-load can be slow on CPU.
                    timeout=max(self.timeout, 180.0),
                )
                response.raise_for_status()
                body = response.json()
                message = body.get("message", {})
                return str(message.get("content", "")).strip()
            except httpx.HTTPStatusError as exc:
                body_excerpt = exc.response.text[:200] if exc.response is not None else ""
                last_error = RuntimeError(
                    f"Ollama chat request failed: {exc}. Response: {body_excerpt}"
                )
            except httpx.HTTPError as exc:
                last_error = RuntimeError(f"Ollama chat request failed: {exc}")

            if not candidate_context or candidate_context == short_context:
                break

        if last_error is not None:
            raise last_error
        raise RuntimeError("Ollama chat request failed")

    def stream_chat(self, prompt: str, context: str = ""):
        user_prompt = prompt if not context else f"Context:\n{context}\n\nQuestion:\n{prompt}"
        payload: dict[str, Any] = {
            "model": self.chat_model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are AI Codebase Copilot."
                        "\n\nRules:"
                        "\n- Use ONLY the provided code context."
                        "\n- Do NOT assume files or features that are not in the context."
                        "\n- Do NOT introduce technologies/frameworks that are not explicitly present in the context text."
                        "\n- If the context is insufficient, say so and list what is missing."
                        "\n- When explaining architecture, output a short module-by-module outline."
                        "\n- For every major claim, include at least one file path that appears in the provided context."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            "options": {
                "temperature": 0.0,
            },
            "stream": True,
        }

        try:
            with get_http_client().stream(
                "POST",
                f"{self.base_url}/api/chat",
                json=payload,
                # Streaming responses can take arbitrarily long; disable read timeout.
                timeout=httpx.Timeout(connect=max(self.timeout, 30.0), read=None, write=max(self.timeout, 30.0), pool=max(self.timeout, 30.0)),
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line:
                        continue
                    try:
                        body = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    message = body.get("message", {})
                    delta = str(message.get("content", ""))
                    if delta:
                        yield delta
                    if body.get("done"):
                        break
        except httpx.HTTPStatusError as exc:
            body_excerpt = exc.response.text[:200] if exc.response is not None else ""
            raise RuntimeError(f"Ollama stream request failed: {exc}. Response: {body_excerpt}") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Ollama stream request failed: {exc}") from exc

    def embed(self, text: str) -> list[float]:
        return self.embedder.embed_text(text)


def get_model_router() -> OllamaModelRouter:
    # Safe to reuse across requests: http client is pooled and embedder is stateless.
    return _get_model_router_singleton()


from functools import lru_cache


@lru_cache
def _get_model_router_singleton() -> OllamaModelRouter:
    return OllamaModelRouter()