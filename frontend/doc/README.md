# Frontend Documentation

## Overview

The frontend is a Next.js app that provides a chat UI for querying indexed repositories.

Implemented features:

- repository ID input
- query input
- loading and error states
- answer rendering (`answer`, `intent`, `sources`)

## Run

```bash
cd frontend
npm install
npm run dev
```

Default URL: `http://localhost:3000`

## Backend Dependency

The frontend calls `POST /api/chat`, which proxies to backend `POST /v1/chat`.

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
