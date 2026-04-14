-- Creator rate card
CREATE TABLE IF NOT EXISTS creator_rates (
  user_google_sub TEXT PRIMARY KEY,
  ig_post_rate_inr INTEGER DEFAULT 0,
  ig_story_rate_inr INTEGER DEFAULT 0,
  ig_reel_rate_inr INTEGER DEFAULT 0,
  whatsapp_intro_rate_inr INTEGER DEFAULT 0,
  available BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portrait visibility
CREATE TABLE IF NOT EXISTS portrait_visibility (
  user_google_sub TEXT PRIMARY KEY,
  music_visible BOOLEAN DEFAULT true,
  instagram_visible BOOLEAN DEFAULT true,
  career_visible BOOLEAN DEFAULT true,
  lifestyle_visible BOOLEAN DEFAULT true,
  calendar_visible BOOLEAN DEFAULT false,
  email_visible BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brief responses
CREATE TABLE IF NOT EXISTS brief_responses (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  user_google_sub TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ig_post_url TEXT,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payout_inr INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, user_google_sub)
);

CREATE INDEX IF NOT EXISTS idx_brief_responses_user
  ON brief_responses (user_google_sub, status);
