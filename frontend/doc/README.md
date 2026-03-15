# Frontend Documentation

## How to Run

1. Ensure Node.js (16+) and npm are installed.
2. Navigate to the frontend folder:
   ```
   cd frontend
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Start the frontend server:
   ```
   npm run dev
   ```

## What We Are Doing

- Next.js frontend for agentic RAG system.
- Connects to backend API for search and chat.
- Provides UI for codebase retrieval and chat.

## System Architecture

See ARCHITECTURE.md for detailed frontend and backend architecture, data flow, and diagrams.

- Frontend: Next.js UI, API client, search/chat components.
- Backend: FastAPI agentic RAG pipeline, hybrid retrieval, embeddings, Postgres/pgvector.

## Troubleshooting
- Ensure backend is running and accessible at `http://localhost:8000`.
- Update API endpoint in frontend config if backend port changes.
- Use browser dev tools for debugging UI issues.
