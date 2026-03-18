# Frontend Guide

## Purpose

The frontend provides the user-facing application for registration, login, dashboard access, repository management, repository chat, and admin monitoring.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:3000`

Flow diagram (Mermaid)

```mermaid
sequenceDiagram
  participant U as User
  participant F as NextJS_Frontend
  participant B as FastAPI_Backend
  U->>F: POST /api/auth/login
  U->>F: POST /api/projects (create/select)
  U->>F: POST /api/projects/:id/repositories (add repo)
  U->>F: POST /api/index (trigger)
  F->>B: POST /v1/index (proxy)
  B-->>F: 202 Accepted
  Note over B: Background indexing job writes to Postgres and Qdrant
  U->>F: POST /api/chat
  F->>B: POST /v1/chat
  B-->>F: chat answer
```

## Application Routes

### Public Routes

- `/`
- `/login`
- `/register`

### Protected Routes

- `/dashboard`
- `/repositories`
- `/chat`

### Admin Route

- `/admin`

Route protection is handled in `src/components/app-shell.tsx`.

Rules:

- missing token or user redirects to `/login`
- non-admin access to `/admin` redirects to `/dashboard`

## User Flows

### Login

The login page posts to the frontend proxy route:

- `POST /api/auth/login`

Expected payload:

```json
{
  "email": "admin@aicc.dev",
  "password": "password123"
}
```

### Registration

The registration page calls:

- `POST /api/auth/register`
- `POST /api/auth/login`

Expected payload:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Example User"
}
```

### Repository Management

The repositories page lets a user:

- create a project
- select a project
- add a repository to the selected project
- refresh the repository list

Repository form fields:

- `repo_id`
- `remote_url`
- `local_path`
- `default_branch`

### Chat

The chat page uses the shared chat shell and sends repository-scoped queries through:

- `POST /api/chat`

Payload:

```json
{
  "repo_id": "ai-codebase-copilot",
  "query": "Explain the indexing flow"
}
```

### Admin Dashboard

The admin page retrieves:

- `GET /api/admin/system-metrics`
- `GET /api/admin/users`

It displays metrics, registered users, and service status cards.

## Frontend API Proxy Routes

Current proxy handlers in `src/app/api`:

- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/me`
- `/api/projects`
- `/api/projects/[projectId]/repositories`
- `/api/chat`
- `/api/admin/system-metrics`
- `/api/admin/users`

These routes forward requests to the backend base URL defined in `src/lib/backend-url.ts`.

## Frontend Notes

- Backend URL defaults to `http://localhost:8000/v1`.
- Session state is stored client-side.
- The dashboard behavior changes by role: admins see platform metrics, non-admins see project summaries.

Quick dev start (Windows PowerShell)

```powershell
cd frontend
npm install
npm run dev
```

Environment variables

- `NEXT_PUBLIC_API_URL` — browser-accessible backend base URL (e.g. `http://localhost:8000/v1`)
- `API_INTERNAL_URL` — server-side internal URL used by Next proxy routes when available

If you run the backend in Docker and the frontend on the host, set `NEXT_PUBLIC_API_URL` to the host-accessible backend address.

Indexing and proxy routes

- The frontend uses lightweight proxy routes under `/api/*` to forward requests to the backend base URL configured by `frontend/src/lib/backend-url.ts`.
- The repository UI triggers `POST /api/index` which forwards to the backend `POST /v1/index` endpoint. The backend now returns `202 Accepted` and performs indexing in the background; the UI will show an indexing status badge.



## Environment Variables and Configuration

Set runtime configuration via environment variables. Important values:

- `NEXT_PUBLIC_API_URL` — public URL used by the browser to reach the backend (e.g., `http://localhost:8000/v1`).
- `API_INTERNAL_URL` — internal backend URL used when server-side code needs to reach the backend (the codebase prefers `API_INTERNAL_URL` when present).

Example for local development (Unix/macOS):

```bash
export NEXT_PUBLIC_API_URL='http://localhost:8000/v1'
```

On Windows PowerShell:

```powershell
$Env:NEXT_PUBLIC_API_URL = 'http://localhost:8000/v1'
```

## Production Build

To build and preview a production-ready frontend:

```bash
cd frontend
npm install --production
npm run build
npm run start
```

Ensure `NEXT_PUBLIC_API_URL` points to the production backend base URL.
