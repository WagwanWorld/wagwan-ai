-- Brand accounts (Instagram-authenticated brands)
CREATE TABLE IF NOT EXISTS brand_accounts (
  ig_user_id    TEXT PRIMARY KEY,
  ig_username   TEXT NOT NULL,
  ig_name       TEXT DEFAULT '',
  ig_profile_picture TEXT DEFAULT '',
  ig_followers_count INTEGER DEFAULT 0,
  ig_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ DEFAULT now()
);

-- Scheduled posts
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id   TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  gcs_url       TEXT NOT NULL,
  media_type    TEXT NOT NULL CHECK (media_type IN ('IMAGE','VIDEO','CAROUSEL','REELS','STORIES')),
  caption       TEXT DEFAULT '',
  hashtags      TEXT[] DEFAULT '{}',
  alt_text      TEXT DEFAULT '',
  scheduled_at  TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','publishing','published','failed')),
  ig_media_id   TEXT,
  ig_permalink  TEXT,
  ig_container_id TEXT,
  error_message TEXT,
  ai_reasoning  TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sp_brand ON scheduled_posts(brand_ig_id, status);
CREATE INDEX idx_sp_schedule ON scheduled_posts(status, scheduled_at) WHERE status = 'scheduled';

-- Carousel items
CREATE TABLE IF NOT EXISTS scheduled_post_carousel_items (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   UUID NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  gcs_url   TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('IMAGE','VIDEO')),
  position  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_spci_post ON scheduled_post_carousel_items(post_id);

-- Brand insights cache (accumulates over time)
CREATE TABLE IF NOT EXISTS brand_insights_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  insights_data JSONB NOT NULL DEFAULT '{}',
  fetched_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_bic_brand ON brand_insights_cache(brand_ig_id, fetched_at DESC);

-- RLS
ALTER TABLE brand_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_post_carousel_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_insights_cache ENABLE ROW LEVEL SECURITY;
