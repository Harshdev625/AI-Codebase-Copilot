BEGIN;

CREATE TABLE IF NOT EXISTS patch_chunks (
    id VARCHAR(255) PRIMARY KEY,
    patch_id VARCHAR(255) NOT NULL,
    repository_id VARCHAR(255) NOT NULL,
    repo_id VARCHAR(255) NOT NULL,
    path VARCHAR(1024) NOT NULL,
    symbol VARCHAR(255) NOT NULL DEFAULT '',
    language VARCHAR(255) NOT NULL DEFAULT '',
    chunk_type VARCHAR(50) NOT NULL DEFAULT 'generic',
    start_line INTEGER NOT NULL DEFAULT 1,
    end_line INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    content_hash VARCHAR(255) NULL,
    qdrant_point_id VARCHAR(255) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_patch_chunks_patch FOREIGN KEY (patch_id) REFERENCES act_patch_drafts(id) ON DELETE CASCADE,
    CONSTRAINT fk_patch_chunks_repository FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_patch_chunks_patch_id ON patch_chunks(patch_id);

COMMIT;
