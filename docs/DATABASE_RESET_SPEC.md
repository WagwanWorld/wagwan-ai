# Database Reset Spec: Fresh Start

**Goal:** Drop unused tables, wipe all data, keep schema, test fresh user signup/login.

---

## Step 1: Drop 9 Unused Tables

Run `supabase/migrations/20260509000000_drop_unused_tables.sql` in the Supabase SQL Editor.

| Table                           | Why it's dead                     |
| ------------------------------- | --------------------------------- |
| `creative_generations`          | Creative Studio never implemented |
| `creative_generation_versions`  | Creative Studio never implemented |
| `creative_taste_log`            | Creative Studio never implemented |
| `creative_cost_log`             | Creative Studio never implemented |
| `scheduled_post_carousel_items` | Carousel feature never built      |
| `content_activity_log`          | Activity logging never wired up   |
| `agent_memory`                  | Defined but never read/written    |
| `brand_competitors`             | Schema only, no code references   |
| `brand_action_proposals`        | Schema only, no code references   |

---

## Step 2: Truncate All Data

Run `supabase/migrations/20260509000001_truncate_all_data.sql` in the Supabase SQL Editor.

Truncates all 34 remaining active tables in FK-safe order (children first):

| Category            | Tables                                                                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand Creative      | brand_assets                                                                                                                                                                                                         |
| Brand OS V2         | post_fingerprints, content_pillars, comment_clusters, insight_findings, daily_briefs, performance_predictions, post_metric_snapshots, brand_ai_call_logs, brand_weekly_briefs, brand_insights_cache, scheduled_posts |
| Brand Engine        | brand_queries, brand_audience_matches, brand_cohorts, correlation_index                                                                                                                                              |
| Brand Accounts      | brand_accounts                                                                                                                                                                                                       |
| Creator Marketplace | campaigns, brands, campaign_audience, campaign_interactions, brief_responses, brief_assets, user_earnings, creator_rates, portrait_visibility, user_marketing_prefs                                                  |
| Chat & Agents       | chats, messages, agent_states                                                                                                                                                                                        |
| Identity            | user_identity_claims, user_identity_inference_snapshots                                                                                                                                                              |
| Cache               | cached_content                                                                                                                                                                                                       |
| Core                | user_profiles                                                                                                                                                                                                        |

---

## Step 3: Verify Clean State

```sql
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;
```

Expected: all tables show 0 rows, 9 dropped tables no longer appear.

---

## Step 4: Fresh Login Smoke Test

### Creator Flow

- [ ] Open app in incognito browser
- [ ] Hit landing page (`/`)
- [ ] Enter phone number / send OTP via wagwan gRPC
- [ ] Verify OTP, get session token
- [ ] Verify `user_profiles` row created with google_sub
- [ ] Connect Instagram — OAuth flow completes, tokens stored in `platform_tokens`
- [ ] Connect Spotify — same
- [ ] Check `/home` loads without errors
- [ ] Identity graph builds (check `user_identity_claims` populates)
- [ ] Chat agents initialize (check `chats` table for agent_type rows)

### Brand Flow

- [ ] Navigate to brand portal
- [ ] Connect Instagram as brand
- [ ] Verify `brand_accounts` row created with `ig_user_id`
- [ ] Brand OS dashboard loads
- [ ] Create a brief/campaign
- [ ] Verify `campaigns` row created

---

## What This Does NOT Touch

- Schema of all 34 active tables (indexes, triggers, RLS policies)
- PostgreSQL extensions (pgvector, pg_trgm)
- Supabase project settings, API keys, storage buckets
- Environment variables / .env files
- Application code (nothing references the dropped tables)

---

## Rollback

There is no rollback for the data truncation. Restore from a Supabase backup if needed (Dashboard > Settings > Database > Backups).
