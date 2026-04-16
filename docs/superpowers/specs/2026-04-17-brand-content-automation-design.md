# Brand Content Automation — Instagram Publishing & Scheduling

**Date:** 2026-04-17
**Status:** Design approved

---

## Problem

Brands currently use the portal only for creator matching. There's no way for a brand to connect their own Instagram account, upload creatives, and schedule posts. The platform needs end-to-end content automation: creatives in → AI-generated plan (captions, hashtags, optimal timing) → review → auto-publish.

## Goal

Build a full content automation system in the brand portal where a brand connects Instagram, uploads creatives to Google Cloud Storage, gets an AI-generated posting plan based on their audience insights and post history, reviews/edits the plan, and the system auto-publishes at the scheduled times.

## Design

### 1. Brand Instagram Auth (replacing password login)

**OAuth flow:**
- Brand visits `/brands/login` → "Connect with Instagram" button (no more password field)
- Redirects to `/auth/brand-instagram` → Instagram OAuth with scopes: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_manage_insights`, `instagram_manage_comments`
- Callback creates/updates a `brand_accounts` row in Supabase:
  - `ig_user_id` (primary key)
  - `ig_username`, `ig_name`, `ig_profile_picture`, `ig_followers_count`
  - `ig_access_token` (long-lived, 60-day expiry)
  - `token_expires_at`
  - `created_at`, `last_login_at`
- Sets a signed `wagwan_brand_session` cookie with `ig_user_id` as identity
- Redirects to `/brands/portal`

**Separate from user Instagram:**
- Separate OAuth route: `/auth/brand-instagram` (not `/auth/instagram`)
- Separate table: `brand_accounts` (not `user_profiles`)
- Different callback, cookie, session validation
- Same IG account can exist in both tables independently

**Token refresh:**
- Long-lived tokens last 60 days
- On each portal visit, if token expires within 7 days → auto-refresh via Instagram token refresh endpoint

### 2. Google Cloud Storage

- **Bucket:** `wagwan-ai`
- **Service account:** `wagwan-cms@wagwan-bb02b.iam.gserviceaccount.com`
- **Auth:** JSON service account key stored as env var `GCS_SERVICE_ACCOUNT_KEY`
- **Upload endpoint:** `POST /api/brand/upload` — accepts image/video, uploads to GCS, returns public URL
- **Path structure:** `brands/{ig_user_id}/{timestamp}-{filename}`
- **Limits:** 8MB images (JPEG), 100MB video (MP4)
- **Access:** Public read on the bucket (Instagram API needs to fetch the URL)

### 3. Content Automation Engine

**Flow:**
1. Brand uploads creatives (multi-file drag & drop) → stored in GCS
2. Brand hits "Generate Plan" → AI analyzes:
   - Creatives (Claude vision on images/thumbnails)
   - Instagram insights (`online_followers` hourly data) — fetched only for new posts, cached and accumulated as history
   - Brand's last 10 posts (engagement patterns, caption style, hashtag performance)
3. AI produces a content plan per creative:
   - Caption (matching brand voice)
   - Hashtags
   - Post type (feed/carousel/reel/story) — auto-detected from file type + dimensions
   - Scheduled time (optimal based on insights)
   - Reasoning ("Your audience is most active Tue/Thu 7-9pm...")
4. Brand reviews — edit captions, times, hashtags inline, reorder, delete
5. Brand approves → posts move to `scheduled` status
6. Vercel cron job (`/api/cron/publish-scheduled`, every 5 minutes) publishes due posts:
   - Create container: `POST /{ig_id}/media` with GCS public URL
   - Poll status until `FINISHED`
   - Publish: `POST /{ig_id}/media_publish`
   - Update status to `published` or `failed`

**Post types supported:** Single images, carousels (up to 10 items), reels, stories.

### 4. Supabase Schema

**`brand_accounts`:**
- `ig_user_id` (text, PK)
- `ig_username` (text)
- `ig_name` (text)
- `ig_profile_picture` (text)
- `ig_followers_count` (integer)
- `ig_access_token` (text)
- `token_expires_at` (timestamptz)
- `created_at` (timestamptz)
- `last_login_at` (timestamptz)

**`scheduled_posts`:**
- `id` (uuid, PK)
- `brand_ig_id` (text, FK → brand_accounts)
- `gcs_url` (text)
- `media_type` (text: IMAGE/VIDEO/CAROUSEL/REELS/STORIES)
- `caption` (text)
- `hashtags` (text[])
- `alt_text` (text)
- `scheduled_at` (timestamptz)
- `published_at` (timestamptz)
- `status` (text: draft/scheduled/publishing/published/failed)
- `ig_media_id` (text)
- `ig_permalink` (text)
- `error_message` (text)
- `ai_reasoning` (text)
- `created_at` (timestamptz)

**`scheduled_post_carousel_items`:**
- `id` (uuid, PK)
- `post_id` (uuid, FK → scheduled_posts)
- `gcs_url` (text)
- `media_type` (text: IMAGE/VIDEO)
- `position` (integer)

**`brand_insights_cache`:**
- `id` (uuid, PK)
- `brand_ig_id` (text, FK → brand_accounts)
- `insights_data` (jsonb — online_followers, post performance, etc.)
- `fetched_at` (timestamptz)

### 5. Insights-Based Intelligence

**Data sources:**
1. **Instagram Insights API:** `online_followers` (hourly breakdown of when followers are active), per-post `impressions`, `reach`, `engagement`, `saved`
2. **AI analysis of last 10 posts:** content type performance, caption style, optimal frequency, hashtag effectiveness

**How AI uses both:**
- Instagram insights → raw time slots when followers are online
- Post history → what content at what time performed best
- Combined with creative content analysis → optimal schedule + captions

**Caching:**
- Insights fetched only when generating a plan for new posts
- Cached in `brand_insights_cache` table
- History accumulates — each fetch is stored, AI uses full history for richer recommendations

### 6. Brand Portal UI — Content Studio Tab

**Tab toggle at top of portal:** "Find Creators" (existing) | "Content Studio" (new, default)

**Content Studio layout:**
1. **Account bar** — IG profile picture, username, follower count, last posted time
2. **Upload zone** — drag & drop, multi-file, thumbnails during upload, auto-detect post type
3. **"Generate Plan" button** — triggers AI analysis, shows thinking state
4. **Content plan view** — vertical timeline of scheduled posts:
   - Each card: thumbnail, editable caption, editable hashtags, editable time, post type, AI reasoning (collapsible)
   - Inline editing on all fields
   - Delete, reorder, add manually
5. **"Approve & Schedule"** — locks plan, posts move to scheduled
6. **Published feed** — published posts with engagement metrics (likes, comments, reach)

### 7. Out of Scope

- DM/messaging automation
- Comment management
- Multi-user access per brand
- Payment/billing
- A/B testing of captions
- Existing "Find Creators" flow is untouched
