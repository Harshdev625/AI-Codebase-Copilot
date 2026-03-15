# Backend Documentation

## Runtime Overview

Backend service exposes API endpoints for indexing, retrieval, and agentic chat over any repository.

- Framework: FastAPI
- Orchestration: LangGraph
- Database: PostgreSQL + pgvector
- Embeddings: Ollama only

## Run Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -U pip
pip install -e .
Copy-Item .env.example .env
python run.py
```

API default: `http://localhost:8000`

## Embeddings (Ollama)

Required setup:

```bash
ollama pull mxbai-embed-large
```

Required `.env` values:

- `OLLAMA_BASE_URL`
- `OLLAMA_EMBEDDING_MODEL`
- `VECTOR_DIM` (must match model dimension)

## Indexing behavior

- `.gitignore` is respected through Git-native listing (`git ls-files --exclude-standard`) when possible
- Large files are skipped using `MAX_INDEX_FILE_SIZE_BYTES`
- Supports local repo path and repo URL cloning

## API

### POST `/v1/index`

Request supports either:

- `repo_path` (local path), or
- `repo_url` (+ optional `repo_ref`)

### POST `/v1/search`

Runs hybrid retrieval (dense + lexical + RRF).

### POST `/v1/chat`

Runs LangGraph workflow and returns answer + sources.
