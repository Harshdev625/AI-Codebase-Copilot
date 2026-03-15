CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS code_chunks (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  path TEXT NOT NULL,
  language TEXT NOT NULL,
  symbol TEXT NOT NULL,
  chunk_type TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_chunks_repo_id ON code_chunks (repo_id);
CREATE INDEX IF NOT EXISTS idx_code_chunks_language ON code_chunks (language);
CREATE INDEX IF NOT EXISTS idx_code_chunks_path ON code_chunks (path);

CREATE INDEX IF NOT EXISTS idx_code_chunks_embedding_cosine
ON code_chunks
USING hnsw (embedding vector_cosine_ops);

-- Full-text search index (used by lexical_search in hybrid retrieval)
CREATE INDEX IF NOT EXISTS idx_code_chunks_content_fts
ON code_chunks
USING gin (to_tsvector('english', content));
