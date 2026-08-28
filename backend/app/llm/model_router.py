from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import httpx

from app.core.config import settings
from app.core.http_client import get_http_client
from app.llm.prompt_builder import BASE_SYSTEM_PROMPT
from app.llm.token_usage import extract_ollama_usage
from app.rag.embeddings.provider import get_embedding_provider


logger = logging.getLogger(__name__)

_DEFAULT_CHAT_SYSTEM_PROMPT = (
    "You are AI Codebase Copilot."
    "\n\nRules:"
    "\n- Use ONLY the provided code context."
    "\n- Do NOT assume files or features that are not in the context."
    "\n- Do NOT introduce technologies/frameworks that are not explicitly present in the context text."
    "\n- If the context is insufficient, say so and list what is missing."
    "\n- When explaining architecture, output a short module-by-module outline."
    "\n- For every major claim, include at least one file path that appears in the provided context."
)


def build_chat_messages(
    prompt: str,
    context: str = "",
    *,
    system_prompt: str | None = None,
) -> list[dict[str, str]]:
    """Build Ollama chat messages.

    Context is embedded into the system prompt so small models (e.g. tinyllama)
    only see a single user turn — the actual question.  Putting context as a
    separate 'user' message causes those models to echo it verbatim instead of
    answering.
    """
    active_system_prompt = system_prompt or BASE_SYSTEM_PROMPT or _DEFAULT_CHAT_SYSTEM_PROMPT
    if context.strip():
        system_content = (
            f"{active_system_prompt}\n\n"
            "--- Retrieved codebase context (use to answer; do not repeat verbatim) ---\n"
            f"{context.strip()}\n"
            "--- End of context ---"
        )
    else:
        system_content = active_system_prompt
    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": prompt.strip()},
    ]


@dataclass
class ChatCompletion:
    text: str
    usage: dict[str, Any]


class OllamaModelRouter:
    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.chat_model = settings.ollama_chat_model
        self.timeout = settings.ollama_chat_timeout_seconds
        self.use_nvidia = settings.use_nvidia_api
        self.nvidia_key = settings.nvidia_api_key
        self.nvidia_chat_model = settings.nvidia_chat_model
        self.embedder = get_embedding_provider()
        self._stream_usage: dict[str, Any] = {}

    def consume_stream_usage(self) -> dict[str, Any]:
        usage = dict(self._stream_usage)
        self._stream_usage = {}
        return usage

    def chat(
        self,
        prompt: str,
        context: str = "",
        system_prompt: str | None = None,
        *,
        timeout_seconds: float | None = None,
        allow_context_retry: bool = True,
    ) -> ChatCompletion:
        logger.debug("ollama_chat - request received prompt_chars=%s context_chars=%s", len(prompt), len(context))
        full_context = context
        short_context = context[:6000] if context else ""
        last_error: RuntimeError | None = None
        active_system_prompt = system_prompt or BASE_SYSTEM_PROMPT or _DEFAULT_CHAT_SYSTEM_PROMPT
        read_timeout = max(5.0, float(timeout_seconds if timeout_seconds is not None else self.timeout))

        if allow_context_retry and short_context and short_context != full_context:
            context_candidates: tuple[str, ...] = (full_context, short_context)
        else:
            context_candidates = (full_context,) if full_context else ("",)

        for candidate_context in context_candidates:
            payload: dict[str, Any] = {
                "model": self.chat_model,
                "messages": build_chat_messages(
                    prompt,
                    candidate_context,
                    system_prompt=active_system_prompt,
                ),
                "options": {
                    "temperature": 0.0,
                    "num_ctx": 4096,
                },
                "stream": False,
            }
            try:
                response = get_http_client().post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                    timeout=httpx.Timeout(
                        connect=max(read_timeout, 30.0),
                        read=read_timeout,
                        write=max(read_timeout, 30.0),
                        pool=max(read_timeout, 30.0),
                    ),
                )
                response.raise_for_status()
                try:
                    body = response.json()
                except ValueError as exc:
                    body_excerpt = response.text[:200] if response.text else ""
                    last_error = RuntimeError(
                        f"Ollama chat response was not valid JSON. Response: {body_excerpt}"
                    )
                    logger.warning("ollama_chat - invalid json status=%s", response.status_code)
                    raise last_error from exc
                message = body.get("message", {})
                text = str(message.get("content", "")).strip()
                usage = extract_ollama_usage(
                    body,
                    prompt_text=f"{prompt}\n{context}",
                    completion_text=text,
                )
                logger.info("ollama_chat - response received chars=%s tokens=%s", len(text), usage.get("total_tokens"))
                return ChatCompletion(text=text, usage=usage)
            except httpx.HTTPStatusError as exc:
                body_excerpt = exc.response.text[:200] if exc.response is not None else "<no body>"
                last_error = RuntimeError(
                    f"Ollama chat request failed (status {exc.response.status_code if exc.response else '?'}): {body_excerpt}"
                )
                logger.warning(
                    "ollama_chat - http status failure status=%s candidate=%s",
                    exc.response.status_code if exc.response else "unknown",
                    "full" if not candidate_context or candidate_context == full_context else "short",
                )
            except httpx.HTTPError as exc:
                last_error = RuntimeError(f"Ollama chat request failed: {str(exc)[:200]}")
                logger.warning(
                    "ollama_chat - transport failure candidate=%s error=%s",
                    "full" if not candidate_context or candidate_context == full_context else "short",
                    str(exc)[:100],
                )

            if not allow_context_retry or not candidate_context or candidate_context == short_context:
                break

        if last_error is not None:
            logger.error("ollama_chat - failed after retries error=%s", str(last_error)[:200])
            raise last_error
        raise RuntimeError("Ollama chat failed: no response generated")

    def stream_chat(
        self,
        prompt: str,
        context: str = "",
        *,
        system_prompt: str | None = None,
    ):
        logger.debug("ollama_stream - request received prompt_chars=%s context_chars=%s", len(prompt), len(context))
        payload: dict[str, Any] = {
            "model": self.chat_model,
            "messages": build_chat_messages(
                prompt,
                context,
                system_prompt=system_prompt or BASE_SYSTEM_PROMPT,
            ),
            "options": {
                "temperature": 0.0,
                # 4096 keeps KV-cache ~900 MB so llama3.2:3b fits in 3.7 GB RAM.
                "num_ctx": 4096,
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
                if response.status_code >= 400:
                    # Must read the body before raise_for_status on a streaming response,
                    # otherwise httpx raises ResponseNotRead masking the real error.
                    response.read()
                    response.raise_for_status()
                yielded = 0
                completion_parts: list[str] = []
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
                        yielded += 1
                        completion_parts.append(delta)
                        yield delta
                    if body.get("done"):
                        completion_text = "".join(completion_parts)
                        self._stream_usage = extract_ollama_usage(
                            body,
                            prompt_text=f"{prompt}\n{context}",
                            completion_text=completion_text,
                        )
                        break
                logger.info("ollama_stream - completed chunks=%s", yielded)
        except httpx.HTTPStatusError as exc:
            body_excerpt = ""
            if exc.response is not None:
                try:
                    body_excerpt = exc.response.text[:200]
                except Exception:
                    body_excerpt = "(response body unavailable)"
            logger.exception("ollama_stream - http status failure status=%s body=%s", exc.response.status_code if exc.response is not None else "?", body_excerpt)
            raise RuntimeError(f"Ollama stream request failed: {exc}. Response: {body_excerpt}") from exc
        except httpx.HTTPError as exc:
            logger.exception("ollama_stream - transport failure")
            raise RuntimeError(f"Ollama stream request failed: {exc}") from exc

    def embed(self, text: str) -> list[float]:
        return self.embedder.embed_text(text)


def get_model_router() -> OllamaModelRouter:
    # Safe to reuse across requests: http client is pooled and embedder is stateless.
    return _get_model_router_singleton()

@lru_cache
def _get_model_router_singleton() -> OllamaModelRouter:
    return OllamaModelRouter()