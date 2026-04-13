-- Track when user last updated their location (30-day lock).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;
