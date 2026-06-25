-- Migration 009: Admin invite tokens for secure admin onboarding

CREATE TABLE IF NOT EXISTS admin_invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_invites_email ON admin_invites(email);
CREATE INDEX IF NOT EXISTS idx_admin_invites_token_hash ON admin_invites(token_hash);
