BEGIN;

-- Context Management Persistence Table
CREATE TABLE IF NOT EXISTS repository_context_entries (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    repository_id VARCHAR(255) NOT NULL,
    path VARCHAR(1024) NOT NULL,
    entry_type VARCHAR(50) NOT NULL, -- 'FILE' | 'CHUNK'
    token_count INTEGER NOT NULL DEFAULT 0,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    priority INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_context_entries_repo FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Index for session-level contexts
CREATE INDEX IF NOT EXISTS idx_repo_context_session ON repository_context_entries(session_id);

COMMIT;
