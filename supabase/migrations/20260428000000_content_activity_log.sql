-- Content activity log for tracking all automation events
CREATE TABLE IF NOT EXISTS content_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'uploaded', 'generated', 'scheduled', 'published', 'failed', 'retried', 'rescheduled'
  )),
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cal_brand ON content_activity_log(brand_ig_id, created_at DESC);

-- Brand voice preference for AI content generation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_accounts' AND column_name = 'brand_voice'
  ) THEN
    ALTER TABLE brand_accounts
      ADD COLUMN brand_voice TEXT DEFAULT 'Bold'
      CHECK (brand_voice IN ('Bold', 'Playful', 'Premium', 'Minimal', 'Hype'));
  END IF;
END $$;
