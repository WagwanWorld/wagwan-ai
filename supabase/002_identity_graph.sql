-- Add identity graph columns to user_profiles
-- Run after migration.sql

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS identity_graph jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS identity_summary text NOT NULL DEFAULT '';
