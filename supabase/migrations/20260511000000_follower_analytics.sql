-- Follower analytics: daily snapshots, demographics, online activity, post attribution

-- 1. Daily follower count tracking
CREATE TABLE IF NOT EXISTS follower_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  followers INTEGER NOT NULL DEFAULT 0,
  follows_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  reach_28d INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_ig_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_follower_snapshots_brand_date
  ON follower_snapshots(brand_ig_id, snapshot_date DESC);

ALTER TABLE follower_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role follower_snapshots" ON follower_snapshots;
CREATE POLICY "Service role follower_snapshots" ON follower_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Weekly demographic breakdowns (age, gender, city, country)
CREATE TABLE IF NOT EXISTS demographic_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  snapshot_week DATE NOT NULL,
  breakdown_type TEXT NOT NULL CHECK (breakdown_type IN ('age', 'gender', 'city', 'country')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_ig_id, snapshot_week, breakdown_type)
);

CREATE INDEX IF NOT EXISTS idx_demographic_snapshots_brand_week
  ON demographic_snapshots(brand_ig_id, snapshot_week DESC);

ALTER TABLE demographic_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role demographic_snapshots" ON demographic_snapshots;
CREATE POLICY "Service role demographic_snapshots" ON demographic_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Weekly 7x24 online-activity heatmap
CREATE TABLE IF NOT EXISTS online_activity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  snapshot_week DATE NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_ig_id, snapshot_week, day_of_week, hour_of_day)
);

CREATE INDEX IF NOT EXISTS idx_online_activity_brand_week
  ON online_activity_snapshots(brand_ig_id, snapshot_week DESC);

ALTER TABLE online_activity_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role online_activity_snapshots" ON online_activity_snapshots;
CREATE POLICY "Service role online_activity_snapshots" ON online_activity_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Per-post follower conversion attribution
CREATE TABLE IF NOT EXISTS post_follow_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,
  media_type TEXT,
  posted_at TIMESTAMPTZ,
  caption_preview TEXT,
  permalink TEXT,
  reach INTEGER DEFAULT 0,
  follows INTEGER DEFAULT 0,
  profile_activity INTEGER DEFAULT 0,
  reach_followers INTEGER DEFAULT 0,
  reach_non_followers INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_ig_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_follow_attr_brand_posted
  ON post_follow_attribution(brand_ig_id, posted_at DESC);

ALTER TABLE post_follow_attribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role post_follow_attribution" ON post_follow_attribution;
CREATE POLICY "Service role post_follow_attribution" ON post_follow_attribution
  FOR ALL TO service_role USING (true) WITH CHECK (true);
