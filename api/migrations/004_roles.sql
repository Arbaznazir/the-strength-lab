CREATE TABLE IF NOT EXISTS roles (
    slug TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    is_staff BOOLEAN NOT NULL DEFAULT false,
    is_protected BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (slug, label, is_staff, is_protected) VALUES
    ('member', 'Member', false, false),
    ('moderator', 'Moderator', true, false),
    ('admin', 'Admin', true, true)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC);
