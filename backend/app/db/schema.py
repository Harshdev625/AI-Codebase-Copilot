from __future__ import annotations

import logging

from sqlalchemy import text

from app.db.database import engine


logger = logging.getLogger(__name__)


APP_DROP_SQL = """
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS embedding_references CASCADE;
DROP TABLE IF EXISTS code_graph_edges CASCADE;
DROP TABLE IF EXISTS code_chunks CASCADE;
DROP TABLE IF EXISTS agent_runs CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS indexing_status CASCADE;
DROP TABLE IF EXISTS indexing_jobs CASCADE;
DROP TABLE IF EXISTS repository_snapshots CASCADE;
DROP TABLE IF EXISTS repositories CASCADE;
DROP TABLE IF EXISTS project_memberships CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS users CASCADE;
"""


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

CREATE TABLE IF NOT EXISTS admins (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, repo_id)
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

CREATE TABLE IF NOT EXISTS indexing_status (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  snapshot_id TEXT UNIQUE REFERENCES repository_snapshots(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repository_id TEXT REFERENCES repositories(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  chat_session_id TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
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
  repository_id TEXT REFERENCES repositories(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS embedding_references (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES code_chunks(id) ON DELETE CASCADE,
  vector_store TEXT NOT NULL DEFAULT 'qdrant',
  vector_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vector_store, vector_key)
);

CREATE TABLE IF NOT EXISTS code_graph_edges (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  repository_id TEXT REFERENCES repositories(id) ON DELETE CASCADE,
  source_chunk_id TEXT NOT NULL REFERENCES code_chunks(id) ON DELETE CASCADE,
  target_chunk_id TEXT NOT NULL REFERENCES code_chunks(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repository_id, source_chunk_id, target_chunk_id, edge_type)
);

CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  component TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_admins_created_at ON admins(created_at);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON project_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_project ON project_memberships(project_id);
CREATE INDEX IF NOT EXISTS idx_repositories_project_id ON repositories(project_id);
CREATE INDEX IF NOT EXISTS idx_repositories_repo_id_lower ON repositories(LOWER(repo_id));
CREATE INDEX IF NOT EXISTS idx_repository_snapshots_repository_id ON repository_snapshots(repository_id);
CREATE INDEX IF NOT EXISTS idx_repository_snapshots_status ON repository_snapshots(index_status);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_repository_id ON indexing_jobs(repository_id);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status ON indexing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_indexing_status_repository_id ON indexing_status(repository_id);
CREATE INDEX IF NOT EXISTS idx_indexing_status_snapshot_id ON indexing_status(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_id ON chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_session_id ON messages(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_project_id ON agent_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_repo_id ON agent_runs(repo_id);
CREATE INDEX IF NOT EXISTS idx_code_chunks_repo_id ON code_chunks(repo_id);
CREATE INDEX IF NOT EXISTS idx_code_chunks_repository_id ON code_chunks(repository_id);
CREATE INDEX IF NOT EXISTS idx_code_chunks_path ON code_chunks(path);
CREATE INDEX IF NOT EXISTS idx_code_chunks_language ON code_chunks(language);
CREATE INDEX IF NOT EXISTS idx_code_chunks_content_fts
  ON code_chunks USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_embedding_references_repository_id ON embedding_references(repository_id);
CREATE INDEX IF NOT EXISTS idx_embedding_references_chunk_id ON embedding_references(chunk_id);
CREATE INDEX IF NOT EXISTS idx_code_graph_edges_repo_id ON code_graph_edges(repo_id);
CREATE INDEX IF NOT EXISTS idx_code_graph_edges_repository_id ON code_graph_edges(repository_id);
CREATE INDEX IF NOT EXISTS idx_code_graph_edges_source ON code_graph_edges(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_code_graph_edges_target ON code_graph_edges(target_chunk_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON system_logs(component);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
"""


APP_MIGRATION_SQL = """
ALTER TABLE IF EXISTS repositories DROP CONSTRAINT IF EXISTS repositories_repo_id_key;

ALTER TABLE IF EXISTS code_chunks ADD COLUMN IF NOT EXISTS repository_id TEXT;
ALTER TABLE IF EXISTS code_graph_edges ADD COLUMN IF NOT EXISTS repository_id TEXT;

UPDATE code_chunks cc
SET repository_id = r.id
FROM repositories r
WHERE cc.repository_id IS NULL
  AND LOWER(cc.repo_id) = LOWER(r.repo_id)
  AND r.repo_id IN (
    SELECT repo_id FROM repositories GROUP BY repo_id HAVING COUNT(*) = 1
  );

UPDATE code_graph_edges e
SET repository_id = r.id
FROM repositories r
WHERE e.repository_id IS NULL
  AND LOWER(e.repo_id) = LOWER(r.repo_id)
  AND r.repo_id IN (
    SELECT repo_id FROM repositories GROUP BY repo_id HAVING COUNT(*) = 1
  );

UPDATE users
SET role = CASE
  WHEN LOWER(role) IN ('admin') THEN 'ADMIN'
  WHEN LOWER(role) IN ('developer', 'user', 'member') THEN 'USER'
  WHEN UPPER(role) IN ('ADMIN', 'USER') THEN UPPER(role)
  ELSE role
END;

INSERT INTO admins (user_id)
SELECT id
FROM users
WHERE UPPER(role) = 'ADMIN'
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM admins a
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = a.user_id AND UPPER(u.role) = 'ADMIN'
);

INSERT INTO chat_sessions (id, project_id, user_id, title, created_at, updated_at)
SELECT c.id, c.project_id, c.user_id, c.title, c.created_at, c.updated_at
FROM conversations c
LEFT JOIN chat_sessions cs ON cs.id = c.id
WHERE cs.id IS NULL;
"""


def _iter_sql_statements(sql: str) -> list[str]:
    statements: list[str] = []
    for part in sql.split(";"):
        stmt = part.strip()
        if stmt:
            statements.append(stmt)
    return statements


def _execute_sql_block(connection, sql: str, block_name: str) -> None:
    for stmt in _iter_sql_statements(sql):
        connection.execute(text(stmt))
    logger.debug("schema - executed block=%s statements=%s", block_name, len(_iter_sql_statements(sql)))


def ensure_app_schema() -> None:
    logger.info("schema_ensure - start")
    with engine.begin() as connection:
        _execute_sql_block(connection, APP_SCHEMA_SQL, "schema")
        _execute_sql_block(connection, APP_MIGRATION_SQL, "migration")
    logger.info("schema_ensure - completed")


def reset_app_schema() -> None:
    logger.warning("schema_reset - start")
    with engine.begin() as connection:
        _execute_sql_block(connection, APP_DROP_SQL, "drop")
        _execute_sql_block(connection, APP_SCHEMA_SQL, "schema")
        _execute_sql_block(connection, APP_MIGRATION_SQL, "migration")
    logger.warning("schema_reset - completed")
