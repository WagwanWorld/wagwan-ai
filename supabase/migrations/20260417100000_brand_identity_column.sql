-- Add brand identity column to store full IG identity analysis
ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS brand_identity JSONB DEFAULT '{}';
ALTER TABLE brand_accounts ADD COLUMN IF NOT EXISTS identity_updated_at TIMESTAMPTZ;
