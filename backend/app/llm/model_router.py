from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings
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
                        "content": "You are AI Codebase Copilot. Answer using provided code context.",
                    },
                    {"role": "user", "content": user_prompt},
                ],
                "stream": False,
            }
            try:
                response = httpx.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                    timeout=self.timeout,
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

    def embed(self, text: str) -> list[float]:
        return self.embedder.embed_text(text)


def get_model_router() -> OllamaModelRouter:
    return OllamaModelRouter()