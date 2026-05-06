# Creator Brief Experience

**Date:** 2026-05-06
**Status:** Approved
**Scope:** Creator-facing brief browsing, detail view, and response flow. Part 1 of 2 (Part 2: Brand AI Brief Wizard).

## Problem

Creators currently see incoming briefs crammed into a small bento card on the home dashboard. There's no way to browse all briefs, understand campaign details, see why they matched, or track proof submission in a dedicated UI. The brief experience needs to feel like the primary product — the reason creators open Wagwan.

## Design

### 1. Home Page — Brief Summary Card

Replace the current `os-card--requests` content with a compact "Your Briefs" card:

- Count of pending briefs (e.g. "3 briefs waiting")
- Top 2 brief cards inline showing: brand name, title, reward (₹), match score pill
- "View all briefs →" link to `/briefs`
- Spans 2 columns in the bento grid (same as current requests card)
- Tier 2 glass treatment

### 2. Navigation — Add Briefs

**Sidebar** (`DesktopSidebar.svelte`): Home / **Briefs** / Earn / Profile
**Mobile tabs** (`FloatingNav.svelte`): Home / **Briefs** / Earn / Profile

Use `Briefcase` icon from phosphor-svelte. Active state: lime `#c4f24a`.

### 3. `/briefs` List Page

**Route:** `src/routes/(app)/briefs/+page.svelte`

**Layout:** Full page with the app shell (sidebar + gradient background). Scrollable.

**Header:**

- Page title: "Briefs"
- Filter tabs: All | Pending | Accepted | Completed

**Section 1 — Your Briefs (targeted):**
Briefs from `campaign_audience` where `brief_status != declined`. Sorted newest first.

Each brief card shows:

- Brand initial circle (colored) + brand name
- Brief title (bold)
- Reward amount in lime `#c4f24a` (prominent, e.g. "₹8,000")
- Match score pill (e.g. "92% fit") in lime background
- Status badge: sent (neutral), accepted (lime), live (magenta), completed (green)
- Brief snippet — first 80 characters of `creative_text`
- Click navigates to `/briefs/[campaign_id]`

Card styling: Tier 3 glass (20px radius, 12px blur). Hover: lime border glow.

Grid: `repeat(auto-fit, minmax(320px, 1fr))` — responsive cards, no fixed columns.

**Section 2 — Discover:**
Active campaigns where the creator is NOT in `campaign_audience`.

Same card format but:

- No match score (they weren't targeted)
- "Explore →" button instead of status badge
- Slightly dimmer styling (lower opacity border)
- Click navigates to `/briefs/[campaign_id]`

**Empty states:**

- No targeted briefs: "No briefs yet — brands are discovering your signal portrait. Keep building your identity."
- No discover briefs: "No open campaigns right now. Check back soon."

### 4. `/briefs/[id]` Detail Page

**Route:** `src/routes/(app)/briefs/[id]/+page.svelte`

**Back link:** "← All briefs" at top, links to `/briefs`

**Top section:**

- Brand profile: initial circle + brand name + brief title (large heading, `font-display`)
- Reward amount — large lime number in Bodoni Moda (e.g. "₹8,000")
- Status badge (same as list card)
- If targeted: match score pill + match reason text ("You matched because: {match_reason}")

**Campaign details section:**

- Section label: "CAMPAIGN DETAILS"
- Full `creative_text` rendered as body text
- Channels row: pills showing delivery channels (in-app, email, WhatsApp) from `campaigns.channels` JSON

**Personalized brief section (if targeted):**

- Section label: "PERSONALIZED FOR YOU"
- On page load, call `POST /api/brand/member-brief` with the creator's sub + campaign ID
- Shows the AI-generated personalized brief text
- Loading state: shimmer placeholder while generating
- If generation fails: section hidden gracefully

**Action section:**
Depends on `brief_responses.status`:

| Status      | UI                                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sent`      | Two buttons: "Accept Brief" (lime primary) + "Decline" (ghost/muted). Accept triggers `POST /api/creator/brief-response {action: 'accept'}`                                 |
| `accepted`  | Info message: "Brief accepted — waiting for brand to mark campaign live"                                                                                                    |
| `live`      | Proof submission form: text input for Instagram post URL + "Submit Proof" button. Submit triggers `POST /api/creator/brief-response {action: 'complete', igPostUrl: '...'}` |
| `completed` | Success state: green checkmark + "₹{reward} earned" + link to the Instagram post                                                                                            |
| `declined`  | Muted state: "You declined this brief"                                                                                                                                      |

Not targeted (discover): "This brief wasn't sent to you. Brands will discover you as your signal grows." (No action buttons.)

**Page styling:** Same dark gradient, glass card sections. Generous spacing between sections (64-96px). Max content width ~720px centered.

### 5. API Endpoints

**Existing (no changes):**

- `GET /api/user/campaigns?sub=X` — returns targeted briefs with status
- `POST /api/creator/brief-response` — accept/decline/complete
- `POST /api/brand/member-brief` — AI personalized brief text

**New endpoints:**

#### `GET /api/user/campaigns/discover`

Returns active campaigns where the creator is NOT in `campaign_audience`.

```
Query: ?sub=<google_sub>
Response: { ok: true, campaigns: Array<{ id, brand_name, title, creative_text, reward_inr, channels, created_at }> }
```

Logic:

1. Get all `campaign_audience` campaign_ids for this user
2. Select from `campaigns` where `status = 'active'` AND `id NOT IN (targeted_ids)`
3. Limit 20, ordered by `created_at DESC`

#### `GET /api/user/campaigns/[id]`

Returns a single campaign with full details + creator-specific status.

```
Query: ?sub=<google_sub>
Response: {
  ok: true,
  campaign: { id, brand_name, title, creative_text, reward_inr, channels, created_at, status },
  briefResponse: { status, ig_post_url, accepted_at, completed_at, payout_inr } | null,
  match: { match_score, match_reason } | null
}
```

Logic:

1. Select campaign by ID
2. Left join `brief_responses` for this user
3. Left join `campaign_audience` for this user
4. Return combined data

### 6. Responsive Behavior

**Desktop (≥1024px):** Brief cards in auto-fit grid. Detail page centered at 720px max-width.

**Tablet (768-1023px):** Brief cards 2 columns. Detail page full width with padding.

**Mobile (<768px):** Brief cards single column. Detail page full width. Action buttons sticky at bottom.

## Scope

**New files:**

- `src/routes/(app)/briefs/+page.svelte` — list page
- `src/routes/(app)/briefs/[id]/+page.svelte` — detail page
- `src/routes/api/user/campaigns/discover/+server.ts` — discover endpoint
- `src/routes/api/user/campaigns/[id]/+server.ts` — single brief detail endpoint

**Modified files:**

- `src/lib/components/DesktopSidebar.svelte` — add Briefs nav item
- `src/lib/components/FloatingNav.svelte` — add Briefs tab
- `src/routes/(app)/home/+page.svelte` — replace requests card with compact brief summary

**No database changes** — all tables and columns already exist.
**No new dependencies** — uses existing phosphor-svelte icons and Supabase client.
