from __future__ import annotations

import atexit
from functools import lru_cache

import httpx


@lru_cache
def get_http_client() -> httpx.Client:
    """Shared sync HTTP client.

    Using a single client enables connection pooling/keep-alives for Ollama/Qdrant
    and avoids the overhead of creating a new client per request.
    """

    client = httpx.Client(
        headers={"User-Agent": "ai-codebase-copilot-backend"},
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        follow_redirects=True,
    )

    atexit.register(_safe_close_client, client)
    return client


def _safe_close_client(client: httpx.Client) -> None:
    try:
        client.close()
    except Exception:
        return
