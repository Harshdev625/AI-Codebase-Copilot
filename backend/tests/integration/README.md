# Backend integration tests

## SQLite TestClient (default, no extra setup)

Runs with the shared `tests/conftest.py` fixtures:

```bash
cd backend
python -m pytest tests/e2e -q
```

These exercises auth → dashboard → repositories → chat session flows against in-memory SQLite.

## Live API (opt-in)

`test_api_endpoints.py` hits a running backend at `http://127.0.0.1:8000`.

```bash
# Terminal 1
uvicorn app.main:app --reload

# Terminal 2
cd backend
set RUN_LIVE_INTEGRATION_TESTS=1
python -m pytest tests/integration -m live_integration -q
```

Optional: `LIVE_API_BASE_URL` (default `http://127.0.0.1:8000/v1`).

Live tests are **deselected** unless `RUN_LIVE_INTEGRATION_TESTS=1`.
