-- Two-layer content cache: stores LLM-generated content to avoid recomputation.
CREATE TABLE IF NOT EXISTS cached_content (
  id BIGSERIAL PRIMARY KEY,
  google_sub TEXT NOT NULL,
  content_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(google_sub, content_type)
);

CREATE INDEX IF NOT EXISTS idx_cached_content_lookup
  ON cached_content (google_sub, content_type, expires_at);
