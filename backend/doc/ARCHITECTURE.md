# Backend Architecture

## Components

- **FastAPI API Layer**: exposes `/v1/index`, `/v1/search`, `/v1/chat`, `/v1/tools/execute`
- **Indexing Service**: resolves local/remote repos, applies Git-aware file listing, chunks code, writes vectors
- **Embedding Provider**: Ollama embeddings (`/api/embeddings`)
- **Hybrid Retrieval**: vector cosine search + PostgreSQL full-text search + Reciprocal Rank Fusion
- **LangGraph Workflow**: planner, retrieval, tool execution, code understanding, patch generation, answer
- **Persistence**: PostgreSQL table `code_chunks` with `VECTOR(1024)` and full-text index

## End-to-End Flow

1. Client calls `/v1/index` with `repo_path` or `repo_url`.
2. Backend gathers files via `git ls-files --exclude-standard`, chunks code, creates embeddings, and upserts into `code_chunks`.
3. Client calls `/v1/search` or `/v1/chat`.
4. Retrieval layer runs dense + lexical lookup and fuses rankings.
5. LangGraph nodes produce analysis/answer payload returned to client.

## Workflow Routing

```
planner
  ├─ intent=tool  -> tool_execution -> code_understanding -> answer
  └─ otherwise    -> retrieval      -> code_understanding -> (patch_generation or answer)
```

## Data Model

`code_chunks` stores:

- identity and source metadata (`id`, `repo_id`, `commit_sha`, `path`, `symbol`, `chunk_type`, line range)
- raw content (`content`, `metadata`)
- vector embedding (`embedding VECTOR(1024)`)

## Operational Notes

- `.gitignore` and Git excludes are respected during indexing
- maximum indexed file size is configurable via `MAX_INDEX_FILE_SIZE_BYTES`
- repository clones are cached in `backend/.repo_cache`
- Ollama connectivity failures are surfaced as API `503` errors
