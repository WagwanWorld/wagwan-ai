# Creator Brand Signals — Roster Visibility for Creators

**Date:** 2026-05-19
**Scope:** Phase 1 (close the loop) + Phase 2 (creator visibility)

## Problem

When a brand adds a creator to their roster, the flow is one-way. The brand sees the creator in their dashboard, but the creator has zero visibility into which brands are interested in them. On-platform creators never know they've been added. Prospects who complete onboarding via an invite link don't get linked back to the roster entry.

## Decision: Separate signals table

Rather than reverse-reading `brand_creator_roster`, we create a dedicated `creator_brand_signals` table. This cleanly separates brand-owned data (roster) from creator-owned data (signals), and is extensible for future signal types (brief invites, campaign matches).

Full transparency: creators see brand name, handle, profile pic, invite message, and fit analysis immediately when a brand adds them — no gating on delivery status.

---

## 1. Database: `creator_brand_signals`

```sql
CREATE TABLE creator_brand_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_google_sub TEXT NOT NULL,
  signal_type TEXT NOT NULL DEFAULT 'roster_add'
    CHECK (signal_type IN ('roster_add', 'brief_invite', 'campaign_match')),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  roster_entry_id UUID REFERENCES brand_creator_roster(id) ON DELETE SET NULL,
  brand_name TEXT NOT NULL,
  brand_handle TEXT,
  brand_profile_picture TEXT,
  invite_message TEXT,
  fit_label TEXT,
  fit_score INTEGER,
  analysis_snapshot JSONB DEFAULT '{}',
  seen BOOLEAN DEFAULT FALSE,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (creator_google_sub, brand_id, signal_type)
);

CREATE INDEX idx_creator_brand_signals_sub ON creator_brand_signals (creator_google_sub);
CREATE INDEX idx_creator_brand_signals_unseen ON creator_brand_signals (creator_google_sub) WHERE seen = FALSE;
```

### RLS policies — `creator_brand_signals`

- Creators: SELECT where `creator_google_sub` matches their session sub
- Creators: UPDATE `seen`/`seen_at` on their own rows only
- Service role: full access (app code inserts)

### RLS policies — `brand_creator_roster` (new)

- Brands: SELECT/INSERT/UPDATE/DELETE where `brand_id` matches their brand
- Service role: full access (for linkback endpoint)

---

## 2. Signal creation — app-code triggers

### Trigger 1: Brand adds on-platform creator

In `processCreatorInvite()` and `processAddNetworkToRoster()` in `src/lib/server/marketplace/creatorInvite.ts`:

After the upsert to `brand_creator_roster` succeeds and `user_google_sub` is non-null:

1. Look up brand context from `brand_accounts` (name, handle, profile pic)
2. Upsert into `creator_brand_signals` with:
   - `creator_google_sub` = the creator's sub
   - `signal_type` = `'roster_add'`
   - `brand_id`, `brand_name`, `brand_handle`, `brand_profile_picture` from brand account
   - `roster_entry_id` = the roster row id
   - `invite_message` = the generated message
   - `fit_label`, `fit_score` from analysis snapshot
   - `analysis_snapshot` = full analysis
3. On conflict (same creator + brand + type), update invite_message, fit data, and analysis

### Trigger 2: Prospect completes onboarding via invite link

After onboarding completes and `google_sub` is established:

1. Client checks localStorage for `wagwan_invite_brand` and `wagwan_invite_id`
2. If present, fires `POST /api/creator/link-invite` with `{ brandId, rosterId }`
3. Server:
   - Updates `brand_creator_roster` row: `status = 'on_platform'`, `user_google_sub = currentUser.sub`
   - Looks up brand context
   - Inserts `creator_brand_signals` row
   - Returns `{ ok: true }`
4. Client clears localStorage keys on success
5. If roster entry was deleted by brand, still creates signal from brand info lookup

---

## 3. Creator-side API endpoints

### `GET /api/creator/brand-signals`

- **Auth:** logged-in creator (google_sub from session)
- **Query params:** `?seen=false` (optional), `?signal_type=roster_add` (optional)
- **Response:** `{ ok: true, signals: SignalRow[], unseenCount: number }`
- **Order:** `created_at DESC`, limit 50

Each signal contains: id, brand_name, brand_handle, brand_profile_picture, invite_message, fit_label, fit_score, signal_type, seen, created_at.

### `PATCH /api/creator/brand-signals`

- **Auth:** logged-in creator
- **Body:** `{ id: string }` or `{ markAllSeen: true }`
- **Action:** sets `seen = true`, `seen_at = now()` on matching rows
- **Response:** `{ ok: true }`

### `POST /api/creator/link-invite`

- **Auth:** logged-in creator
- **Body:** `{ brandId: string, rosterId?: string }`
- **Action:**
  1. Update `brand_creator_roster` row (if exists): `status = 'on_platform'`, `user_google_sub`
  2. Insert `creator_brand_signals` row
- **Response:** `{ ok: true }`

---

## 4. Creator home page — "Brands interested in you"

**Location:** `src/routes/(app)/home/+page.svelte`, new section near the top. Only renders when the creator has >= 1 signal.

**Layout:**

- Section header: "Brands interested in you" + unseen count badge ("3 new")
- Horizontal scrollable row of brand cards
- Each card:
  - Brand profile pic (gradient avatar fallback)
  - Brand name + @handle
  - Fit label badge (green = Strong, blue = Good, amber = Worth exploring)
  - Truncated invite message (2 lines max)
  - "View brand" CTA → `/brand/[id]`
- Unseen cards get a subtle highlight dot
- Section hidden entirely if zero signals (no empty state)

**Behavior:**

- Fetches `GET /api/creator/brand-signals` on page load
- Marks signals as seen via intersection observer or "View brand" tap
- Badge count updates reactively

---

## 5. Onboarding linkback

**Current state:** onboarding saves `wagwan_invite_brand`, `wagwan_invite_id`, `wagwan_invite_from` to localStorage but never writes back.

**Change:** Inside the `finish()` function (line ~558 in `+page.svelte`) — the handler for "Start exploring" — check localStorage for `wagwan_invite_brand` and `wagwan_invite_id`. If present and `accountSub` (the google_sub) is available, fire `POST /api/creator/link-invite` before navigating to home. Clear localStorage on success. Fire-and-forget (don't block navigation on the response).

---

## Files touched

| File                                                     | Change                            |
| -------------------------------------------------------- | --------------------------------- |
| `supabase/migrations/2026XXXX_creator_brand_signals.sql` | New table, indexes, RLS policies  |
| `src/lib/server/marketplace/creatorInvite.ts`            | Insert signal after roster upsert |
| `src/routes/api/creator/brand-signals/+server.ts`        | New GET + PATCH endpoints         |
| `src/routes/api/creator/link-invite/+server.ts`          | New POST endpoint                 |
| `src/routes/onboarding/+page.svelte`                     | Linkback call after final step    |
| `src/routes/(app)/home/+page.svelte`                     | "Brands interested" section       |
| `src/lib/components/creators/BrandSignalCard.svelte`     | New component for signal cards    |

## Out of scope

- Creator accept/decline flow (Phase 3)
- Bulk invite (Phase 3)
- Push notifications / email alerts
- Real-time updates (websocket/polling)
