# Testing & Verification

This document describes how to run automated tests locally and what CI enforces on every pull request.

---

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes to `main` and on all pull requests:

| Job | Command | Working directory |
|---|---|---|
| Backend tests + coverage | `pytest tests/unit --cov=app --cov-report=xml --cov-report=term-missing` | `backend/` |
| Frontend tests + coverage | `npm run test:coverage` | `frontend/` |
| Frontend build | `npm run build` | `frontend/` |

---

## Backend (Pytest)

### Setup

```bash
cd backend
pip install -e ".[dev]"
```

### Run unit tests (CI-equivalent)

```bash
cd backend
python -m pytest tests/unit --cov=app --cov-report=term-missing
```

### Run a single file or test

```bash
python -m pytest tests/unit/test_hybrid_retrieval.py -v
python -m pytest tests/unit/test_api_models.py::test_chat_request_valid -q
```

### Test layout

```
backend/tests/
├── conftest.py              # Shared fixtures (in-memory SQLite, mocks)
├── unit/                    # Primary suite — 50+ modules, run in CI
│   ├── test_auth_routes.py
│   ├── test_repository_routes.py
│   ├── test_chat_routes.py
│   ├── test_act_*.py        # ACT patch lifecycle, sandbox, validation
│   ├── test_hybrid_retrieval.py
│   ├── test_indexing_service*.py
│   └── ...
├── integration/             # Opt-in live API tests (not run in CI by default)
│   └── test_api_endpoints.py
└── e2e/                     # SQLite-backed end-to-end chat tests
    └── test_chat_sqlite_e2e.py
```

### Opt-in integration tests

Live API integration tests are disabled by default to avoid writing synthetic data into shared databases:

```powershell
$Env:RUN_LIVE_INTEGRATION_TESTS = "1"
$Env:LIVE_API_BASE_URL = "http://127.0.0.1:8000/v1"
python -m pytest tests/integration/test_api_endpoints.py -q
```

### What backend tests cover

- Authentication, JWT validation, and admin secret-key registration
- Repository CRUD, indexing queue, snapshot diffing, file/tree explorer
- Chat routes, streaming envelopes, and query service orchestration
- ACT patch validate/apply lifecycle, sandbox manager, conflict detection
- Hybrid RAG retrieval (BM25 + dense + RRF), Qdrant service, embeddings
- LangGraph planner/reasoning nodes, indexing worker edge cases
- Admin authorization and dashboard metrics

---

## Frontend (Jest)

### Setup

```bash
cd frontend
npm ci
```

### Run unit tests

```bash
cd frontend
npm test                  # Jest with --forceExit (avoids open-handle hangs)
npm run test:coverage     # CI-equivalent — enforces coverage thresholds
npm run test:watch        # Watch mode
```

### Coverage thresholds

Configured in `frontend/jest.config.js`:

| Metric | Minimum |
|---|---|
| Statements | 72% |
| Lines | 73% |
| Branches | 54% |
| Functions | 63% |

Studio, workspace shell, and several large UI modules are excluded from coverage collection until dedicated tests land. See `collectCoverageFrom` in `jest.config.js` for the full exclusion list.

### Test layout

```
frontend/tests/
├── unit/                    # 34 suites — hooks, services, components, stores
│   ├── chat-service.test.ts
│   ├── chat-workspace.test.tsx
│   ├── studio-store.test.ts
│   ├── feature-flags.test.ts
│   └── ...
├── integration/             # Auth and admin page flows
│   ├── auth-pages.test.tsx
│   └── admin-page.test.tsx
├── e2e/                     # Playwright (not wired to npm scripts yet)
│   └── engineering_workspace.spec.ts
└── __mocks__/               # Monaco, markdown, diff-viewer mocks
```

### Run a single test file

```bash
npm test -- tests/unit/chat-shell.test.tsx
```

### Type check and lint

```bash
npx tsc --noEmit
npm run lint
```

### Playwright E2E (manual)

A Playwright spec exists at `tests/e2e/engineering_workspace.spec.ts` but there is no `npm run test:e2e` script yet. Run Playwright directly when the dev server is up:

```bash
npx playwright test tests/e2e/engineering_workspace.spec.ts
```

---

## Manual Verification Checklist

Use this before merging large UI or ACT-mode changes:

### Authentication

- [ ] Register a user at `/register` and sign in at `/login`
- [ ] Confirm protected routes (`/dashboard`, `/workspace`, `/studio`) redirect when logged out
- [ ] Create an admin via `/admin/register` (requires `ADMIN_REGISTRATION_SECRET_KEY`)

### Repository & indexing

- [ ] Add a repository from the dashboard
- [ ] Trigger indexing and confirm progress updates (`POST /v1/index`)
- [ ] File tree populates after indexing completes

### Studio / workspace

- [ ] With `NEXT_PUBLIC_STUDIO_ENABLED=true`, `/studio` loads the 4-region layout
- [ ] Explorer opens files in the Monaco editor canvas
- [ ] Session sidebar lists, pins, and archives sessions

### Chat & context

- [ ] Send a message in ASK mode; SSE stream renders incrementally (`POST /v1/chat/stream`)
- [ ] Repository-scoped question returns cited file chunks
- [ ] Add a file to session context; token budget updates in ContextPanel

### ACT patches

- [ ] ACT mode generates a patch draft
- [ ] Validate patch (`POST /v1/repositories/{id}/patches/{patch_id}/validate`)
- [ ] Review diff in patch-review canvas; apply when approved

---

## Documentation rule

When routes, payloads, env vars, or test commands change, update the relevant file in `docs/` in the same change.
