-- Brand intelligence agent tables
-- Stores weekly snapshots, briefs, proposals, and competitor tracking

-- Weekly intelligence snapshots
CREATE TABLE IF NOT EXISTS brand_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id   TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  snapshot_date  DATE NOT NULL,

  -- Account metrics
  followers      INTEGER DEFAULT 0,
  following      INTEGER DEFAULT 0,
  media_count    INTEGER DEFAULT 0,
  impressions_7d INTEGER DEFAULT 0,
  reach_7d       INTEGER DEFAULT 0,
  profile_views_7d INTEGER DEFAULT 0,

  -- Engagement metrics
  engagement_rate  NUMERIC(5,2) DEFAULT 0,
  avg_likes        NUMERIC(10,2) DEFAULT 0,
  avg_comments     NUMERIC(10,2) DEFAULT 0,
  avg_saves        NUMERIC(10,2) DEFAULT 0,
  avg_shares       NUMERIC(10,2) DEFAULT 0,
  avg_reach        NUMERIC(10,2) DEFAULT 0,
  posts_per_week   NUMERIC(5,1) DEFAULT 0,

  -- JSONB blobs
  demographics     JSONB DEFAULT '{}',
  content_performance JSONB DEFAULT '{}',
  competitor_data  JSONB DEFAULT '{}',
  intelligence     JSONB DEFAULT '{}',

  created_at     TIMESTAMPTZ DEFAULT now(),

  UNIQUE(brand_ig_id, snapshot_date)
);
CREATE INDEX idx_bs_brand_date ON brand_snapshots(brand_ig_id, snapshot_date DESC);

-- Weekly narrative briefs
CREATE TABLE IF NOT EXISTS brand_weekly_briefs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id   TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  brief_date    DATE NOT NULL,
  headline      TEXT NOT NULL DEFAULT '',
  sections      JSONB NOT NULL DEFAULT '{}',
  key_metrics   JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(brand_ig_id, brief_date)
);
CREATE INDEX idx_bwb_brand_date ON brand_weekly_briefs(brand_ig_id, brief_date DESC);

-- Action proposals
CREATE TABLE IF NOT EXISTS brand_action_proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id   TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('content', 'creator_match', 'strategy')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  title         TEXT NOT NULL DEFAULT '',
  payload       JSONB NOT NULL DEFAULT '{}',
  reasoning     TEXT DEFAULT '',
  urgency       TEXT DEFAULT 'medium' CHECK (urgency IN ('high', 'medium', 'low')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  acted_at      TIMESTAMPTZ
);
CREATE INDEX idx_bap_brand_status ON brand_action_proposals(brand_ig_id, status);
CREATE INDEX idx_bap_pending ON brand_action_proposals(brand_ig_id, created_at DESC) WHERE status = 'pending';

-- Competitor tracking
CREATE TABLE IF NOT EXISTS brand_competitors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id           TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  competitor_ig_username TEXT NOT NULL,
  competitor_ig_id      TEXT,
  last_analysed_at      TIMESTAMPTZ,
  latest_analysis       JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE(brand_ig_id, competitor_ig_username)
);
CREATE INDEX idx_bc_brand ON brand_competitors(brand_ig_id);

-- Add brand_identity column if not exists (may already exist from prior migration)
DO $$ BEGIN
  ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS brand_identity JSONB DEFAULT '{}';
  ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS identity_updated_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- RLS
ALTER TABLE brand_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_weekly_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_competitors ENABLE ROW LEVEL SECURITY;
