BEGIN;

-- 1. Patch Draft Parent Table
CREATE TABLE IF NOT EXISTS act_patch_drafts (
    id VARCHAR(255) PRIMARY KEY,
    repository_id VARCHAR(255) NOT NULL,
    base_commit_sha VARCHAR(40) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    pre_apply_snapshot_id VARCHAR(255) NULL,
    post_apply_snapshot_id VARCHAR(255) NULL,
    applied_at TIMESTAMPTZ NULL,
    applied_by VARCHAR(255) NULL,
    applied_commit_sha_before VARCHAR(40) NULL,
    validation_logs TEXT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_act_patch_drafts_repository FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
    CONSTRAINT fk_act_patch_drafts_pre_snap FOREIGN KEY (pre_apply_snapshot_id) REFERENCES repository_snapshots(id) ON DELETE SET NULL,
    CONSTRAINT fk_act_patch_drafts_post_snap FOREIGN KEY (post_apply_snapshot_id) REFERENCES repository_snapshots(id) ON DELETE SET NULL
);

-- Index for lifecycle cleanup and retrieval efficiency
CREATE INDEX IF NOT EXISTS idx_act_patch_drafts_expires ON act_patch_drafts(expires_at, status);
CREATE INDEX IF NOT EXISTS idx_act_patch_drafts_repository ON act_patch_drafts(repository_id);

-- 2. Patch Draft Files Inventory Table (Per-File Diff Storage)
CREATE TABLE IF NOT EXISTS act_patch_files (
    patch_id VARCHAR(255) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'ADDED', 'MODIFIED', 'DELETED'
    file_diff TEXT NOT NULL,
    content_hash_before VARCHAR(255) NULL,
    content_hash_after VARCHAR(255) NULL,
    PRIMARY KEY (patch_id, file_path),
    CONSTRAINT fk_act_patch_files_patch FOREIGN KEY (patch_id) REFERENCES act_patch_drafts(id) ON DELETE CASCADE
);

COMMIT;
