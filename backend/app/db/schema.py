from __future__ import annotations

from sqlalchemy import text

from app.db.database import engine


APP_SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'USER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_memberships (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL,
  remote_url TEXT,
  local_path TEXT,
  default_branch TEXT NOT NULL DEFAULT 'main',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repository_snapshots (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  indexed_at TIMESTAMPTZ,
  index_status TEXT NOT NULL DEFAULT 'pending',
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indexing_jobs (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  snapshot_id TEXT REFERENCES repository_snapshots(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  repo_id TEXT,
  query TEXT NOT NULL,
  intent TEXT,
  status TEXT NOT NULL,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS code_chunks (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL DEFAULT 'local',
  path TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT '',
  symbol TEXT NOT NULL DEFAULT '',
  chunk_type TEXT NOT NULL DEFAULT 'generic',
  start_line INTEGER NOT NULL DEFAULT 1,
  end_line INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(1024),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS code_graph_edges (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  source_chunk_id TEXT NOT NULL,
  target_chunk_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repo_id, source_chunk_id, target_chunk_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_code_chunks_repo_id ON code_chunks(repo_id);
CREATE INDEX IF NOT EXISTS idx_code_chunks_path ON code_chunks(path);
CREATE INDEX IF NOT EXISTS idx_code_chunks_language ON code_chunks(language);
CREATE INDEX IF NOT EXISTS idx_code_chunks_content_fts
  ON code_chunks USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_code_graph_edges_repo_id ON code_graph_edges(repo_id);
CREATE INDEX IF NOT EXISTS idx_code_graph_edges_source ON code_graph_edges(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_code_graph_edges_target ON code_graph_edges(target_chunk_id);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON project_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_project ON project_memberships(project_id);
CREATE INDEX IF NOT EXISTS idx_repositories_project_id ON repositories(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_repositories_project_repo_unique ON repositories(project_id, repo_id);
CREATE INDEX IF NOT EXISTS idx_repository_snapshots_repository_id ON repository_snapshots(repository_id);
CREATE INDEX IF NOT EXISTS idx_repository_snapshots_status ON repository_snapshots(index_status);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_repository_id ON indexing_jobs(repository_id);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status ON indexing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_project_id ON agent_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_repo_id ON agent_runs(repo_id);
"""


def ensure_app_schema() -> None:
    with engine.begin() as connection:
        connection.execute(text(APP_SCHEMA_SQL))

        # Migration: make code_chunks.embedding nullable so indexing can proceed
        # even when Ollama is unavailable.  Safe to run on any existing schema —
        # DROP NOT NULL on an already-nullable column is a no-op in Postgres.
        connection.execute(
            text(
                "ALTER TABLE IF EXISTS code_chunks "
                "ALTER COLUMN embedding DROP NOT NULL"
            )
        )

        # Migration: repositories.repo_id was previously globally unique, which
        # prevents the same repository key being reused across different
        # projects. Scope uniqueness per project instead.
        connection.execute(
          text(
            "ALTER TABLE IF EXISTS repositories "
            "DROP CONSTRAINT IF EXISTS repositories_repo_id_key"
          )
        )
        connection.execute(
          text(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_repositories_project_repo_unique "
            "ON repositories(project_id, repo_id)"
          )
        )

        # Migration: normalize legacy role values to canonical USER/ADMIN.
        connection.execute(
          text(
            """
            UPDATE users
            SET role = CASE
              WHEN LOWER(role) IN ('admin') THEN 'ADMIN'
              WHEN LOWER(role) IN ('developer', 'user', 'member') THEN 'USER'
              WHEN UPPER(role) IN ('ADMIN', 'USER') THEN UPPER(role)
              ELSE role
            END
            """
          )
        )