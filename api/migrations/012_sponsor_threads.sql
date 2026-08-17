-- Official thread for each sponsor / trusted store
ALTER TABLE sponsor_banners
    ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES threads(id) ON DELETE SET NULL;

ALTER TABLE trusted_stores
    ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES threads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sponsor_banners_thread ON sponsor_banners(thread_id);
CREATE INDEX IF NOT EXISTS idx_trusted_stores_thread ON trusted_stores(thread_id);
