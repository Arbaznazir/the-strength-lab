-- Profile tags (VIP, Company, Member, etc.) with custom colors
CREATE TABLE IF NOT EXISTS profile_tags (
    slug TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#d4ff3a',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_tags (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_slug TEXT NOT NULL REFERENCES profile_tags(slug) ON DELETE CASCADE,
    PRIMARY KEY (user_id, tag_slug)
);

CREATE INDEX IF NOT EXISTS idx_user_tags_slug ON user_tags(tag_slug);

INSERT INTO profile_tags (slug, label, color, sort_order) VALUES
    ('member', 'Member', '#8b948c', 10),
    ('vip', 'VIP', '#f0c14b', 20),
    ('company', 'Company', '#7dd3c0', 30),
    ('trusted', 'Trusted Source', '#d4ff3a', 40)
ON CONFLICT (slug) DO NOTHING;

-- Trusted store cards (shown under trending / on home)
CREATE TABLE IF NOT EXISTS trusted_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    tag_label TEXT NOT NULL DEFAULT 'Trusted Source',
    tag_color TEXT NOT NULL DEFAULT '#d4ff3a',
    banner_url TEXT NOT NULL DEFAULT '',
    link_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    forum_id UUID REFERENCES forums(id) ON DELETE SET NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trusted_stores_active ON trusted_stores(is_active, sort_order);
