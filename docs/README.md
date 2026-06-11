# AI Codebase Copilot

An open-source, self-hosted AI engineering studio for exploring, understanding, and modifying large codebases using local LLMs.

---

## Features

- **Semantic code search** — Hybrid BM25 + dense vector retrieval over indexed repositories
- **AI chat** — ASK, PLAN, and ACT modes backed by any Ollama-compatible model
- **ACT patches** — AI-generated code patches with validation, conflict detection, and one-click apply
- **Unified Copilot Studio** — VS Code-inspired layout with file explorer, search, snapshot comparison, and patch review
- **Repository snapshots** — Point-in-time snapshots with file-level diff viewer
- **Context management** — Pin files/chunks to chat sessions with token budget visibility
- **Session management** — Pin, archive, search, and organize chat sessions
- **Admin dashboard** — User management, indexing status, system health monitoring
- **Multi-repository queries** — Query across multiple indexed repositories simultaneously

---

## Quick Start

### Local development

```bash
# 1. Start infrastructure (Postgres, Redis, Qdrant, Ollama)
docker compose -f infra/compose.yaml up -d

# 2. Configure + start backend
cd backend && cp .env.example .env
python run.py          # API server :8000

# 3. Start background worker (separate terminal)
cd backend && python run_worker.py

# 4. Configure + start frontend
cd frontend && cp .env.example .env
npm install && npm run dev  # :3000
```

See [docs/deployment.md](deployment.md) for full production deployment.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, Zustand, TanStack Query |
| Backend | FastAPI, SQLAlchemy, Pydantic v2, Python 3.11 |
| Vector Search | Qdrant + pgvector, HybridSearch (BM25 + dense), RRF fusion |
| LLM | Ollama (local) — any compatible model |
| Database | PostgreSQL 16 + pgvector extension |
| Queue | Redis + RQ (Python) |
| Containers | Docker + Docker Compose |

---

## Documentation

| Document | Description |
|---|---|
| [architecture.md](architecture.md) | System design, data model, auth flow, Mermaid diagrams |
| [deployment.md](deployment.md) | Production deployment, Docker Compose, nginx, troubleshooting |
| [backend.md](backend.md) | Backend API reference, route catalog |
| [frontend.md](frontend.md) | Frontend feature guide, component map, state management |
| [flow.md](flow.md) | End-to-end user workflow diagrams |
| [langgraph.md](langgraph.md) | LangGraph agent pipeline and node reference |
| [testing.md](testing.md) | Running unit tests, CI commands, manual checklist |
| [Coverage.md](Coverage.md) | Latest coverage metrics and verification commands |
| [postman_collection.json](postman_collection.json) | Postman API collection for manual exploration |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_ENV` | No | `development` | Set to `production` to enable security enforcement |
| `JWT_SECRET_KEY` | **Yes** | `change-me-in-production` | Random 64-char secret for JWT signing |
| `POSTGRES_HOST` | Yes | `localhost` | PostgreSQL host |
| `POSTGRES_DB` | Yes | `aicc` | Database name |
| `POSTGRES_USER` | Yes | `postgres` | Database user |
| `POSTGRES_PASSWORD` | Yes | `mypassword` | Database password |
| `REDIS_HOST` | Yes | `localhost` | Redis host |
| `QDRANT_HOST` | Yes | `localhost` | Qdrant host |
| `OLLAMA_BASE_URL` | Yes | `http://localhost:11434` | Ollama API base URL |
| `CORS_ALLOW_ORIGINS` | **Yes in prod** | `http://localhost:3000` | Allowed origins (comma-separated) |
| `ADMIN_REGISTRATION_SECRET_KEY` | No | *(empty)* | Enables admin registration; leave empty to disable |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | — | Backend API base URL (must include `/v1`, e.g. `http://localhost:8000/v1`) |
| `NEXT_PUBLIC_API_BASE_URL` | No | — | Alias for `NEXT_PUBLIC_API_URL`; used by `getFrontendApiBase()` |
| `API_INTERNAL_URL` | No | — | Server-side API URL (SSR); defaults to `NEXT_PUBLIC_API_URL` |

---

## License

MIT
