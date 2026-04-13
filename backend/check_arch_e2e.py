"""End-to-end architecture-answer validation.

This script:
- registers a fresh user
- logs in
- creates a project
- adds a local repository
- triggers indexing and waits for completion
- asks an architecture question via /v1/chat

It prints:
- the intent
- the first ~800 chars of the answer
- the top sources (paths/kinds/scores)

Run (PowerShell):
  & "./.venv/Scripts/python.exe" ./check_arch_e2e.py
"""

from __future__ import annotations

import argparse
import sys
import time
import uuid

import httpx


def _must(resp: httpx.Response, label: str) -> dict:
    try:
        resp.raise_for_status()
    except Exception as exc:  # pragma: no cover
        print(f"\n--- {label} FAILED ---")
        print("status:", resp.status_code)
        print(resp.text)
        raise RuntimeError(f"{label} failed") from exc

    payload = resp.json()
    if not payload.get("success", False):
        raise RuntimeError(f"{label} returned success=false: {payload}")
    return payload["data"]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Validate architecture Q&A end-to-end")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000/v1")
    parser.add_argument("--local-path", default=r"e:\\Projects\\AI Codebase Copilot")
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=300.0,
        help="HTTP client timeout. Chat may take >60s on local Ollama.",
    )
    parser.add_argument(
        "--query",
        default=(
            "Explain this project's architecture at a high level. "
            "Cover backend, frontend, infra, and how indexing+chat works. "
            "If something is unknown, say so."
        ),
    )
    parser.add_argument("--poll-seconds", type=int, default=600)
    args = parser.parse_args(argv)

    email = f"e2e-{uuid.uuid4().hex[:10]}@example.com"
    password = "Passw0rd!" + uuid.uuid4().hex[:6]
    project_name = "E2E Architecture " + uuid.uuid4().hex[:6]
    repo_id = "local/aicc-" + uuid.uuid4().hex[:8]

    timeout = httpx.Timeout(args.timeout_seconds, connect=10.0)
    client = httpx.Client(timeout=timeout)

    print("Registering:", email)
    _must(
        client.post(
            f"{args.base_url}/auth/register",
            json={"email": email, "password": password, "full_name": "E2E User"},
        ),
        "register",
    )

    token = _must(
        client.post(
            f"{args.base_url}/auth/login",
            json={"email": email, "password": password},
        ),
        "login",
    )["access_token"]

    headers = {"Authorization": f"Bearer {token}"}

    project = _must(
        client.post(
            f"{args.base_url}/projects",
            headers=headers,
            json={"name": project_name, "description": "E2E architecture validation"},
        ),
        "create_project",
    )
    project_id = project["id"]
    print("Project:", project_id)

    repo = _must(
        client.post(
            f"{args.base_url}/projects/{project_id}/repositories",
            headers=headers,
            json={
                "repo_id": repo_id,
                "local_path": args.local_path,
                "default_branch": "main",
            },
        ),
        "add_repository",
    )
    repository_id = repo["id"]
    print("Repository:", repo_id, repository_id)

    idx = _must(
        client.post(
            f"{args.base_url}/index",
            headers=headers,
            json={"repository_id": repository_id},
        ),
        "index",
    )
    snapshot_id = idx.get("snapshot_id")
    print("Index snapshot:", snapshot_id)

    # Poll progress
    status = None
    last = None
    for i in range(max(1, int(args.poll_seconds))):
        prog = _must(
            client.get(
                f"{args.base_url}/index/progress/{snapshot_id}",
                headers=headers,
            ),
            "progress",
        )
        last = prog
        status = prog.get("index_status")
        if status in {"completed", "failed"}:
            break
        if i % 5 == 0:
            pct = prog.get("percentage")
            msg = prog.get("message")
            print(f"  progress: {status} {pct}% - {msg}")
        time.sleep(1.0)

    print("Index status:", status)
    if status != "completed":
        print("Index did not complete. Last progress payload:\n", last)
        return 2

    chat = _must(
        client.post(
            f"{args.base_url}/chat",
            headers=headers,
            json={"repository_id": repository_id, "query": args.query},
        ),
        "chat",
    )

    answer = chat.get("answer", "")
    intent = chat.get("intent")
    sources = chat.get("sources") or []

    print("\nIntent:", intent)
    print("Answer (first 800 chars):\n", answer[:800])
    print("\nSources:")
    for s in sources[:10]:
        path = s.get("path") or s.get("file_path") or s.get("source") or s.get("id")
        score = s.get("score")
        kind = s.get("kind")
        print(" -", {"path": path, "kind": kind, "score": score})

    print("\nTotal sources:", len(sources))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
