-- Schema D1 SQLite pour Tabin's
CREATE TABLE IF NOT EXISTS synced_tabs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    is_favorite INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_synced_tabs_user_id ON synced_tabs(user_id);
CREATE INDEX IF NOT EXISTS idx_synced_tabs_created_at ON synced_tabs(created_at);
