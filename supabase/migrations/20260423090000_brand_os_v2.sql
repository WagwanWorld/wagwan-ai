-- Brand OS v2: deterministic intelligence foundation + governance

CREATE TABLE IF NOT EXISTS post_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,
  media_type TEXT,
  posted_at TIMESTAMPTZ,
  caption_text TEXT DEFAULT '',
  first_line_text TEXT DEFAULT '',
  hook_archetype TEXT DEFAULT 'generic',
  caption_length INTEGER DEFAULT 0,
  emoji_density NUMERIC(8,4) DEFAULT 0,
  cta_type TEXT DEFAULT 'none',
  hashtag_placement TEXT DEFAULT 'mixed',
  reading_grade NUMERIC(5,2) DEFAULT 0,
  has_question_hook BOOLEAN DEFAULT FALSE,
  face_count INTEGER DEFAULT 0,
  dominant_hue NUMERIC(8,2) DEFAULT 0,
  saturation NUMERIC(8,4) DEFAULT 0,
  composition_type TEXT DEFAULT 'unknown',
  first_frame_transcript TEXT DEFAULT '',
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  follows INTEGER DEFAULT 0,
  quality_weighted_engagement NUMERIC(12,4) DEFAULT 0,
  decay_half_life_hours NUMERIC(12,4) DEFAULT 0,
  reach_per_follower NUMERIC(12,6) DEFAULT 0,
  save_rate NUMERIC(12,6) DEFAULT 0,
  share_rate NUMERIC(12,6) DEFAULT 0,
  profile_visit_rate NUMERIC(12,6) DEFAULT 0,
  follow_conversion_rate NUMERIC(12,6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_ig_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_pf_brand_posted ON post_fingerprints(brand_ig_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_pf_brand_hook ON post_fingerprints(brand_ig_id, hook_archetype);

CREATE TABLE IF NOT EXISTS content_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  pillar_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  post_ids TEXT[] NOT NULL DEFAULT '{}',
  avg_quality_engagement NUMERIC(12,4) DEFAULT 0,
  avg_save_rate NUMERIC(12,6) DEFAULT 0,
  avg_share_rate NUMERIC(12,6) DEFAULT 0,
  sample_size INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_ig_id, pillar_key)
);

CREATE INDEX IF NOT EXISTS idx_cp_brand ON content_pillars(brand_ig_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS comment_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  post_id TEXT,
  topic_key TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT 'other',
  sentiment TEXT NOT NULL DEFAULT 'neutral',
  sample_comments TEXT[] NOT NULL DEFAULT '{}',
  mention_count INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_brand_topic ON comment_clusters(brand_ig_id, topic_key, computed_at DESC);

CREATE TABLE IF NOT EXISTS insight_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'p2',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  suggested_action TEXT NOT NULL,
  evidence_post_ids TEXT[] NOT NULL DEFAULT '{}',
  evidence_metrics JSONB NOT NULL DEFAULT '{}',
  detector_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_if_brand_created ON insight_findings(brand_ig_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_if_brand_type ON insight_findings(brand_ig_id, finding_type, created_at DESC);

CREATE TABLE IF NOT EXISTS daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  brief_date DATE NOT NULL,
  headline TEXT NOT NULL,
  synopsis TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]',
  evidence JSONB NOT NULL DEFAULT '[]',
  prompt_version TEXT NOT NULL DEFAULT 'brand-os-brief-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_ig_id, brief_date)
);

CREATE INDEX IF NOT EXISTS idx_db_brand_date ON daily_briefs(brand_ig_id, brief_date DESC);

CREATE TABLE IF NOT EXISTS performance_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  prediction_input JSONB NOT NULL DEFAULT '{}',
  predicted_engagement NUMERIC(12,4) NOT NULL DEFAULT 0,
  confidence NUMERIC(8,4) NOT NULL DEFAULT 0,
  risk_factors JSONB NOT NULL DEFAULT '[]',
  analog_post_ids TEXT[] NOT NULL DEFAULT '{}',
  model_version TEXT NOT NULL DEFAULT 'brand-os-predict-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pp_brand_created ON performance_predictions(brand_ig_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,
  bucket_label TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  follows INTEGER DEFAULT 0,
  UNIQUE (brand_ig_id, post_id, bucket_label, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_pms_brand_post ON post_metric_snapshots(brand_ig_id, post_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_pms_brand_bucket ON post_metric_snapshots(brand_ig_id, bucket_label, captured_at DESC);

CREATE TABLE IF NOT EXISTS brand_ai_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT,
  endpoint TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'n/a',
  model TEXT NOT NULL DEFAULT 'deterministic',
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bacl_endpoint ON brand_ai_call_logs(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bacl_brand ON brand_ai_call_logs(brand_ig_id, created_at DESC);

ALTER TABLE post_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_ai_call_logs ENABLE ROW LEVEL SECURITY;

