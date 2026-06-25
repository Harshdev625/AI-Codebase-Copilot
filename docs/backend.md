# Backend API Reference

## Base URL

Development: `http://localhost:8000/v1`

Health check (no auth): `GET /health`

All `/v1/*` endpoints require `Authorization: Bearer <JWT>` unless noted.

Responses use the envelope format `{ "success": true, "data": ... }` or paginated `{ "success": true, "data": { "items", "total", "limit", "offset" } }`.

---

## Authentication

### POST `/v1/auth/register`
Create a new user account.

**Body:**
```json
{ "email": "user@example.com", "password": "...", "full_name": "..." }
```

**Response:** `UserResponse`

---

### POST `/v1/auth/admin/register`
Create a new admin account (requires `ADMIN_REGISTRATION_SECRET_KEY` in server env).

Alias: `POST /v1/admin/auth/register`

**Body:**
```json
{ "email": "admin@example.com", "password": "...", "full_name": "...", "admin_secret_key": "..." }
```

---

### POST `/v1/auth/login`
Obtain a JWT access token for a regular user.

**Body:** `{ "email": "...", "password": "..." }`  
**Response:** `{ "access_token": "...", "token_type": "bearer" }`

Admin login: `POST /v1/auth/admin/login` (alias: `POST /v1/admin/auth/login`)

---

### GET `/v1/auth/me`
Returns the current authenticated user.

---

## Indexing

### POST `/v1/index`
Enqueue an indexing job for a repository.

**Body:**
```json
{
  "repository_id": "<uuid>",
  "repo_id": "optional-slug",
  "commit_sha": "optional",
  "repo_url": "optional override",
  "repo_ref": "optional branch/tag"
}
```

**Response:** `202 Accepted` — `{ "indexing_job_id": "...", "indexed_chunks": 0 }`

---

### GET `/v1/index/progress/{indexing_job_id}`
Poll indexing job progress (phase, percent, stats).

---

### GET `/v1/indexing-jobs`
List recent indexing jobs for the current user.

---

## Repositories

### GET `/v1/repositories`
List repositories owned by the authenticated user.

Query params: `limit`, `offset`

---

### POST `/v1/repositories`
Add a new repository.

**Body:**
```json
{ "repo_url": "https://github.com/org/repo", "default_branch": "main" }
```

---

### GET `/v1/repositories/{repository_id}/insights`
Repository health, language breakdown, file counts, and latest job status.

---

### POST `/v1/{repository_id}/context-tokens`
Calculate token budget for a requested context scope.

**Body:** `ContextTokensRequest` — session scope paths and optional file list.

---

### GET `/v1/repositories/{repository_id}/file`
Read file content at a specific commit SHA.

Query params: `path` (required), `commit_sha` (optional)

---

### GET `/v1/repositories/{repository_id}/tree`
Directory tree for explorer (cursor-paginated).

Query params: `path`, `snapshot_id`, `commit_sha`, `cursor`, `limit`

---

### POST `/v1/repositories/{repository_id}/retrieve`
Hybrid semantic + keyword search over indexed chunks.

**Body:** `{ "query": "...", "top_k": 10, "scope_paths": [] }`

---

### GET `/v1/repositories/{repository_id}/snapshots`
List point-in-time snapshots for a repository.

---

### PATCH `/v1/repositories/{repository_id}/snapshots/{snapshot_id}`
Update snapshot label/metadata.

---

### GET `/v1/repositories/{repository_id}/snapshots/{snapshot_id}/diff`
Compare two snapshots.

Query params: `compare_with` (required — second snapshot ID)

Returns `{ added, removed, modified, renamed }` file lists.

---

## ACT Patches

### GET `/v1/repositories/{repository_id}/patches`
List ACT patch drafts for a repository.

---

### POST `/v1/repositories/{repository_id}/patches`
Create a patch draft manually (ACT workflow).

---

### GET `/v1/repositories/{repository_id}/patches/{patch_id}`
Get a patch with file diffs; `original_content` populated from git when available.

---

### POST `/v1/repositories/{repository_id}/patches/{patch_id}/validate`
Validate a patch draft (lint, tests, conflict check).

---

### POST `/v1/repositories/{repository_id}/patches/{patch_id}/apply`
Apply an approved patch to the repository working tree.

---

### DELETE `/v1/repositories/{repository_id}/patches/{patch_id}`
Delete a patch draft.

---

## Session Context (repository router)

Context entries are scoped to chat sessions but live under the repositories router prefix:

### GET `/v1/sessions/{session_id}/context`
List context entries for a session.

---

### POST `/v1/sessions/{session_id}/context`
Add a file or chunk to session context (with token budgeting / pruning).

**Body:** `ContextEntryCreate` — `repository_id`, `path`, `entry_type`, `token_count`, `is_pinned`, `priority`, `expires_at`

---

### DELETE `/v1/sessions/{session_id}/context/{entry_id}`
Remove a context entry.

---

## Chat (`/v1/chat` prefix)

Sessions are created implicitly on the first chat message when `session_id` is omitted.

### GET `/v1/chat/sessions`
List chat sessions.

Query params: `limit`, `offset`, `repository_id`, `search` (title or summary), `is_archived`

---

### GET `/v1/chat/sessions/{session_id}`
Get a specific session.

---

### PATCH `/v1/chat/sessions/{session_id}`
Update session metadata.

**Body (partial):** `{ "session_title": "...", "is_pinned": true, "is_archived": false }`

---

### DELETE `/v1/chat/sessions/{session_id}`
Delete a session and its messages.

---

### GET `/v1/chat/sessions/{session_id}/messages`
List messages in a session.

Query params: `limit` (max 100), `offset`

---

### POST `/v1/chat`
Send a chat message (non-streaming). Runs LangGraph + retrieval pipeline.

**Body:** `ChatRequest` — `query`, `repository_id` or `repo_id`, optional `session_id`, `mode` (`ASK|PLAN|ACT`), `scope_paths`

**Response:** `ChatResponse` — `answer`, `intent`, `session_id`, `sources`

---

### POST `/v1/chat/stream`
Same as `/v1/chat` but returns Server-Sent Events (newline-delimited JSON envelopes).

---

### POST `/v1/chat/apply-patch`
Legacy direct diff apply to a repo path (prefer repository patch endpoints for ACT mode).

---

## Dashboard

### GET `/v1/dashboard/me`
User dashboard summary (repository counts, recent activity).

---

## Admin Endpoints

All require `ADMIN` role.

| Method | Path | Description |
|---|---|---|
| GET | `/v1/admin/users` | List all users |
| POST | `/v1/admin/users/{user_id}/role` | Change user role (`ADMIN` / `USER`) |
| POST | `/v1/admin/users/{user_id}/status` | Enable/disable user |
| DELETE | `/v1/admin/users/{user_id}` | Delete user |
| GET | `/v1/admin/repositories` | List all repositories |
| GET | `/v1/admin/indexing-status` | Active/recent indexing jobs |
| GET | `/v1/admin/system-metrics` | CPU, memory, queue depth |
| GET | `/v1/admin/runtime-metrics` | Process-level runtime stats |
| GET | `/v1/admin/service-health` | Health of Postgres, Redis, Qdrant, Ollama |
| GET | `/v1/admin/recent-activity` | Recent users, jobs, sessions |
| GET | `/v1/admin/telemetry` | Usage telemetry |
| GET | `/v1/admin/usage-overview` | Aggregated usage overview |
| GET | `/v1/admin/billing-events` | Billing event log |
| GET | `/v1/admin/architecture-graph` | Service dependency graph data |

---

## Disabled endpoints (410 Gone)

Project-scoped multi-repo **CRUD** APIs return `410`:

- `GET/POST /v1/projects`
- `DELETE /v1/projects/{project_id}`
- `GET/POST /v1/projects/{project_id}/repositories`

**Still active:** `POST /v1/projects/{project_id}/retrieve` (server-side federated retrieval; reserved for future use).

### Multi-repo federation model

- **Repositories** are the indexed unit (`POST /v1/repositories`, per-repo index jobs).
- **Studio Federated Scope** (frontend) selects multiple repository IDs and runs parallel `POST /v1/repositories/{id}/retrieve` calls client-side.
- There is no dashboard “project grouping” entity in the simplified schema; use repository-centric navigation instead.

Use per-repository endpoints for CRUD and indexing.

---

## Webhooks

### POST `/v1/webhooks/github`
GitHub push webhook handler (triggers re-index when configured).

---

## Error Responses

Structured errors:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

FastAPI validation errors may also return `{ "detail": "..." }` for 400/409/503 responses.

| HTTP | Typical meaning |
|---|---|
| 400 | Invalid request body |
| 401 | Missing or invalid JWT |
| 403 | Insufficient permissions / scopes |
| 404 | Resource not found |
| 409 | Conflict (duplicate job, no context, etc.) |
| 410 | Feature disabled |
| 503 | LLM or external service unavailable |

---

## Background worker

Indexing jobs are processed by `python run_worker.py` (RQ worker on Redis). The API server only enqueues jobs; it does not block on indexing completion.

See [deployment.md](deployment.md) for production worker setup.
