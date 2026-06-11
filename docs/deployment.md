# Deployment Guide

## Prerequisites

| Tool | Version |
|---|---|
| Docker | 24+ |
| Docker Compose | v2.20+ |
| Git | Any recent |
| Ollama | 0.3+ (optional, for local LLM) |

---

## Quick Start (Local Development)

### 1. Clone the repository

```bash
git clone <repo-url>
cd "AI Codebase Copilot"
```

### 2. Start infrastructure services

```bash
docker compose -f infra/compose.yaml up -d
```

This starts infrastructure only (no app containers): PostgreSQL, pgAdmin, Qdrant, Redis, Ollama. Run the API, worker, and frontend locally as described below, or use the `prod` profile for full Docker deployment.

### 3. Configure the backend

```bash
cd backend
cp .env.example .env
# Edit .env — set JWT_SECRET_KEY to a random 64-char value
```

### 4. Install Python dependencies

```bash
cd backend
pip install -e .
```

### 5. Start the API server

```bash
cd backend
python run.py
# API available at http://localhost:8000
```

### 6. Start the background worker (separate terminal)

```bash
cd backend
python run_worker.py
# Worker listens on Redis queue for indexing jobs
```

### 7. Configure the frontend

```bash
cd frontend
cp .env.example .env
# Edit .env — set NEXT_PUBLIC_API_URL=http://localhost:8000/v1
```

### 8. Start the frontend

```bash
cd frontend
npm install
npm run dev
# Frontend available at http://localhost:3000
```

---

## Production Deployment (Docker Compose)

### 1. Configure environment files

**Backend** (`backend/.env`):
```env
APP_ENV=production
JWT_SECRET_KEY=<run: openssl rand -hex 32>
POSTGRES_PASSWORD=<strong-password>
CORS_ALLOW_ORIGINS=https://your-domain.com
OLLAMA_BASE_URL=http://ollama:11434
REPO_CACHE_PERSIST=true
```

**Frontend** (`frontend/.env`):
```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com/v1
API_INTERNAL_URL=http://api:8000/v1
```

### 2. Build and start all services

```bash
docker compose -f infra/compose.yaml --profile prod up -d --build
```

This starts all infrastructure services **plus**:
- `aicc-api` — FastAPI server on port 8000
- `aicc-worker` — RQ background worker (no exposed port)
- `aicc-frontend` — Next.js standalone server on port 3000

### 3. Verify deployment

```bash
# Check all containers are running
docker compose -f infra/compose.yaml --profile prod ps

# Check API health
curl http://localhost:8000/health

# Tail logs
docker compose -f infra/compose.yaml --profile prod logs -f api
docker compose -f infra/compose.yaml --profile prod logs -f worker
```

---

## Service Configuration Reference

### Profiles

| Profile | Services |
|---|---|
| *(none)* | postgres, pgadmin, qdrant, redis, ollama |
| `prod` | All of the above + api, worker, frontend |

### Ports

| Service | Host Port | Container Port |
|---|---|---|
| Frontend | 3000 | 3000 |
| API | 8000 | 8000 |
| PostgreSQL | 5432 | 5432 |
| pgAdmin | 5050 | 80 |
| Qdrant | 6333 | 6333 |
| Redis | 6379 | 6379 |
| Ollama | 11434 | 11434 |

---

## Database Schema

The schema is managed automatically by SQLAlchemy's `Base.metadata.create_all()` on every API server startup via `ensure_app_schema()`. This creates all tables and the `pgvector` extension on first run.

SQL migration scripts for incremental changes live in `backend/migrations/` (e.g. `006_phase3c_act_mode.sql`, `007_phase3d_retrieval.sql`). Apply these manually when upgrading an existing database if `create_all` does not cover your deployment path.

**For existing databases**: Restart the API server after upgrades so `ensure_app_schema()` can create any missing tables.

---

## Reverse Proxy (nginx)

Example nginx configuration for production:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API — SSE requires buffering disabled
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        chunked_transfer_encoding on;
        proxy_http_version 1.1;
    }
}
```

---

## Admin Account Setup

1. Set `ADMIN_REGISTRATION_SECRET_KEY` to a strong secret in `backend/.env`
2. Navigate to `/admin/register` in the frontend
3. Fill in email, password, and the registration secret
4. After creating the first admin, **remove or rotate** `ADMIN_REGISTRATION_SECRET_KEY` to lock registration

---

## Troubleshooting

### Worker not processing jobs

- Verify `aicc-worker` container is running: `docker compose ps`
- Check worker logs: `docker compose logs worker`
- Ensure `REDIS_HOST` in `backend/.env` matches the Redis service name (`redis`)

### Indexing fails with "Repository cache not found"

- Set `REPO_CACHE_PERSIST=true` in production
- Verify the worker has write access to the cache directory
- Mount a persistent volume for the cache if using Docker

### CORS errors in browser

- Set `CORS_ALLOW_ORIGINS=https://your-frontend-domain.com` in `backend/.env`
- Do not use wildcard `*` in production

### JWT errors after restart

- `JWT_SECRET_KEY` must be consistent across restarts
- Do not change the key in production — all existing sessions will be invalidated

### Frontend blank page

- Check `NEXT_PUBLIC_API_URL` is reachable from the browser (not just the server)
- Ensure it ends with `/v1`, e.g. `https://api.example.com/v1`

### Database connection refused

- Ensure PostgreSQL is healthy: `docker compose ps postgres`
- Check `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` match the compose config
