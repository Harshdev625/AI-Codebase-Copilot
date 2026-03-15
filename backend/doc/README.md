# Backend Documentation

## Runtime Overview

The backend exposes APIs for repository indexing, hybrid search, chat, and tool execution.

- Framework: FastAPI
- Workflow: LangGraph
- Storage: PostgreSQL + pgvector
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

Default API URL: `http://localhost:8000`

## Embeddings (Ollama)

```bash
ollama pull mxbai-embed-large
```

Required `.env` keys:

- `OLLAMA_BASE_URL`
- `OLLAMA_EMBEDDING_MODEL`
- `VECTOR_DIM` (must match embedding dimension)

## Indexing Behavior

- Respects `.gitignore` via `git ls-files --exclude-standard`
- Skips large files using `MAX_INDEX_FILE_SIZE_BYTES`
- Supports local `repo_path` and remote `repo_url` (+ optional `repo_ref`)

## API Endpoints

### `POST /v1/index`

Indexes a repository from local path or Git URL.

### `POST /v1/search`

Runs hybrid retrieval: dense vector search + lexical search + RRF.

### `POST /v1/chat`

Runs the LangGraph flow and returns `answer`, `intent`, and `sources`.

### `POST /v1/tools/execute`

Supports `read_file`, `git_status`, and `run_command` (command-prefix allowlisted).

## Tests

```bash
cd backend
pytest tests/unit -v
```
