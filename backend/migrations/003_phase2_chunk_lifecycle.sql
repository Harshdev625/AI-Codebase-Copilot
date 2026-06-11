BEGIN;

-- Add tracking columns for Phase 2 chunk lifecycle auditability
ALTER TABLE code_chunks
    ADD COLUMN IF NOT EXISTS obsolete_at TIMESTAMPTZ NULL;

ALTER TABLE code_chunks
    ADD COLUMN IF NOT EXISTS purged_at   TIMESTAMPTZ NULL;

-- Add snapshot_id FK relationship to directly map chunks to snapshots with ON DELETE SET NULL
ALTER TABLE code_chunks
    ADD COLUMN IF NOT EXISTS snapshot_id VARCHAR NULL;

-- Add foreign key constraint to link chunks to repository_snapshots
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_code_chunks_snapshot_id'
    ) THEN
        ALTER TABLE code_chunks
            ADD CONSTRAINT fk_code_chunks_snapshot_id
            FOREIGN KEY (snapshot_id)
            REFERENCES repository_snapshots(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

-- Create index on snapshot_id FK
CREATE INDEX IF NOT EXISTS idx_code_chunks_snapshot_id
    ON code_chunks (snapshot_id);

-- Create index to optimize active chunk queries in retrieval layer
CREATE INDEX IF NOT EXISTS idx_code_chunks_active_status
    ON code_chunks (repository_id, status)
    WHERE status = 'ACTIVE';

COMMIT;
