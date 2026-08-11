-- Smarter search: trigram fuzzy match + richer FTS indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_threads_title_trgm ON threads USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_body_trgm ON posts USING gin (body gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_displayname_trgm ON users USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_forums_name_trgm ON forums USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profile_posts_body_trgm ON profile_posts USING gin (body gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_threads_fts ON threads USING gin (to_tsvector('english', coalesce(title, '')));
CREATE INDEX IF NOT EXISTS idx_posts_fts ON posts USING gin (to_tsvector('english', coalesce(body, '')));
CREATE INDEX IF NOT EXISTS idx_threads_created ON threads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_replies ON threads (reply_count DESC);
