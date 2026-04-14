# Creator Marketplace Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the trust layer and creator storefront — portrait visibility controls, integrity score, creator rate card, public portrait preview, inbound brief flow with WhatsApp, and Instagram insights scope upgrade.

**Architecture:** Three new Supabase tables (creator_rates, portrait_visibility, brief_responses) with CRUD API routes. Five new Svelte components for the earn/profile pages. Instagram OAuth scope upgraded to include manage_insights. The earn page is redesigned around inbound offers with rate setting. WhatsApp deep links on brief acceptance.

**Tech Stack:** SvelteKit, TypeScript, Supabase, Svelte 5

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/010_creator_marketplace.sql` | DB tables: creator_rates, portrait_visibility, brief_responses |
| Create | `src/lib/server/creatorMarketplace.ts` | Supabase helpers for rates, visibility, briefs |
| Create | `src/routes/api/creator/rates/+server.ts` | GET/POST creator rates |
| Create | `src/routes/api/creator/visibility/+server.ts` | GET/POST visibility settings |
| Create | `src/routes/api/creator/brief-response/+server.ts` | POST accept/decline/complete |
| Create | `src/routes/api/creator/public-portrait/+server.ts` | GET public portrait for brands |
| Create | `src/lib/components/earn/IntegrityScore.svelte` | SVG portrait strength ring |
| Create | `src/lib/components/earn/RateCard.svelte` | Rate setting inputs |
| Create | `src/lib/components/earn/OfferCard.svelte` | Inbound brief card |
| Create | `src/lib/components/earn/PortraitPreview.svelte` | "What brands see" read-only card |
| Create | `src/lib/components/earn/VisibilityControls.svelte` | Section toggle switches |
| Modify | `src/lib/server/instagram.ts` | Add manage_insights to OAuth scope |
| Modify | `src/routes/(app)/earn/+page.svelte` | Redesign with offers + rates + integrity |
| Modify | `src/routes/(app)/profile/+page.svelte` | Add integrity score + creator settings link |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/010_creator_marketplace.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Creator rate card
CREATE TABLE IF NOT EXISTS creator_rates (
  user_google_sub TEXT PRIMARY KEY,
  ig_post_rate_inr INTEGER DEFAULT 0,
  ig_story_rate_inr INTEGER DEFAULT 0,
  ig_reel_rate_inr INTEGER DEFAULT 0,
  whatsapp_intro_rate_inr INTEGER DEFAULT 0,
  available BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portrait visibility
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

-- Brief responses
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

- [ ] **Step 2: Commit**

```bash
git add supabase/010_creator_marketplace.sql
git commit -m "feat(db): add creator_rates, portrait_visibility, brief_responses tables"
```

---

### Task 2: Supabase Helpers Module

**Files:**
- Create: `src/lib/server/creatorMarketplace.ts`

- [ ] **Step 1: Create the module**

Create `src/lib/server/creatorMarketplace.ts` with these functions using the `getServiceSupabase()` pattern from existing `supabase.ts`:

```typescript
import { getServiceSupabase } from './supabase';

// ── Types ──
export interface CreatorRates {
  ig_post_rate_inr: number;
  ig_story_rate_inr: number;
  ig_reel_rate_inr: number;
  whatsapp_intro_rate_inr: number;
  available: boolean;
}

export interface PortraitVisibility {
  music_visible: boolean;
  instagram_visible: boolean;
  career_visible: boolean;
  lifestyle_visible: boolean;
  calendar_visible: boolean;
  email_visible: boolean;
}

export interface BriefResponse {
  id: number;
  campaign_id: number;
  user_google_sub: string;
  status: string;
  ig_post_url: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  paid_at: string | null;
  payout_inr: number;
  created_at: string;
}

// ── Rates ──
export async function getRates(sub: string): Promise<CreatorRates | null> {
  const { data } = await getServiceSupabase()
    .from('creator_rates').select('*').eq('user_google_sub', sub).single();
  return data ?? null;
}

export async function upsertRates(sub: string, rates: Partial<CreatorRates>): Promise<boolean> {
  const { error } = await getServiceSupabase()
    .from('creator_rates').upsert({
      user_google_sub: sub, ...rates, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_google_sub' });
  return !error;
}

// ── Visibility ──
export async function getVisibility(sub: string): Promise<PortraitVisibility | null> {
  const { data } = await getServiceSupabase()
    .from('portrait_visibility').select('*').eq('user_google_sub', sub).single();
  return data ?? null;
}

export async function upsertVisibility(sub: string, vis: Partial<PortraitVisibility>): Promise<boolean> {
  const { error } = await getServiceSupabase()
    .from('portrait_visibility').upsert({
      user_google_sub: sub, ...vis, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_google_sub' });
  return !error;
}

// ── Brief Responses ──
export async function respondToBrief(
  sub: string, campaignId: number, action: 'accept' | 'decline'
): Promise<BriefResponse | null> {
  const now = new Date().toISOString();
  const { data, error } = await getServiceSupabase()
    .from('brief_responses').upsert({
      campaign_id: campaignId,
      user_google_sub: sub,
      status: action === 'accept' ? 'accepted' : 'declined',
      accepted_at: action === 'accept' ? now : null,
      created_at: now,
    }, { onConflict: 'campaign_id,user_google_sub' }).select().single();
  if (error) console.error('[creatorMarketplace] respondToBrief error:', error.message);
  return data ?? null;
}

export async function completeBrief(
  sub: string, campaignId: number, igPostUrl: string
): Promise<boolean> {
  const { error } = await getServiceSupabase()
    .from('brief_responses')
    .update({ status: 'completed', ig_post_url: igPostUrl, completed_at: new Date().toISOString() })
    .eq('campaign_id', campaignId).eq('user_google_sub', sub).eq('status', 'accepted');
  return !error;
}

export async function getUserBriefs(sub: string): Promise<BriefResponse[]> {
  const { data } = await getServiceSupabase()
    .from('brief_responses').select('*').eq('user_google_sub', sub).order('created_at', { ascending: false });
  return data ?? [];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/creatorMarketplace.ts
git commit -m "feat: add creatorMarketplace Supabase helpers for rates, visibility, briefs"
```

---

### Task 3: API Routes (rates, visibility, brief-response, public-portrait)

**Files:**
- Create: `src/routes/api/creator/rates/+server.ts`
- Create: `src/routes/api/creator/visibility/+server.ts`
- Create: `src/routes/api/creator/brief-response/+server.ts`
- Create: `src/routes/api/creator/public-portrait/+server.ts`

- [ ] **Step 1: Create rates endpoint**

`GET /api/creator/rates?sub=X` → returns rates
`POST /api/creator/rates` → body `{ sub, rates: { ig_post_rate_inr, ... } }` → upserts

Use `getRates` and `upsertRates` from `creatorMarketplace.ts`. Pattern: same as existing `/api/user/marketing-prefs`.

- [ ] **Step 2: Create visibility endpoint**

`GET /api/creator/visibility?sub=X` → returns visibility
`POST /api/creator/visibility` → body `{ sub, visibility: { music_visible, ... } }` → upserts

Use `getVisibility` and `upsertVisibility`.

- [ ] **Step 3: Create brief-response endpoint**

`POST /api/creator/brief-response` → body `{ sub, campaignId, action: 'accept'|'decline'|'complete', igPostUrl? }`

On accept: call `respondToBrief`, return the brief + a WhatsApp deep link.
On complete: call `completeBrief` with the igPostUrl.
On decline: call `respondToBrief` with 'decline'.

WhatsApp link generation:
```typescript
const phone = /* read from profile or wagwan auth */ '';
const text = encodeURIComponent(`Hi! Responding to campaign: ${campaign.title}`);
const whatsappLink = phone ? `https://wa.me/${phone.replace('+', '')}?text=${text}` : '';
```

- [ ] **Step 4: Create public-portrait endpoint**

`GET /api/creator/public-portrait?sub=X` → returns filtered portrait based on visibility settings.

Load profile + identity graph + visibility settings. Filter out sections where `visible === false`. Return: name, city, archetype, vibe tags, visible signals, integrity score (from `computeGraphStrength`), rates (from `getRates`), Instagram stats (followers, media count).

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/creator/
git commit -m "feat(api): add creator rates, visibility, brief-response, public-portrait endpoints"
```

---

### Task 4: Instagram Scope Upgrade

**Files:**
- Modify: `src/lib/server/instagram.ts`

- [ ] **Step 1: Add manage_insights to scope**

In `getInstagramAuthUrl`, change:
```typescript
scope: 'instagram_business_basic',
```
To:
```typescript
scope: 'instagram_business_basic,instagram_business_manage_insights',
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/instagram.ts
git commit -m "feat(instagram): add manage_insights scope for post reach/impressions/saves"
```

---

### Task 5: IntegrityScore Component

**Files:**
- Create: `src/lib/components/earn/IntegrityScore.svelte`

- [ ] **Step 1: Create the component**

Props: `score: number` (0-100), `label: string`, `sourceCount: number`, `breakdown: { name: string, connected: boolean }[]`

SVG circular ring (same pattern as ScoreRings but larger — 96x96), score number in center, label below, breakdown as a list of platform pills (green if connected, gray if not).

Design: use `#FF4D4D`/`#4D7CFF`/`#FFB84D` gradient on the ring stroke. Glass card background. The ring should show the score as fill percentage.

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/earn/IntegrityScore.svelte
git commit -m "feat: add IntegrityScore SVG ring component"
```

---

### Task 6: RateCard Component

**Files:**
- Create: `src/lib/components/earn/RateCard.svelte`

- [ ] **Step 1: Create the component**

Props: `rates: CreatorRates`, events: `on:save`

Glass card with:
- Title: "Your Rates"
- 4 input rows, each: emoji + label + `₹` input field
  - 📸 Instagram Post — `ig_post_rate_inr`
  - 📱 Instagram Story — `ig_story_rate_inr`
  - 🎬 Instagram Reel — `ig_reel_rate_inr`
  - 💬 WhatsApp Intro — `whatsapp_intro_rate_inr`
- Toggle: "Open to brand deals" — `available`
- Save button → dispatches `save` event with rates object

Input styling: use existing `.ob-input` pattern (glass background, border-subtle, font-mono for numbers).

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/earn/RateCard.svelte
git commit -m "feat: add RateCard component with rate inputs and availability toggle"
```

---

### Task 7: OfferCard Component

**Files:**
- Create: `src/lib/components/earn/OfferCard.svelte`

- [ ] **Step 1: Create the component**

Props: `campaign: { campaign_id, brand_name, title, creative_text, reward_inr, match_reason, match_score }`, events: `on:accept`, `on:decline`

Glass card with:
- Brand name (accent color) + match score badge (red/blue/gold based on score)
- Campaign title (bold)
- Creative brief text (secondary)
- Reward: `₹{reward_inr}`
- Match reason (italic, muted)
- Two buttons: "Accept" (primary gradient CTA) + "Decline" (ghost button)
- On accept → dispatch `accept` event with campaign_id
- On decline → dispatch `decline` event

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/earn/OfferCard.svelte
git commit -m "feat: add OfferCard component for inbound brand briefs"
```

---

### Task 8: VisibilityControls + PortraitPreview Components

**Files:**
- Create: `src/lib/components/earn/VisibilityControls.svelte`
- Create: `src/lib/components/earn/PortraitPreview.svelte`

- [ ] **Step 1: Create VisibilityControls**

Props: `visibility: PortraitVisibility`, events: `on:save`

List of toggle rows, each: section icon/emoji + label + description + toggle switch.
Sections:
- 🎵 Music Taste — "Your listening patterns and genres"
- 📱 Instagram — "Your posts, aesthetic, and engagement"
- 💼 Career — "Your professional signals and role"
- 🌍 Lifestyle — "Your interests, activities, and preferences"
- 📅 Calendar — "Your schedule patterns" (default off)
- 📧 Email — "Your communication patterns" (default off)

Toggle switch: styled checkbox with CSS toggle appearance. On change → dispatch `save` with updated visibility object.

- [ ] **Step 2: Create PortraitPreview**

Props: `portrait: { name, city, archetype, vibeTags, integrityScore, rates, instagramStats, visibleSignals }`

Read-only glass card showing the public portrait as a brand would see it:
- Avatar placeholder + name + city
- Archetype sentence
- Vibe tag pills
- Integrity score badge
- Rates (if set)
- Instagram: followers + posts
- Visible signal sections listed

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/earn/VisibilityControls.svelte src/lib/components/earn/PortraitPreview.svelte
git commit -m "feat: add VisibilityControls and PortraitPreview components"
```

---

### Task 9: Redesign Earn Page

**Files:**
- Modify: `src/routes/(app)/earn/+page.svelte`

- [ ] **Step 1: Add imports and data loading**

Import the new components. Add fetch calls for rates, visibility, and brief responses in the `loadAll` function. Add reactive variables for the new data.

- [ ] **Step 2: Restructure the page layout**

The earn page should now have this structure:

```
Header: "Your Offers" + IntegrityScore ring
───
Section: RateCard (set your rates)
───
Section: "Inbound Briefs" — list of OfferCards from matched campaigns
  - Each card has Accept/Decline
  - On Accept → POST /api/creator/brief-response → show WhatsApp link
───
Section: VisibilityControls
───
Section: "Preview Your Portrait" button → opens PortraitPreview modal/section
───
Section: Wallet (existing — keep as-is)
```

- [ ] **Step 3: Wire up event handlers**

- RateCard `on:save` → `POST /api/creator/rates`
- OfferCard `on:accept` → `POST /api/creator/brief-response` with action 'accept'
- OfferCard `on:decline` → `POST /api/creator/brief-response` with action 'decline'
- VisibilityControls `on:save` → `POST /api/creator/visibility`

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/earn/+page.svelte
git commit -m "feat(earn): redesign page with offers, rates, visibility, and integrity score"
```

---

### Task 10: Add Integrity Score to Profile Page

**Files:**
- Modify: `src/routes/(app)/profile/+page.svelte`

- [ ] **Step 1: Add IntegrityScore to the profile hero area**

Import IntegrityScore. The profile page already fetches graph strength data (check if it does — if not, add the fetch). Display the IntegrityScore ring near the user's name/avatar.

Add a "Creator Settings" link that navigates to `/earn` (where the full rate card and visibility controls live).

- [ ] **Step 2: Commit**

```bash
git add src/routes/\(app\)/profile/+page.svelte
git commit -m "feat(profile): add integrity score and creator settings link"
```

---

### Task 11: Build and Verify

**Files:** None (verification only)

- [ ] **Step 1: Type-check**

```bash
cd /Users/madhviknemani/wagwan-ai && npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "^[0-9]+ (ERROR|COMPLETED)" | tail -10
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Apply migration**

Run `supabase/010_creator_marketplace.sql` in the Supabase SQL Editor.

- [ ] **Step 4: Test**

```bash
npm run dev
```

Test:
1. `/earn` — should show new layout with rate card, visibility controls, integrity score
2. Set rates and save — verify in Supabase
3. Toggle visibility settings — verify in Supabase
4. `/api/creator/public-portrait?sub=X` — verify filtered portrait respects visibility
5. Accept a campaign offer — verify WhatsApp link appears
