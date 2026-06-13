-- Migration 008: Session metadata (scope_paths, etc.)
-- SQLite dev: metadata stored as TEXT JSON; Postgres: JSONB.

ALTER TABLE chat_sessions ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';
