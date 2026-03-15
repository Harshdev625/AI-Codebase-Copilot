# Frontend Architecture

## Current Scope

The frontend currently implements a chat-first experience.

- single page rendered by `app/page.tsx`
- primary client component `components/chat-shell.tsx`
- API helper `lib/api.ts` for calling `/api/chat`

## UI Responsibilities

- collect `repo_id` and `query`
- submit chat requests
- show loading state (`Thinking...`)
- show backend errors
- render answer text, intent label, and retrieved source list

## Data Flow

```
User input
   -> ChatShell submit
   -> sendChat(payload)
   -> /api/chat (frontend route)
   -> backend /v1/chat
   -> response rendered in ChatShell
```

## Integration Notes

- Frontend expects backend to be reachable from the Next.js API route.
- Backend returns `answer`, `intent`, and `sources`.
- If indexing is missing or Ollama is unavailable, errors are displayed in the UI.

## Testing Strategy

- component tests for `ChatShell` behavior (submit, loading, success, error)
- unit tests for `sendChat` success/failure handling
