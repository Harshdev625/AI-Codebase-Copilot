<div align="center">

# AI Codebase Copilot

### Self-hosted code search and retrieval pipeline for any Git repository

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-Workflow-111827?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-Local%20Embeddings-000000?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-Frontend-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)

[Overview](#overview) • [Features](#features) • [Quick Start](#quick-start) • [API](#api) • [Architecture](#architecture) • [Contributing](#contributing)

</div>

---

## Overview

AI Codebase Copilot indexes any Git repository and exposes a hybrid search and retrieval API over its source code. Point it at a local path or a GitHub URL and query the codebase in natural language.

The system is built around a LangGraph pipeline with keyword-based intent routing, hybrid vector + full-text retrieval, and a tool-execution layer for safe git/shell actions. LLM integration is intentionally left as a plug-in point in the workflow nodes.

## Features

- **Hybrid retrieval** — dense cosine search (pgvector) + PostgreSQL full-text search, fused with Reciprocal Rank Fusion
- **`.gitignore`-aware indexing** — uses `git ls-files --exclude-standard` to skip build artifacts, `node_modules`, virtualenvs, and anything in `.gitignore`
- **Local + remote ingestion** — index from a local path or clone directly from a GitHub URL; clones are cached in `backend/.repo_cache`
- **AST-based chunking** — Python files are chunked by function and class boundaries using the `ast` module; all other supported file types are chunked via tree-sitter
- **Ollama embeddings** — uses `mxbai-embed-large` by default; fully local, no API key required
- **LangGraph workflow** — planner → retrieval → code_understanding → patch_generation → answer, with conditional routing
- **Tool execution endpoint** — safe execution of `read_file`, `git status`, and allowlisted shell commands via `/v1/tools/execute`
- **Large-repo safeguards** — configurable file-size cutoff and extension allowlist prevent indexing binaries and generated files

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI 0.115+ |
| Workflow | LangGraph |
| Vector DB | PostgreSQL 16 + pgvector |
| Embeddings | Ollama (`mxbai-embed-large`) |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Infrastructure | Podman / Docker Compose |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Git
- Podman or Docker
- [Ollama](https://ollama.com)

### 1. Start Postgres with pgvector

```bash
cd infra
podman compose up -d postgres
```

Apply the schema:

```bash
psql -U postgres -d aicc -f backend/scripts/init_pgvector.sql
```

### 2. Pull the embedding model

```bash
ollama pull mxbai-embed-large
```

### 3. Start the backend

```bash
cd backend
python -m venv .venv
# Windows
.\.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -U pip
pip install -e .
copy .env.example .env   # edit credentials if needed
python run.py
```

Backend: `http://localhost:8000`  
Docs: `http://localhost:8000/docs`

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:3000`

## Configuration

All settings live in `backend/.env` (copy from `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_EMBEDDING_MODEL` | `mxbai-embed-large` | Embedding model name |
| `VECTOR_DIM` | `1024` | Must match the model's output dimension |
| `POSTGRES_HOST` | `localhost` | Postgres host |
| `POSTGRES_DB` | `aicc` | Database name |
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | `mypassword` | Database password |
| `REPO_CACHE_DIR` | `.repo_cache` | Where cloned repos are stored |
| `MAX_INDEX_FILE_SIZE_BYTES` | `1000000` | Skip files larger than this |

> `VECTOR_DIM` must match the selected Ollama model. `mxbai-embed-large` outputs 1024 dimensions.

## API

### `POST /v1/index`

Index a repository. Provide either `repo_path` or `repo_url`.

```json
{ "repo_id": "myrepo", "repo_path": "/absolute/path/to/repo" }
```

```json
{ "repo_id": "myrepo", "repo_url": "https://github.com/owner/repo.git", "repo_ref": "main" }
```

Response: `{ "indexed_chunks": 1842, "status": "ok" }`

### `POST /v1/search`

```json
{ "repo_id": "myrepo", "query": "Where is the authentication middleware?", "top_k": 8 }
```

Returns ranked code chunks with `path`, `symbol`, `content`, and `score`.

### `POST /v1/chat`

```json
{ "repo_id": "myrepo", "query": "What does the planner node do?" }
```

Returns `answer`, `intent`, and `sources` (retrieved chunks). The answer node composes a response from retrieved context. Intent is classified by keyword matching: `search`, `debug`, `refactor`, `docs`, or `tool`.

### `POST /v1/tools/execute`

Execute a safe tool against the server's working directory.

```json
{ "tool_name": "git_status", "args": { "repo_path": "." } }
```

Supported tools: `read_file`, `git_status`, `run_command` (allowlisted prefixes only: `python`, `pytest`, `ruff`, `mypy`, `git`).

## Architecture

```
User query
    │
    ▼
 Planner node          (keyword intent routing)
    │
    ├─ intent=tool ──► Tool Execution node
    │
    └─ otherwise ────► Retrieval node
                          │ hybrid_retrieve (dense + lexical + RRF)
                          ▼
                    Code Understanding node
                          │
                    ┌─────┴─────┐
              refactor?         otherwise
                    │                │
             Patch node         Answer node
                    └─────┬─────┘
                          ▼
                       Response
```

**Storage** — single `code_chunks` table in PostgreSQL with:
- `embedding VECTOR(1024)` indexed with HNSW for fast cosine search
- `content` indexed with GIN for full-text search
- Upsert-on-conflict so re-indexing is safe to run repeatedly

**Chunking** — Python files use AST-level chunking (function and class nodes). All other supported file types use tree-sitter.

## Running Tests

```bash
cd backend
pytest tests/ -v
```

## Utility Scripts

Reset the database (drops all indexed data):

```bash
python backend/scripts/clear_db.py
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add or update tests for any behaviour change
4. Open a pull request
4. Open PR with clear scope and rationale

## License

Add your preferred license before publishing to GitHub.
