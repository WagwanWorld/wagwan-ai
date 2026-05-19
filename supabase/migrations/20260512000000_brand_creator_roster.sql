-- Per-brand creator roster (invites + prospects)
CREATE TABLE IF NOT EXISTS brand_creator_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  ig_username TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  profile_snapshot JSONB DEFAULT '{}',
  user_google_sub TEXT,
  invite_message TEXT NOT NULL,
  onboarding_url TEXT NOT NULL,
  analysis_snapshot JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (status IN ('prospect', 'on_platform')),
  delivery_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (delivery_status IN ('draft', 'copied', 'sent_manual')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (brand_id, ig_username)
);

CREATE INDEX IF NOT EXISTS idx_bcr_brand ON brand_creator_roster(brand_id, created_at DESC);

ALTER TABLE brand_creator_roster ENABLE ROW LEVEL SECURITY;
