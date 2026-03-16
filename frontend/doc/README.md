# Frontend Documentation

## Overview

The frontend is a Next.js app that provides a chat UI for querying indexed repositories.

Implemented features:

- Login page (`/login`)
- Dashboard (`/dashboard`)
- Repository management (`/repositories`)
- AI chat interface (`/chat`)
- Admin dashboard (`/admin`)
- answer rendering (`answer`, `intent`, `sources`)

## Run

```bash
cd frontend
npm install
npm run dev
```

Default URL: `http://localhost:3000`

## Backend Dependency

The frontend proxies:

- `POST /api/chat` → backend `POST /v1/chat`
- `POST /api/auth/login` → backend `POST /v1/auth/login`
- `GET /api/projects/{projectId}/repositories` → backend project repositories
- `GET /api/admin/system-metrics` → backend admin metrics

Ensure backend is running at `http://localhost:8000` unless overridden in frontend env.

## Tests

```bash
cd frontend
npm test
```

## Troubleshooting

- If chat fails, verify backend health and Ollama availability.
- If source list is empty, ensure repository indexing completed first.
- Use browser dev tools network tab to inspect `/api/chat` errors.
