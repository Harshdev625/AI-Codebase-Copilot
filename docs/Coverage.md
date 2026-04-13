# Coverage and Validation Snapshot

## Latest Local Validation

- Frontend Jest suite passes locally (11/11 suites, including auth/app-shell/admin/repositories/chat coverage).
- Backend targeted route/auth regression tests pass, including new admin secret registration and admin-only login checks.
- Repository/indexing route tests and progress-response checks pass in targeted backend runs.

## Commands Used

Frontend:

```bash
cd frontend
npm test
```

Backend (PowerShell):

```powershell
cd backend
\.venv\Scripts\Activate.ps1
python -m pytest tests/unit/test_route_access.py tests/unit/test_projects_conversations_routes.py -q
```

## Notes

- Some integration tests require a running backend at `http://127.0.0.1:8000`.
- Full coverage percentages vary based on selected test scope (targeted vs full-suite execution).
