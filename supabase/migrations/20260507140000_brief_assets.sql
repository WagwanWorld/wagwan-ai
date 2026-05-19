-- Brief creatives attached to campaign briefs
CREATE TABLE IF NOT EXISTS brief_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  url TEXT NOT NULL,
  gcs_path TEXT NOT NULL,
  thumb_url TEXT,
  caption TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brief_assets_campaign_order
  ON brief_assets(campaign_id, sort_order, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brief_assets_campaign_gcs_path
  ON brief_assets(campaign_id, gcs_path);

ALTER TABLE brief_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role brief_assets" ON brief_assets;
CREATE POLICY "Service role brief_assets" ON brief_assets
  FOR ALL USING (true) WITH CHECK (true);
