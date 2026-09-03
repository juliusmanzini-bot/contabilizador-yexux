CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, invite_id TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, email TEXT NOT NULL, perfil TEXT NOT NULL, token TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, setup_url TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDENTE', issued_at TEXT NOT NULL, expires_at TEXT NOT NULL, activated_at TEXT DEFAULT '', cancelled_at TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);
