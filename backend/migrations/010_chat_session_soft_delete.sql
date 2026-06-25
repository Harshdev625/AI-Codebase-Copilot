-- Migration 010: Soft-delete columns for chat_sessions

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
