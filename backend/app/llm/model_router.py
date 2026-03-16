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
        user_prompt = prompt if not context else f"Context:\n{context}\n\nQuestion:\n{prompt}"
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
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Ollama chat request failed: {exc}") from exc

        body = response.json()
        message = body.get("message", {})
        return str(message.get("content", "")).strip()

    def embed(self, text: str) -> list[float]:
        return self.embedder.embed_text(text)


def get_model_router() -> OllamaModelRouter:
    return OllamaModelRouter()