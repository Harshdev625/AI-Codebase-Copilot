BEGIN;

-- 1. Add status and index-tracking fields to repository_snapshots
ALTER TABLE repository_snapshots ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE repository_snapshots ADD COLUMN IF NOT EXISTS index_status VARCHAR(50) NOT NULL DEFAULT 'COMPLETE';
ALTER TABLE repository_snapshots ADD COLUMN IF NOT EXISTS indexer_version VARCHAR(50) NULL;
ALTER TABLE repository_snapshots ADD COLUMN IF NOT EXISTS last_indexed_at TIMESTAMPTZ NULL;

-- 2. Create snapshot_files table to store file inventory per snapshot
CREATE TABLE IF NOT EXISTS snapshot_files (
    snapshot_id VARCHAR(255) NOT NULL,
    path VARCHAR(1024) NOT NULL,
    content_hash VARCHAR(255) NOT NULL,
    size_bytes INTEGER NULL,
    file_type VARCHAR(50) NOT NULL DEFAULT 'FILE',
    language VARCHAR(100) NULL,
    line_count INTEGER NULL,
    PRIMARY KEY (snapshot_id, path),
    CONSTRAINT fk_snapshot_files_snapshot FOREIGN KEY (snapshot_id) REFERENCES repository_snapshots(id) ON DELETE CASCADE
);

-- Index for rename matching optimizations
CREATE INDEX IF NOT EXISTS idx_snapshot_files_hash ON snapshot_files(content_hash);

COMMIT;
