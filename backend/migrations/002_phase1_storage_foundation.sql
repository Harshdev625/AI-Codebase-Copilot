-- =============================================================================
-- Migration 002: Phase 1 Storage Foundation
-- =============================================================================
-- Covers:
--   1. ALTER TABLE repositories   -- add latest_indexed_commit, retention policy
--   2. ALTER TABLE indexing_jobs  -- add trigger_type, priority, counters, errors, finished_at
--   3. ALTER TABLE code_chunks    -- add content_hash, qdrant_point_id
--   4. ALTER TABLE chat_sessions  -- add commit_sha (version awareness)
--   5. CREATE TABLE repository_files
--   6. CREATE TABLE repository_snapshots
--
-- Safe-migration principles used throughout:
--   * Every ALTER TABLE ADD COLUMN is nullable OR carries a DEFAULT so no
--     existing rows are invalidated.
--   * New tables are created with IF NOT EXISTS.
--   * Indexes are created with IF NOT EXISTS (Postgres 9.5+).
--   * The migration is wrapped in a transaction so it is fully atomic.
--   * Each section is preceded by a comment block explaining the change and
--     its safety guarantee.
--
-- Run this file once against the target database:
--   psql -U <user> -d <dbname> -f 002_phase1_storage_foundation.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. repositories
--    New columns are nullable / have defaults so existing rows are unaffected.
-- ---------------------------------------------------------------------------

ALTER TABLE repositories
    ADD COLUMN IF NOT EXISTS latest_indexed_commit  VARCHAR       NULL;

ALTER TABLE repositories
    ADD COLUMN IF NOT EXISTS retain_snapshots_mode  VARCHAR       NOT NULL DEFAULT 'LAST_N';

ALTER TABLE repositories
    ADD COLUMN IF NOT EXISTS retain_snapshot_count  INTEGER       NOT NULL DEFAULT 20;

ALTER TABLE repositories
    ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW();

-- Unique constraint on (owner_user_id, repo_id) — safe to add if not already present.
-- Wrapped in DO $$ to be idempotent (skip if constraint already exists).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_repositories_owner_repo'
    ) THEN
        ALTER TABLE repositories
            ADD CONSTRAINT uq_repositories_owner_repo
            UNIQUE (owner_user_id, repo_id);
    END IF;
END
$$;


-- ---------------------------------------------------------------------------
-- 2. indexing_jobs
--    * trigger_type and priority: new queue metadata — both have safe defaults.
--    * files_indexed, files_skipped, chunks_created: outcome counters.
--    * errors: JSONB array replacing the old text-based error tracking.
--    * finished_at: was missing from original schema.
--    * stats column already existed; kept as-is.
-- ---------------------------------------------------------------------------

ALTER TABLE indexing_jobs
    ADD COLUMN IF NOT EXISTS trigger_type   VARCHAR     NOT NULL DEFAULT 'MANUAL';

ALTER TABLE indexing_jobs
    ADD COLUMN IF NOT EXISTS priority       INTEGER     NOT NULL DEFAULT 5;

ALTER TABLE indexing_jobs
    ADD COLUMN IF NOT EXISTS files_indexed  INTEGER     NOT NULL DEFAULT 0;

ALTER TABLE indexing_jobs
    ADD COLUMN IF NOT EXISTS files_skipped  INTEGER     NOT NULL DEFAULT 0;

ALTER TABLE indexing_jobs
    ADD COLUMN IF NOT EXISTS chunks_created INTEGER     NOT NULL DEFAULT 0;

-- errors: stores [{file, error, timestamp}] JSON objects. Defaults to empty array.
ALTER TABLE indexing_jobs
    ADD COLUMN IF NOT EXISTS errors         JSONB       NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE indexing_jobs
    ADD COLUMN IF NOT EXISTS finished_at    TIMESTAMPTZ NULL;


-- ---------------------------------------------------------------------------
-- 3. code_chunks
--    * content_hash: sha256 of content — nullable for existing rows (they will
--      be backfilled by the next full re-index or a background job).
--    * qdrant_point_id: reference into the Qdrant collection; nullable initially
--      since existing rows do not have explicit point IDs recorded in SQL.
--    NOTE: The `embedding` column is intentionally KEPT for SQLite/offline
--    fallback. In Postgres deployments Qdrant is the system of record.
-- ---------------------------------------------------------------------------

ALTER TABLE code_chunks
    ADD COLUMN IF NOT EXISTS content_hash    VARCHAR     NULL;

ALTER TABLE code_chunks
    ADD COLUMN IF NOT EXISTS qdrant_point_id VARCHAR     NULL;

ALTER TABLE code_chunks
    ADD COLUMN IF NOT EXISTS status          VARCHAR     NOT NULL DEFAULT 'ACTIVE';

-- Unique constraint on qdrant_point_id (allow NULL — NULLs are never equal in Postgres).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_code_chunks_qdrant_point_id'
    ) THEN
        ALTER TABLE code_chunks
            ADD CONSTRAINT uq_code_chunks_qdrant_point_id
            UNIQUE (qdrant_point_id);
    END IF;
END
$$;

-- Indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_code_chunks_content_hash
    ON code_chunks (content_hash);

CREATE INDEX IF NOT EXISTS idx_code_chunks_status
    ON code_chunks (status);

CREATE INDEX IF NOT EXISTS idx_code_chunks_repo_path
    ON code_chunks (repository_id, path);

CREATE INDEX IF NOT EXISTS idx_code_chunks_commit
    ON code_chunks (repository_id, commit_sha);


-- ---------------------------------------------------------------------------
-- 4. chat_sessions — version awareness
--    commit_sha freezes the session to the exact indexed snapshot it was
--    created against. NULL for sessions created before this migration.
-- ---------------------------------------------------------------------------

ALTER TABLE chat_sessions
    ADD COLUMN IF NOT EXISTS commit_sha VARCHAR NULL;

ALTER TABLE chat_sessions
    ADD COLUMN IF NOT EXISTS summary    TEXT    NULL;


-- ---------------------------------------------------------------------------
-- 5. repository_files  (NEW TABLE)
--    Powers File Explorer without disk access.
--    Powers hash-based incremental indexing.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS repository_files (
    id                   VARCHAR         NOT NULL PRIMARY KEY,
    repository_id        VARCHAR         NOT NULL
                             REFERENCES repositories(id) ON DELETE CASCADE,
    path                 VARCHAR         NOT NULL,
    -- 'FILE' | 'DIRECTORY'
    type                 VARCHAR         NOT NULL DEFAULT 'FILE',
    extension            VARCHAR         NULL,
    language             VARCHAR         NULL,
    size_bytes           INTEGER         NULL,
    line_count           INTEGER         NULL,
    -- estimated LLM token count (chars / 4)
    token_count          INTEGER         NULL,
    -- sha256 of file content — used to skip re-embedding unchanged files
    hash                 VARCHAR         NULL,
    -- True for generated/vendor artefacts detected at discovery time
    is_generated         BOOLEAN         NOT NULL DEFAULT FALSE,
    -- 'INDEXED' | 'SKIPPED' | 'ERROR'
    status               VARCHAR         NOT NULL DEFAULT 'INDEXED',
    -- 'FILE_TOO_LARGE' | 'UNSUPPORTED_EXTENSION' | 'BINARY_FILE' |
    -- 'IGNORED_BY_VCS' | 'LOW_SIGNAL'
    skip_reason          VARCHAR         NULL,
    last_indexed_commit  VARCHAR         NULL,
    created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_repository_files_repo_path
        UNIQUE (repository_id, path)
);

CREATE INDEX IF NOT EXISTS idx_repository_files_repo_id
    ON repository_files (repository_id);

CREATE INDEX IF NOT EXISTS idx_repository_files_status
    ON repository_files (repository_id, status);

CREATE INDEX IF NOT EXISTS idx_repository_files_language
    ON repository_files (repository_id, language);


-- ---------------------------------------------------------------------------
-- 6. repository_snapshots  (NEW TABLE)
--    Immutable record per (repository_id, commit_sha).
--    is_pinned and is_release snapshots are NEVER deleted by retention cleanup.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS repository_snapshots (
    id              VARCHAR         NOT NULL PRIMARY KEY,
    repository_id   VARCHAR         NOT NULL
                        REFERENCES repositories(id) ON DELETE CASCADE,
    commit_sha      VARCHAR         NOT NULL,
    indexed_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    files_count     INTEGER         NOT NULL DEFAULT 0,
    chunks_count    INTEGER         NOT NULL DEFAULT 0,
    files_skipped   INTEGER         NOT NULL DEFAULT 0,
    -- Protected from retention cleanup
    is_pinned       BOOLEAN         NOT NULL DEFAULT FALSE,
    is_release      BOOLEAN         NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_repository_snapshots_repo_commit
        UNIQUE (repository_id, commit_sha)
);

CREATE INDEX IF NOT EXISTS idx_repository_snapshots_repo_id
    ON repository_snapshots (repository_id);

CREATE INDEX IF NOT EXISTS idx_repository_snapshots_indexed_at
    ON repository_snapshots (repository_id, indexed_at DESC);


-- =============================================================================
-- Verification queries  (run manually after migration to confirm success)
-- =============================================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'repositories'
--   ORDER BY ordinal_position;
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'indexing_jobs'
--   ORDER BY ordinal_position;
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'code_chunks'
--   ORDER BY ordinal_position;
--
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('repository_files', 'repository_snapshots');
-- =============================================================================

COMMIT;
