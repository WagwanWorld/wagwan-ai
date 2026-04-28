-- Brand assets (logos, fonts)
CREATE TABLE IF NOT EXISTS brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('logo_primary', 'logo_mark', 'font_file', 'watermark')),
  variant TEXT CHECK (variant IN ('light', 'dark', 'mono')),
  format TEXT NOT NULL CHECK (format IN ('svg', 'woff2', 'png', 'ttf', 'otf')),
  url TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_brand_assets_brand ON brand_assets(brand_account_id);

-- Creative generations (session tracking)
CREATE TABLE IF NOT EXISTS creative_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  generation_session_id UUID DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL CHECK (mode IN ('copy_first', 'from_scratch')),
  format TEXT NOT NULL DEFAULT 'static_4x5',
  brief TEXT,
  copy_input TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'approved', 'abandoned')),
  active_version INTEGER DEFAULT 1,
  approved_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_creative_gen_brand ON creative_generations(brand_account_id, created_at DESC);

-- Generation versions (each regeneration/revision)
CREATE TABLE IF NOT EXISTS creative_generation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES creative_generations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  image_gcs_url TEXT,
  thumbnail_url TEXT,
  direction_payload JSONB DEFAULT '{}',
  copy_payload JSONB DEFAULT '{}',
  qc_report JSONB DEFAULT '{}',
  cost_usd NUMERIC(10,5) DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(generation_id, version)
);

-- Taste log (learning)
CREATE TABLE IF NOT EXISTS creative_taste_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  generation_id UUID,
  type TEXT NOT NULL CHECK (type IN ('generation', 'revision', 'approval', 'rejection')),
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_taste_log_brand ON creative_taste_log(brand_account_id, created_at DESC);

-- Cost log
CREATE TABLE IF NOT EXISTS creative_cost_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  generation_id UUID,
  call_type TEXT NOT NULL CHECK (call_type IN ('direction', 'image_generation', 'composite', 'qc', 'revision', 'context_build')),
  model_used TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,5) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cost_log_brand ON creative_cost_log(brand_account_id, created_at DESC);

-- Creative context column on brand_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_accounts' AND column_name = 'creative_context'
  ) THEN
    ALTER TABLE brand_accounts ADD COLUMN creative_context JSONB DEFAULT '{}';
  END IF;
END $$;
