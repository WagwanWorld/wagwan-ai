-- ============================================
-- MANUAL ONLY: DROP UNUSED TABLES
-- 2026-05-09: Remove 9 tables with zero code references
-- ============================================
-- Do not place this file under supabase/migrations. Run it manually only when
-- intentionally resetting a non-production database.

BEGIN;

-- Creative Studio (never implemented) - 20260428100000_creative_studio.sql
DROP TABLE IF EXISTS creative_generation_versions CASCADE;
DROP TABLE IF EXISTS creative_taste_log CASCADE;
DROP TABLE IF EXISTS creative_cost_log CASCADE;
DROP TABLE IF EXISTS creative_generations CASCADE;

-- Carousel items (never built) - 20260417000000_brand_content_automation.sql
DROP TABLE IF EXISTS scheduled_post_carousel_items CASCADE;

-- Content activity log (never wired up) - 20260428000000_content_activity_log.sql
DROP TABLE IF EXISTS content_activity_log CASCADE;

-- Agent memory (defined but never used) - 003_multi_agent_chats.sql
DROP TABLE IF EXISTS agent_memory CASCADE;

-- Brand intelligence stubs (never used) - 20260418000000_brand_intelligence.sql
DROP TABLE IF EXISTS brand_competitors CASCADE;
DROP TABLE IF EXISTS brand_action_proposals CASCADE;

COMMIT;
