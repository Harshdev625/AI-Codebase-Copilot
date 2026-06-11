-- Migration 001: Session V2 Fields
-- This migration adds the required fields for Session V2 to the chat_sessions table.

ALTER TABLE chat_sessions ADD COLUMN session_title VARCHAR NULL;
ALTER TABLE chat_sessions ADD COLUMN session_mode VARCHAR NOT NULL DEFAULT 'ASK';
ALTER TABLE chat_sessions ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE chat_sessions ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE chat_sessions ADD COLUMN last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
