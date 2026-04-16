-- Enable RLS on brand engine tables (default-deny)
-- All writes go through service-role key which bypasses RLS
-- This prevents accidental anon/user-scoped client reads

ALTER TABLE brand_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_audience_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE correlation_index ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default (no policies needed for server access)
-- Add brand-scoped read policies here when brand auth is implemented

-- Allow public read of correlation_index for the correlations explorer
-- (no PII, just signal metadata)
CREATE POLICY "correlation_index_public_read" ON correlation_index
  FOR SELECT USING (is_active = true);
