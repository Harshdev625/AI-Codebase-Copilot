# Testing

## Frontend

Run tests from the frontend directory:

```bash
cd frontend
npm test
npm run test:coverage
```

Current frontend stack uses Jest and React Testing Library.

## Backend

Run tests from the backend directory:

```bash
cd backend
pytest tests/ -v
```

Optional coverage is configured through pytest settings in `pyproject.toml`.

## What To Verify

### Frontend

- login and register flows
- route protection behavior
- admin-only access handling
- repository management interactions
- chat shell rendering and API integration

### Backend

- authentication and token validation
- project membership enforcement
- repository access checks
- indexing request handling
- chat and search behavior
- admin route authorization

## More precise test commands

Frontend (run unit tests and coverage):

```bash
cd frontend
npm ci
npm test -- --coverage
```

To run an individual frontend test file with Jest:

```bash
npm test -- tests/unit/chat-shell.test.tsx
```

Backend (setup and run tests with coverage):

```bash
cd backend
# activate venv (PowerShell)
.\.venv\Scripts\Activate.ps1
pip install -e .[dev]
python -m pytest tests/unit/ -v --cov=app --cov-report=term-missing
```

To run a single backend test file or test name:

```bash
python -m pytest tests/unit/test_api_models.py::test_chat_request_valid -q
```

## CI considerations

- Run `npm ci` to install deterministic frontend deps in CI.
- Use the pytest `--maxfail=1 -q` flags for faster feedback in PR pipelines.

## Documentation Rule

Whenever routes, payloads, or setup commands change, update the relevant docs in `docs/` in the same change.
