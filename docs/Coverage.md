# Coverage and Verification Snapshot

Last verified locally against the current `main` branch working tree.

---

## Backend (Pytest)

| Metric | Value |
|---|---|
| Tests | **444 passed** |
| Total coverage | **71%** (`app/`) |
| CI command | `pytest tests/unit --cov=app --cov-report=term-missing` |

### Notable module coverage

| Module | Coverage |
|---|---|
| `app/rag/retrieval/hybrid.py` | ~77% |
| `app/services/qdrant_service.py` | ~93% |
| `app/services/sandbox_manager.py` | ~76% |
| `app/services/patch_lifecycle_service.py` | ~85% |
| `app/services/validation_engine.py` | ~83% |
| `app/api/v1/repositories/router.py` | ~74% |
| `app/services/query_service.py` | ~70% |

### Lower-coverage areas (expected)

- `app/workers/indexing_worker.py` — exercised via service-layer tests, not the worker entrypoint
- `app/tools/git_tools.py`, `terminal_tools.py` — thin wrappers around subprocess calls
- `app/services/validation_providers.py` — provider-specific branches

---

## Frontend (Jest)

| Metric | Value |
|---|---|
| Test suites | **37 passed** |
| Tests | **176 passed** |
| Statements | **72.84%** |
| Lines | **74.45%** |
| Branches | **54.30%** |
| Functions | **63.90%** |
| CI command | `npm run test:coverage` |

Thresholds in `jest.config.js` (statements 72%, lines 73%, branches 54%, functions 63%) are met.

### Excluded from coverage collection

Studio shell, workspace shell, explorer tree, several repository components, and layout shells are temporarily excluded. See `collectCoverageFrom` in `frontend/jest.config.js`.

---

## Reproduce locally

### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest tests/unit --cov=app --cov-report=term-missing
```

### Frontend

```bash
cd frontend
npm run test:coverage
```

### Full CI parity

```bash
# Backend
cd backend && pytest tests/unit --cov=app

# Frontend
cd frontend && npm run test:coverage && npm run build
```

---

## Known gaps

| Area | Status |
|---|---|
| Playwright E2E (`engineering_workspace.spec.ts`) | Spec exists; not in CI |
| Studio / workspace UI shells | Excluded from Jest coverage |
| LangGraph stochastic routing | Unit-tested at node level; no eval suite |
| Live integration API tests | Opt-in via `RUN_LIVE_INTEGRATION_TESTS=1` |
