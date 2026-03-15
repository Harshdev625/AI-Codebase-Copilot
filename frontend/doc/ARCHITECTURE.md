# System Architecture

## Frontend Architecture

The frontend is a Next.js application that serves as the user interface for the agentic RAG system. It connects to the backend via REST API and provides interactive search and chat capabilities for codebase retrieval.

### Key Components
- **Next.js**: Enables server-side rendering and fast client-side updates.
- **API Client**: Handles communication with backend endpoints (`/v1/search`, `/v1/chat`).
- **UI Components**: Includes search bar, chat interface, results display, and error handling.
- **Config**: Allows customization of backend API endpoint for local or remote operation.

### Data Flow
1. **User Input**: User enters a search or chat query in the UI.
2. **API Request**: Frontend sends the request to the backend API.
3. **Result Display**: UI renders search results or chat responses.

### Integration
- Frontend expects backend at `http://localhost:8000` (configurable).
- Handles errors, loading states, and displays results interactively.

---

## How Things Work Together
- Frontend provides a seamless UI for interacting with the backend agentic RAG system.
- Backend processes queries, retrieves relevant codebase data, and returns results.
- PostgreSQL stores embeddings and retrieval data, managed via containerized infra.
- Agentic pipeline ensures flexible, scalable retrieval and response generation.

---

## Diagrams

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
