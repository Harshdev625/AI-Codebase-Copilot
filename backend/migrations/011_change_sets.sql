-- Plan / Act workflow: change_sets table
CREATE TABLE IF NOT EXISTS change_sets (
    id VARCHAR PRIMARY KEY,
    repository_id VARCHAR NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    chat_session_id VARCHAR NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR NOT NULL DEFAULT 'PLANNING',
    plan_version INTEGER NOT NULL DEFAULT 1,
    plan_json JSONB NOT NULL DEFAULT '{}',
    plan_markdown TEXT,
    source_message_id VARCHAR REFERENCES messages(id) ON DELETE SET NULL,
    patch_id VARCHAR REFERENCES act_patch_drafts(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    approved_by VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_change_sets_chat_session_id ON change_sets(chat_session_id);
CREATE INDEX IF NOT EXISTS ix_change_sets_repository_status ON change_sets(repository_id, status);
