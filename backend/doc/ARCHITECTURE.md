# System Architecture

## Backend Architecture

The backend is designed as an agentic Retrieval-Augmented Generation (RAG) system, orchestrated via FastAPI and LangGraph. It supports hybrid retrieval, dense and sparse search, and uses Ollama for local embedding generation. The backend interacts with a PostgreSQL database (with pgvector extension) for vector storage and retrieval.

### Key Components
- **FastAPI**: Provides REST API endpoints for indexing, search, and chat.
- **LangGraph**: Manages agent orchestration and retrieval pipeline.
- **Embedding Provider**: Ollama-based local embedding generation.
- **Indexing Service**: Processes codebase, ignores heavy directories, generates embeddings, and stores vectors in Postgres.
- **Hybrid Retrieval**: Combines dense (vector) and sparse (keyword) search for optimal results.
- **PostgreSQL + pgvector**: Stores embeddings and supports fast vector search.
- **Containerized Infra**: Uses Compose/Podman for DB, backend, and pgAdmin GUI.

### Data Flow
1. **Indexing**: User triggers `/v1/index` with `repo_path` or `repo_url`. Indexing service processes files, generates embeddings, stores vectors in DB.
2. **Search**: User queries `/v1/search`. Hybrid retrieval combines vector and keyword search, returns ranked results.
3. **Chat**: User queries `/v1/chat`. Backend retrieves relevant code snippets, passes context to agent, returns generated answer.

### Agentic Pipeline
- Multi-agent orchestration via LangGraph for retrieval, ranking, and response generation.
- Ollama embeddings for local operation with no external API key requirement.
- Directory ignore rules for fast, scalable indexing.

## Frontend Architecture

The frontend is a Next.js application providing a UI for search and chat with the codebase. It connects to the backend API and displays results interactively.

### Key Components
- **Next.js**: Modern React framework for SSR and client-side rendering.
- **API Client**: Handles requests to backend endpoints (`/v1/search`, `/v1/chat`).
- **UI Components**: Search bar, chat interface, results display.
- **Config**: API endpoint configurable for local or remote backend.

### Data Flow
1. **User Input**: User enters search or chat query in UI.
2. **API Request**: Frontend sends request to backend API.
3. **Result Display**: UI renders search results or chat responses.

### Integration
- Frontend expects backend at `http://localhost:8000` (configurable).
- Handles errors and loading states for smooth UX.

---

## How Things Work Together
- Backend indexes and retrieves codebase data, exposes API endpoints.
- Frontend provides interactive UI, sends queries to backend, displays results.
- PostgreSQL stores embeddings and retrieval data, managed via containerized infra.
- pgAdmin GUI available for DB inspection.
- Agentic pipeline ensures flexible, scalable retrieval and response generation.

---

## Diagrams

### Backend Architecture
```
User
  |
  |  REST API (FastAPI)
  v
Index/Search/Chat Endpoints
  |
  |  LangGraph Agent Orchestration
  v
Embedding Provider (Ollama)
  |
  |  Indexing Service
  v
PostgreSQL + pgvector
```

### Frontend Architecture
```
User
  |
  |  UI (Next.js)
  v
Search/Chat Components
  |
  |  API Client
  v
Backend API (FastAPI)
```

---

For more details, see code comments and endpoint documentation.
