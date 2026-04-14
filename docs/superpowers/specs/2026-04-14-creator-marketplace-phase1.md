# Creator Marketplace Phase 1: Trust Layer + Creator Storefront

**Date:** 2026-04-14
**Goal:** Build the trust and monetization foundation — portrait visibility controls, integrity score, creator rate card, "what brands see" preview, and enhanced Instagram permissions for marketplace signals.

---

## 1. Instagram Permission Upgrade

### Current Scope
```
instagram_business_basic
```

### New Scope
```
instagram_business_basic,instagram_business_manage_insights
```

`instagram_business_manage_insights` unlocks per-post:
- `reach` — unique accounts who saw the post
- `impressions` — total views
- `saved` — saves (highest intent signal)
- `shares` — shares
- `profile_visits` — from this post
- `follows` — from this post

These feed into both the identity portrait (engagement quality, not just quantity) and brand campaign reporting (verifiable post performance).

### File Changes
- `src/lib/server/instagram.ts` — add `instagram_business_manage_insights` to scope
- `src/lib/server/instagram.ts` — add `fetchPostInsights(token, mediaId)` function
- `src/routes/api/instagram/insights/+server.ts` — already exists, may need enhancement

---

## 2. Database Migrations

### `supabase/010_creator_marketplace.sql`

```sql
-- Creator rate card: what creators charge per activation type
CREATE TABLE IF NOT EXISTS creator_rates (
  user_google_sub TEXT PRIMARY KEY,
  ig_post_rate_inr INTEGER DEFAULT 0,
  ig_story_rate_inr INTEGER DEFAULT 0,
  ig_reel_rate_inr INTEGER DEFAULT 0,
  whatsapp_intro_rate_inr INTEGER DEFAULT 0,
  available BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portrait visibility: what sections are public to brands
CREATE TABLE IF NOT EXISTS portrait_visibility (
  user_google_sub TEXT PRIMARY KEY,
  music_visible BOOLEAN DEFAULT true,
  instagram_visible BOOLEAN DEFAULT true,
  career_visible BOOLEAN DEFAULT true,
  lifestyle_visible BOOLEAN DEFAULT true,
  calendar_visible BOOLEAN DEFAULT false,
  email_visible BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brief responses: creator accepts/declines/completes brand briefs
CREATE TABLE IF NOT EXISTS brief_responses (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  user_google_sub TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ig_post_url TEXT,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payout_inr INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, user_google_sub)
);

CREATE INDEX IF NOT EXISTS idx_brief_responses_user
  ON brief_responses (user_google_sub, status);
```

---

## 3. API Routes

### Creator Rates
**`GET/POST /api/creator/rates`**
- GET: return current rates for the user
- POST: update rates (available, ig_post_rate, ig_story_rate, etc.)

### Portrait Visibility
**`GET/POST /api/creator/visibility`**
- GET: return visibility settings
- POST: update which sections are public

### Brief Response
**`POST /api/creator/brief-response`**
- Body: `{ campaignId, action: 'accept' | 'decline' | 'complete', igPostUrl? }`
- On accept: store acceptance, generate WhatsApp link with brand brief
- On complete: verify Instagram post exists, mark completed, queue payout

### Public Portrait
**`GET /api/creator/public-portrait?sub={googleSub}`**
- Returns the public-facing portrait based on visibility settings
- Used by brand portal for creator cards AND by the user for "what brands see" preview
- Filters identity data based on portrait_visibility settings

---

## 4. Frontend Components

### IntegrityScore.svelte
- Circular SVG ring showing portrait strength (0-100%)
- Breakdown tooltip: which platforms are connected, what's adding/missing signal
- Uses existing `graphStrength.ts` module
- Shown on profile page and earn page

### RateCard.svelte
- Card with 4 rate inputs (IG post, story, reel, WhatsApp intro)
- Currency: INR with ₹ prefix
- "Available for deals" toggle
- Save button → `POST /api/creator/rates`

### VisibilityControls.svelte
- List of data sections with toggle switches
- Preview button → opens PortraitPreview
- Each toggle: section name + description + switch

### PortraitPreview.svelte
- Read-only card showing what brands see
- Uses `GET /api/creator/public-portrait`
- Shows: avatar, name, city, archetype, visible signals, integrity score, rates
- Glass card styling, matches brand portal aesthetic

### OfferCard.svelte
- Inbound brief card for the earn page
- Shows: brand name, brief text, budget, match reason, match score
- Accept/Decline buttons
- On accept: shows WhatsApp link + brief details

---

## 5. Page Changes

### Profile Page (`/profile`)
- Add IntegrityScore component in the hero area
- Add "Visibility & Privacy" link → visibility controls
- Add "Creator Settings" section with RateCard

### Earn Page (`/earn`)
- Redesign header: "Your Offers" not "Campaigns"
- Show IntegrityScore in sidebar/header
- Replace campaign list with OfferCard components
- Add RateCard section
- Add "Preview your portrait" button → PortraitPreview

### Brand Portal (`/brands/portal`)
- Search results show creator rates alongside portrait
- "Send Brief" button creates campaign targeted at specific creator
- Show integrity score as trust badge

---

## 6. WhatsApp Integration

On brief acceptance:
- Creator's phone number is from Wagwan auth (stored in localStorage/Supabase)
- Generate WhatsApp deep link: `https://wa.me/{phone}?text={encodedBrief}`
- Brief text auto-prefilled: "Hi! I'm interested in your campaign: {title}. Brief: {creative_text}"
- Phone shared ONLY after explicit accept — consent architecture

---

## 7. File Map

| Action | File | What |
|--------|------|------|
| Create | `supabase/010_creator_marketplace.sql` | Rate, visibility, brief response tables |
| Create | `src/routes/api/creator/rates/+server.ts` | GET/POST creator rates |
| Create | `src/routes/api/creator/visibility/+server.ts` | GET/POST visibility settings |
| Create | `src/routes/api/creator/brief-response/+server.ts` | Accept/decline/complete briefs |
| Create | `src/routes/api/creator/public-portrait/+server.ts` | Public portrait for brands |
| Create | `src/lib/components/earn/IntegrityScore.svelte` | Portrait strength ring |
| Create | `src/lib/components/earn/RateCard.svelte` | Rate setting card |
| Create | `src/lib/components/earn/OfferCard.svelte` | Inbound brief card |
| Create | `src/lib/components/earn/PortraitPreview.svelte` | "What brands see" |
| Create | `src/lib/components/earn/VisibilityControls.svelte` | Toggle switches per section |
| Modify | `src/lib/server/instagram.ts` | Add manage_insights scope |
| Modify | `src/routes/(app)/earn/+page.svelte` | Redesign with offers + rates + integrity |
| Modify | `src/routes/(app)/profile/+page.svelte` | Add integrity score + creator settings |
| Modify | `src/routes/brands/portal/+page.svelte` | Show rates + integrity in search |
