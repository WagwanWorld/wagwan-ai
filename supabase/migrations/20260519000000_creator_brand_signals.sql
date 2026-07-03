-- Creator brand signals: creator-facing notifications when brands add them
CREATE TABLE IF NOT EXISTS creator_brand_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_google_sub TEXT NOT NULL,
  signal_type TEXT NOT NULL DEFAULT 'roster_add'
    CHECK (signal_type IN ('roster_add', 'brief_invite', 'campaign_match')),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  roster_entry_id UUID REFERENCES brand_creator_roster(id) ON DELETE SET NULL,
  brand_name TEXT NOT NULL,
  brand_handle TEXT,
  brand_profile_picture TEXT,
  invite_message TEXT,
  fit_label TEXT,
  fit_score INTEGER,
  analysis_snapshot JSONB DEFAULT '{}',
  seen BOOLEAN DEFAULT FALSE,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (creator_google_sub, brand_id, signal_type)
);

CREATE INDEX idx_creator_brand_signals_sub
  ON creator_brand_signals (creator_google_sub);

CREATE INDEX idx_creator_brand_signals_unseen
  ON creator_brand_signals (creator_google_sub) WHERE seen = FALSE;

ALTER TABLE creator_brand_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_signals_select ON creator_brand_signals
  FOR SELECT USING (creator_google_sub = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY creator_signals_update ON creator_brand_signals
  FOR UPDATE USING (creator_google_sub = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (creator_google_sub = current_setting('request.jwt.claims', true)::json->>'sub');

-- Creator signal inserts and roster writes are performed through service-role
-- server routes. Do not expose permissive client policies for these tables.
