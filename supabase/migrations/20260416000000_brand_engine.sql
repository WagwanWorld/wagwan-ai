-- Brand Engine DB Schema
-- Task 1: 4 tables + privacy column + correlation seed data

-- ─── brand_queries ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_queries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         text NOT NULL,
  brand_name       text,
  raw_prompt       text NOT NULL,
  parsed_intent    jsonb NOT NULL,
  expanded_signals jsonb,
  result_summary   jsonb,
  match_count      integer DEFAULT 0,
  cohort_count     integer DEFAULT 0,
  processing_ms    integer,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bq_brand ON brand_queries(brand_id, created_at DESC);

-- ─── brand_audience_matches ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_audience_matches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id          uuid REFERENCES brand_queries(id) ON DELETE CASCADE,
  user_google_sub   text NOT NULL,
  match_tier        integer NOT NULL CHECK (match_tier BETWEEN 1 AND 5),
  match_score       float NOT NULL,
  match_confidence  float NOT NULL,
  cohort_id         text,
  matched_signals   jsonb NOT NULL,
  correlation_paths jsonb,
  explanation       text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bam_query ON brand_audience_matches(query_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_bam_user  ON brand_audience_matches(user_google_sub);
CREATE INDEX IF NOT EXISTS idx_bam_tier  ON brand_audience_matches(query_id, match_tier);

-- ─── correlation_index ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS correlation_index (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_a        text NOT NULL,
  signal_a_cat    text NOT NULL,
  signal_b        text NOT NULL,
  signal_b_cat    text NOT NULL,
  correlation_r   float NOT NULL,
  support_count   integer NOT NULL,
  lift            float NOT NULL,
  confidence      float NOT NULL,
  domain_distance integer NOT NULL,
  last_computed   timestamptz DEFAULT now(),
  is_active       boolean DEFAULT true,
  source          text DEFAULT 'discovered'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_corr_unique ON correlation_index(signal_a, signal_b);
CREATE INDEX IF NOT EXISTS idx_corr_a    ON correlation_index(signal_a, correlation_r DESC);
CREATE INDEX IF NOT EXISTS idx_corr_cat  ON correlation_index(signal_a_cat, signal_b_cat);
CREATE INDEX IF NOT EXISTS idx_corr_lift ON correlation_index(lift DESC) WHERE is_active = true;

-- ─── brand_cohorts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_cohorts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id        uuid REFERENCES brand_queries(id) ON DELETE CASCADE,
  cohort_id       text NOT NULL,
  label           text NOT NULL,
  description     text,
  user_count      integer NOT NULL,
  avg_match_score float,
  avg_confidence  float,
  top_signals     jsonb,
  centroid_vector jsonb,
  created_at      timestamptz DEFAULT now()
);

-- ─── Privacy column on profiles ──────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_matching_opt_out boolean DEFAULT false;

-- ─── Cultural seed data for correlation_index ────────────────────────────────
INSERT INTO correlation_index
  (signal_a, signal_a_cat, signal_b, signal_b_cat, correlation_r, support_count, lift, confidence, domain_distance, source)
VALUES
  ('Justin Bieber',       'music genre cluster',   'streetwear',            'instagram descriptor', 0.45, 100, 2.4, 0.65, 3, 'seed_cultural'),
  ('streetwear',          'instagram descriptor',  'Justin Bieber',         'music genre cluster',  0.45, 100, 1.8, 0.55, 3, 'seed_cultural'),
  ('AP Dhillon',          'music genre cluster',   'luxury fashion',        'brand vibe',           0.42,  80, 2.1, 0.60, 3, 'seed_cultural'),
  ('luxury fashion',      'brand vibe',            'AP Dhillon',            'music genre cluster',  0.42,  80, 1.6, 0.48, 3, 'seed_cultural'),
  ('indie',               'music genre',           'film photography',      'instagram interest',   0.58, 120, 3.1, 0.72, 2, 'seed_cultural'),
  ('film photography',    'instagram interest',    'indie',                 'music genre',          0.58, 120, 2.4, 0.65, 2, 'seed_cultural'),
  ('ghazal',              'music genre',           'fine dining',           'lifestyle signal',     0.38,  60, 1.9, 0.55, 3, 'seed_cultural'),
  ('Raj Shamani',         'music genre cluster',   'SaaS tools',            'profile interest',     0.52,  90, 2.8, 0.70, 3, 'seed_cultural'),
  ('design school',       'profile interest',      'film aesthetic',        'instagram descriptor', 0.50,  85, 2.6, 0.68, 2, 'seed_cultural'),
  ('Zach Bryan',          'music genre cluster',   'outdoor gear',          'profile interest',     0.44,  75, 2.2, 0.61, 3, 'seed_cultural'),
  ('morning worker',      'calendar pattern',      'protein supplement',    'lifestyle signal',     0.40,  70, 2.0, 0.58, 2, 'seed_cultural'),
  ('founder',             'professional identity', 'premium productivity',  'brand vibe',           0.60, 150, 3.4, 0.78, 2, 'seed_cultural'),
  ('premium productivity','brand vibe',            'founder',               'professional identity', 0.60, 150, 2.8, 0.70, 2, 'seed_cultural'),
  ('travel planner',      'calendar pattern',      'audio gear',            'brand vibe',           0.36,  65, 1.8, 0.53, 2, 'seed_cultural'),
  ('high engagement',     'instagram pattern',     'brand collaboration',   'lifestyle signal',     0.54, 110, 2.9, 0.71, 1, 'seed_cultural')
ON CONFLICT (signal_a, signal_b) DO UPDATE SET
  lift        = EXCLUDED.lift,
  confidence  = EXCLUDED.confidence,
  is_active   = true,
  source      = EXCLUDED.source;
