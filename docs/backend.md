# Backend Guide

## Purpose

The backend exposes the core API for authentication, projects, repositories, conversations, chat, search, indexing, tools, and admin reporting.

## Run Backend

```bash
cd backend
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -U pip
pip install -e .[dev]
python run.py
```

Base URL: `http://localhost:8000`
OpenAPI docs: `http://localhost:8000/docs`

## Main Dependencies

- FastAPI
- SQLAlchemy
- LangGraph
- psycopg
- pgvector
- tree-sitter
- httpx
- redis

## Route Groups

### Authentication

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`

Register payload:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Example User"
}
```

Login payload:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Projects and Repositories

- `GET /v1/projects`
- `POST /v1/projects`
- `GET /v1/projects/{project_id}/repositories`
- `POST /v1/projects/{project_id}/repositories`

Create project payload:

```json
{
  "name": "My Project",
  "description": "Internal code intelligence workspace"
}
```

Add repository payload:

```json
{
  "repo_id": "ai-codebase-copilot",
  "remote_url": "https://github.com/owner/repo",
  "local_path": "E:/repos/ai-codebase-copilot",
  "default_branch": "main"
}
```

### Conversations and Messages

- `POST /v1/projects/{project_id}/conversations`
- `GET /v1/conversations/{conversation_id}/messages`
- `POST /v1/conversations/{conversation_id}/messages`

Create conversation payload:

```json
{
  "title": "Authentication flow review"
}
```

Create message payload:

```json
{
  "repo_id": "ai-codebase-copilot",
  "query": "Where is JWT validation implemented?"
}
```

### Search and Chat

- `POST /v1/search`
- `POST /v1/chat`

Search payload:

```json
{
  "repo_id": "ai-codebase-copilot",
  "query": "Find authentication middleware",
  "top_k": 5
}
```

Chat payload:

```json
{
  "repo_id": "ai-codebase-copilot",
  "query": "Explain how repository access is enforced."
}
```

### Indexing

- `POST /v1/index`

Index payload:

```json
{
  "repo_id": "ai-codebase-copilot",
  "repo_path": "E:/repos/ai-codebase-copilot",
  "repo_url": "https://github.com/owner/repo",
  "repo_ref": "main",
  "commit_sha": "optional-commit-sha"
}
```

### Tools

- `POST /v1/tools/execute`

Supported tool names:

- `read_file`
- `git_status`
- `run_command`

### Admin

- `GET /v1/admin/users`
- `GET /v1/admin/repositories`
- `GET /v1/admin/indexing-status`
- `GET /v1/admin/agent-runs`
- `GET /v1/admin/system-metrics`

## Backend Notes

- All protected routes require `Authorization: Bearer <token>`.
- Backend routers are mounted under `/v1`.
- Database schema is initialized during application startup.
- The query path depends on repository access checks before retrieval or chat execution.

## Environment Variables

The backend reads configuration primarily from `app/core/config.py` but common environment variables include:

- `DATABASE_URL` — SQLAlchemy database URL (e.g., `postgresql+psycopg://postgres:mypassword@localhost:5432/aicc`).
- `QDRANT_URL` — URL for Qdrant vector service (if used).
- `PGVECTOR_DSN` — optional DSN for pgvector-backed storage.
- `OLLAMA_URL` — host for Ollama local model server (e.g., `http://localhost:11434`).
- `REDIS_URL` — URL for Redis if used for job queues or caching.
- `SENTRY_DSN` — optional for error reporting.

Create a local `.env` (or export variables) when running locally. Example `.env` snippet:

```
DATABASE_URL=postgresql+psycopg://postgres:mypassword@localhost:5432/aicc
OLLAMA_URL=http://localhost:11434
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379/0
```

## Running with Docker Compose (infrastructure)

To run Postgres, Qdrant, Redis and Ollama locally for a full integration environment, use the `infra/compose.yaml` file:

```bash
cd infra
docker compose up -d
```

After infra is up, ensure `DATABASE_URL` and other env vars point at the running services.

## Notes on Development and Debugging

- The development server is started by `python run.py` which launches Uvicorn with auto-reload.
- For local debugging of migrations or schema work, prefer running commands in the `.venv`.
- When adding new dependencies, update `pyproject.toml` and the `dev` extras for reproducible dev installs.
