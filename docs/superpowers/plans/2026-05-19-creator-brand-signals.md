# Creator Brand Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give creators visibility into which brands have added them to their roster, and close the onboarding loop so prospects who sign up via invite links get linked back.

**Architecture:** New `creator_brand_signals` table stores creator-facing signal rows, inserted by app code whenever a brand adds an on-platform creator or a prospect completes onboarding via invite link. Creator-side API endpoints serve the data. A new section on the creator home page displays the signals.

**Tech Stack:** SvelteKit, Supabase (Postgres), TypeScript

---

## File Structure

| File                                                           | Responsibility                               |
| -------------------------------------------------------------- | -------------------------------------------- |
| `supabase/migrations/20260519000000_creator_brand_signals.sql` | Table, indexes, RLS policies                 |
| `src/lib/types/creator-signals.ts`                             | TypeScript types for signals                 |
| `src/lib/server/creatorSignals.ts`                             | Server-side signal insert/query functions    |
| `src/routes/api/creator/brand-signals/+server.ts`              | GET + PATCH endpoints                        |
| `src/routes/api/creator/link-invite/+server.ts`                | POST endpoint for onboarding linkback        |
| `src/lib/server/marketplace/creatorInvite.ts`                  | Modified — insert signal after roster upsert |
| `src/routes/onboarding/+page.svelte`                           | Modified — fire linkback on finish()         |
| `src/lib/components/creators/BrandSignalCard.svelte`           | Signal card component                        |
| `src/routes/(app)/home/+page.svelte`                           | Modified — "Brands interested" section       |

---

### Task 1: Database migration — `creator_brand_signals` table

**Files:**

- Create: `supabase/migrations/20260519000000_creator_brand_signals.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Creator brand signals: creator-facing notifications when brands add them
CREATE TABLE IF NOT EXISTS creator_brand_signals (
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

-- Fast lookups by creator
CREATE INDEX idx_creator_brand_signals_sub
  ON creator_brand_signals (creator_google_sub);

-- Unseen badge count
CREATE INDEX idx_creator_brand_signals_unseen
  ON creator_brand_signals (creator_google_sub) WHERE seen = FALSE;

-- RLS
ALTER TABLE creator_brand_signals ENABLE ROW LEVEL SECURITY;

-- Creators can read their own signals
CREATE POLICY creator_signals_select ON creator_brand_signals
  FOR SELECT USING (creator_google_sub = current_setting('request.jwt.claims', true)::json->>'sub');

-- Creators can mark their own signals as seen
CREATE POLICY creator_signals_update ON creator_brand_signals
  FOR UPDATE USING (creator_google_sub = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (creator_google_sub = current_setting('request.jwt.claims', true)::json->>'sub');

-- Service role can insert (app code)
CREATE POLICY creator_signals_insert ON creator_brand_signals
  FOR INSERT WITH CHECK (true);

-- Also add RLS policies to brand_creator_roster (currently has RLS enabled but no policies)
CREATE POLICY roster_brand_select ON brand_creator_roster
  FOR SELECT USING (true);

CREATE POLICY roster_brand_insert ON brand_creator_roster
  FOR INSERT WITH CHECK (true);

CREATE POLICY roster_brand_update ON brand_creator_roster
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY roster_brand_delete ON brand_creator_roster
  FOR DELETE USING (true);
```

- [ ] **Step 2: Run the migration**

Run: `npx supabase db push` or apply via Supabase dashboard SQL editor.
Expected: Table `creator_brand_signals` created with indexes and policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260519000000_creator_brand_signals.sql
git commit -m "feat: add creator_brand_signals table with RLS policies"
```

---

### Task 2: TypeScript types for creator signals

**Files:**

- Create: `src/lib/types/creator-signals.ts`

- [ ] **Step 1: Create the types file**

```typescript
export type SignalType = 'roster_add' | 'brief_invite' | 'campaign_match';

export type CreatorBrandSignal = {
  id: string;
  creator_google_sub: string;
  signal_type: SignalType;
  brand_id: string;
  roster_entry_id: string | null;
  brand_name: string;
  brand_handle: string | null;
  brand_profile_picture: string | null;
  invite_message: string | null;
  fit_label: string | null;
  fit_score: number | null;
  analysis_snapshot: Record<string, unknown>;
  seen: boolean;
  seen_at: string | null;
  created_at: string;
};

/** Payload returned to the client (strips creator_google_sub) */
export type CreatorBrandSignalView = Omit<CreatorBrandSignal, 'creator_google_sub'>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types/creator-signals.ts
git commit -m "feat: add CreatorBrandSignal types"
```

---

### Task 3: Server-side signal service — `creatorSignals.ts`

**Files:**

- Create: `src/lib/server/creatorSignals.ts`

- [ ] **Step 1: Create the service file**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatorBrandSignal, SignalType } from '$lib/types/creator-signals';

/**
 * Insert or update a creator brand signal.
 * On conflict (same creator + brand + signal_type), updates the message and fit data.
 */
export async function upsertCreatorBrandSignal(
  sb: SupabaseClient,
  signal: {
    creator_google_sub: string;
    signal_type: SignalType;
    brand_id: string;
    roster_entry_id?: string | null;
    brand_name: string;
    brand_handle?: string | null;
    brand_profile_picture?: string | null;
    invite_message?: string | null;
    fit_label?: string | null;
    fit_score?: number | null;
    analysis_snapshot?: Record<string, unknown>;
  },
): Promise<{ id: string } | null> {
  const { data, error } = await sb
    .from('creator_brand_signals')
    .upsert(
      {
        creator_google_sub: signal.creator_google_sub,
        signal_type: signal.signal_type,
        brand_id: signal.brand_id,
        roster_entry_id: signal.roster_entry_id ?? null,
        brand_name: signal.brand_name,
        brand_handle: signal.brand_handle ?? null,
        brand_profile_picture: signal.brand_profile_picture ?? null,
        invite_message: signal.invite_message ?? null,
        fit_label: signal.fit_label ?? null,
        fit_score: signal.fit_score ?? null,
        analysis_snapshot: signal.analysis_snapshot ?? {},
        seen: false,
        seen_at: null,
      },
      { onConflict: 'creator_google_sub,brand_id,signal_type' },
    )
    .select('id')
    .single();

  if (error) {
    console.error('[creatorSignals] upsert failed:', error.message);
    return null;
  }
  return { id: data.id as string };
}

/**
 * Fetch signals for a creator, optionally filtered.
 */
export async function listCreatorBrandSignals(
  sb: SupabaseClient,
  googleSub: string,
  opts?: { seen?: boolean; signalType?: SignalType; limit?: number },
): Promise<{ signals: CreatorBrandSignal[]; unseenCount: number }> {
  const limit = opts?.limit ?? 50;

  let query = sb
    .from('creator_brand_signals')
    .select('*')
    .eq('creator_google_sub', googleSub)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts?.seen !== undefined) {
    query = query.eq('seen', opts.seen);
  }
  if (opts?.signalType) {
    query = query.eq('signal_type', opts.signalType);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[creatorSignals] list failed:', error.message);
    return { signals: [], unseenCount: 0 };
  }

  const signals = (data ?? []) as CreatorBrandSignal[];

  // Count unseen (always unfiltered for badge)
  const { count } = await sb
    .from('creator_brand_signals')
    .select('id', { count: 'exact', head: true })
    .eq('creator_google_sub', googleSub)
    .eq('seen', false);

  return { signals, unseenCount: count ?? 0 };
}

/**
 * Mark one or all signals as seen.
 */
export async function markSignalsSeen(
  sb: SupabaseClient,
  googleSub: string,
  opts: { id?: string; markAllSeen?: boolean },
): Promise<boolean> {
  const now = new Date().toISOString();

  if (opts.markAllSeen) {
    const { error } = await sb
      .from('creator_brand_signals')
      .update({ seen: true, seen_at: now })
      .eq('creator_google_sub', googleSub)
      .eq('seen', false);
    return !error;
  }

  if (opts.id) {
    const { error } = await sb
      .from('creator_brand_signals')
      .update({ seen: true, seen_at: now })
      .eq('id', opts.id)
      .eq('creator_google_sub', googleSub);
    return !error;
  }

  return false;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/creatorSignals.ts
git commit -m "feat: add creatorSignals service (upsert, list, markSeen)"
```

---

### Task 4: API endpoint — `GET /api/creator/brand-signals` and `PATCH`

**Files:**

- Create: `src/routes/api/creator/brand-signals/+server.ts`

- [ ] **Step 1: Create the endpoint file**

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { listCreatorBrandSignals, markSignalsSeen } from '$lib/server/creatorSignals';
import type { SignalType } from '$lib/types/creator-signals';

export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const googleSub = url.searchParams.get('googleSub')?.trim();
  if (!googleSub) throw error(400, 'googleSub is required');

  const seenParam = url.searchParams.get('seen');
  const signalType = url.searchParams.get('signal_type') as SignalType | null;

  const seen = seenParam === 'true' ? true : seenParam === 'false' ? false : undefined;

  const sb = getServiceSupabase();
  const { signals, unseenCount } = await listCreatorBrandSignals(sb, googleSub, {
    seen,
    signalType: signalType ?? undefined,
  });

  // Strip creator_google_sub from response
  const views = signals.map(({ creator_google_sub: _sub, ...rest }) => rest);

  return json({ ok: true, signals: views, unseenCount });
};

export const PATCH: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (!googleSub) throw error(400, 'googleSub is required');

  const id = typeof body.id === 'string' ? body.id.trim() : undefined;
  const markAllSeen = body.markAllSeen === true;

  if (!id && !markAllSeen) {
    throw error(400, 'Provide id or markAllSeen');
  }

  const sb = getServiceSupabase();
  const ok = await markSignalsSeen(sb, googleSub, { id, markAllSeen });

  return json({ ok });
};
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/creator/brand-signals/+server.ts
git commit -m "feat: add GET/PATCH /api/creator/brand-signals endpoints"
```

---

### Task 5: API endpoint — `POST /api/creator/link-invite`

**Files:**

- Create: `src/routes/api/creator/link-invite/+server.ts`

- [ ] **Step 1: Create the endpoint file**

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const brandId = typeof body.brandId === 'string' ? body.brandId.trim() : '';
  const rosterId = typeof body.rosterId === 'string' ? body.rosterId.trim() : undefined;

  if (!googleSub) throw error(400, 'googleSub is required');
  if (!brandId) throw error(400, 'brandId is required');

  const sb = getServiceSupabase();

  // 1. Update roster entry if it exists: mark as on_platform, link google_sub
  if (rosterId) {
    await sb
      .from('brand_creator_roster')
      .update({
        status: 'on_platform',
        user_google_sub: googleSub,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rosterId)
      .eq('brand_id', brandId);
  }

  // 2. Look up brand context for the signal
  const { data: account } = await sb
    .from('brand_accounts')
    .select('ig_username, ig_name, ig_profile_picture')
    .eq('brand_id', brandId)
    .limit(1)
    .maybeSingle();

  const { data: brandRow } = await sb.from('brands').select('name').eq('id', brandId).maybeSingle();

  const brandName = account?.ig_name?.trim() || brandRow?.name || 'Brand';
  const brandHandle = account?.ig_username || null;
  const brandProfilePicture = account?.ig_profile_picture || null;

  // 3. Pull fit data from roster entry if available
  let fitLabel: string | null = null;
  let fitScore: number | null = null;
  let inviteMessage: string | null = null;
  let analysisSnapshot: Record<string, unknown> = {};

  if (rosterId) {
    const { data: rosterRow } = await sb
      .from('brand_creator_roster')
      .select('analysis_snapshot, invite_message')
      .eq('id', rosterId)
      .maybeSingle();

    if (rosterRow) {
      const analysis = rosterRow.analysis_snapshot as Record<string, unknown> | null;
      fitLabel = (analysis?.fitLabel as string) ?? null;
      fitScore = (analysis?.fitScore as number) ?? null;
      inviteMessage = (rosterRow.invite_message as string) ?? null;
      analysisSnapshot = analysis ?? {};
    }
  }

  // 4. Upsert the signal
  await upsertCreatorBrandSignal(sb, {
    creator_google_sub: googleSub,
    signal_type: 'roster_add',
    brand_id: brandId,
    roster_entry_id: rosterId ?? null,
    brand_name: brandName,
    brand_handle: brandHandle,
    brand_profile_picture: brandProfilePicture,
    invite_message: inviteMessage,
    fit_label: fitLabel,
    fit_score: fitScore,
    analysis_snapshot: analysisSnapshot,
  });

  return json({ ok: true });
};
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/creator/link-invite/+server.ts
git commit -m "feat: add POST /api/creator/link-invite for onboarding linkback"
```

---

### Task 6: Insert signal in `persistRosterInvite` after roster upsert

**Files:**

- Modify: `src/lib/server/marketplace/creatorInvite.ts` (inside `persistRosterInvite`, after upsert at ~L339)

- [ ] **Step 1: Add import at top of file**

Add after the existing imports (around line 8):

```typescript
import { upsertCreatorBrandSignal } from '$lib/server/creatorSignals';
```

- [ ] **Step 2: Insert signal creation after the roster upsert completes**

In `persistRosterInvite`, after the line `const { id: rosterId } = await upsertBrandCreatorRoster(sb, { ... });` (around line 339) and before `const links = buildInviteLinks(...)` (around line 341), add:

```typescript
// Insert creator-facing signal if creator is on-platform
if (wagwan?.google_sub) {
  void upsertCreatorBrandSignal(sb, {
    creator_google_sub: wagwan.google_sub,
    signal_type: 'roster_add',
    brand_id: brandId,
    roster_entry_id: rosterId,
    brand_name: brandName,
    brand_handle: brandUsername ?? null,
    brand_profile_picture: null,
    invite_message: messageWithLink,
    fit_label: finalAnalysis.fitLabel ?? null,
    fit_score: finalAnalysis.fitScore ?? null,
    analysis_snapshot: finalAnalysis as unknown as Record<string, unknown>,
  });
}
```

**Important:** This block must go AFTER `messageWithLink` is computed (after the second `.update()` call around line 351) but BEFORE the final `return`. The `void` prefix means it's fire-and-forget — don't block the roster response on signal creation.

So the exact insertion point is after line ~354 (`const { data: entry } = await sb.from('brand_creator_roster')...`) and before the `return {` block. Here's the surrounding context:

```typescript
  // EXISTING: final entry fetch
  const { data: entry } = await sb.from('brand_creator_roster').select('*').eq('id', rosterId).single();

  // NEW: Insert creator-facing signal (fire-and-forget)
  if (wagwan?.google_sub) {
    void upsertCreatorBrandSignal(sb, {
      creator_google_sub: wagwan.google_sub,
      signal_type: 'roster_add',
      brand_id: brandId,
      roster_entry_id: rosterId,
      brand_name: brandName,
      brand_handle: brandUsername ?? null,
      brand_profile_picture: null,
      invite_message: messageWithLink,
      fit_label: finalAnalysis.fitLabel ?? null,
      fit_score: finalAnalysis.fitScore ?? null,
      analysis_snapshot: finalAnalysis as unknown as Record<string, unknown>,
    });
  }

  // EXISTING: return
  return {
    entry: (entry ?? {}) as Record<string, unknown>,
```

Note: `brand_profile_picture` is null here because `persistRosterInvite` doesn't have that data in scope. The linkback endpoint and the home page fetch will have the full brand context. The signal still has brand_name and brand_handle which is sufficient.

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/marketplace/creatorInvite.ts
git commit -m "feat: emit creator_brand_signal when brand adds on-platform creator"
```

---

### Task 7: Onboarding linkback — fire POST on `finish()`

**Files:**

- Modify: `src/routes/onboarding/+page.svelte` (inside the `finish()` function at ~line 558)

- [ ] **Step 1: Add linkback logic inside `finish()`**

Inside the `finish()` function, after the existing validation checks pass (after the `if (!accountSub)` guard at ~line 572) and before any navigation, add:

```typescript
// Link invite back to roster + create creator signal
const invBrand = localStorage.getItem('wagwan_invite_brand');
const invRoster = localStorage.getItem('wagwan_invite_id');
if (invBrand && accountSub) {
  // Fire-and-forget — don't block onboarding completion
  fetch('/api/creator/link-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      googleSub: accountSub,
      brandId: invBrand,
      rosterId: invRoster || undefined,
    }),
  })
    .then(() => {
      localStorage.removeItem('wagwan_invite_brand');
      localStorage.removeItem('wagwan_invite_id');
      localStorage.removeItem('wagwan_invite_from');
    })
    .catch(() => {
      // Silent fail — creator still onboards fine
    });
}
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/onboarding/+page.svelte
git commit -m "feat: fire invite linkback on onboarding completion"
```

---

### Task 8: BrandSignalCard component

**Files:**

- Create: `src/lib/components/creators/BrandSignalCard.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import type { CreatorBrandSignalView } from '$lib/types/creator-signals';

  export let signal: CreatorBrandSignalView;
  export let onMarkSeen: ((id: string) => void) | undefined = undefined;

  $: initials = signal.brand_name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  $: fitColor =
    signal.fit_label === 'Strong fit'
      ? '#22c55e'
      : signal.fit_label === 'Good fit'
        ? '#3b82f6'
        : signal.fit_label === 'Worth exploring'
          ? '#f59e0b'
          : '#94a3b8';

  function handleViewBrand() {
    if (!signal.seen && onMarkSeen) onMarkSeen(signal.id);
  }

  // Deterministic gradient from brand name
  function avatarGradient(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
    const hue1 = Math.abs(h) % 360;
    const hue2 = (hue1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 70%, 55%), hsl(${hue2}, 60%, 45%))`;
  }
</script>

<a
  href="/brand/{signal.brand_id}"
  class="bsc-card"
  class:bsc-card--unseen={!signal.seen}
  on:click={handleViewBrand}
>
  {#if !signal.seen}
    <span class="bsc-dot" aria-label="New"></span>
  {/if}

  <div
    class="bsc-avatar"
    style:background={signal.brand_profile_picture ? 'none' : avatarGradient(signal.brand_name)}
  >
    {#if signal.brand_profile_picture}
      <img src={signal.brand_profile_picture} alt={signal.brand_name} class="bsc-avatar-img" />
    {:else}
      <span class="bsc-avatar-initials">{initials}</span>
    {/if}
  </div>

  <div class="bsc-name">{signal.brand_name}</div>
  {#if signal.brand_handle}
    <div class="bsc-handle">@{signal.brand_handle}</div>
  {/if}

  {#if signal.fit_label}
    <span class="bsc-fit" style:background="{fitColor}20" style:color={fitColor}>
      {signal.fit_label}
    </span>
  {/if}

  {#if signal.invite_message}
    <p class="bsc-msg">
      {signal.invite_message.slice(0, 120)}{signal.invite_message.length > 120 ? '…' : ''}
    </p>
  {/if}

  <span class="bsc-cta">View brand</span>
</a>

<style>
  .bsc-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 180px;
    max-width: 200px;
    padding: 20px 16px 16px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    text-decoration: none;
    color: inherit;
    transition:
      transform 0.15s ease,
      border-color 0.15s ease;
    flex-shrink: 0;
  }
  .bsc-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.18);
  }
  .bsc-card--unseen {
    border-color: rgba(99, 102, 241, 0.3);
    background: rgba(99, 102, 241, 0.05);
  }
  .bsc-dot {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6366f1;
  }
  .bsc-avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .bsc-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
  .bsc-avatar-initials {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.5px;
  }
  .bsc-name {
    font-size: 14px;
    font-weight: 600;
    text-align: center;
    line-height: 1.3;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bsc-handle {
    font-size: 12px;
    opacity: 0.5;
    margin-top: -4px;
  }
  .bsc-fit {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 8px;
    letter-spacing: 0.2px;
  }
  .bsc-msg {
    font-size: 12px;
    line-height: 1.4;
    opacity: 0.6;
    text-align: center;
    margin: 2px 0 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .bsc-cta {
    font-size: 12px;
    font-weight: 600;
    color: #6366f1;
    margin-top: 4px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/creators/BrandSignalCard.svelte
git commit -m "feat: add BrandSignalCard component for creator home"
```

---

### Task 9: "Brands interested in you" section on creator home page

**Files:**

- Modify: `src/routes/(app)/home/+page.svelte`

- [ ] **Step 1: Add imports and state variables**

In the `<script>` block, add the import near the other component imports:

```typescript
import BrandSignalCard from '$lib/components/creators/BrandSignalCard.svelte';
import type { CreatorBrandSignalView } from '$lib/types/creator-signals';
```

Add state variables near the other `let` declarations:

```typescript
let brandSignals: CreatorBrandSignalView[] = [];
let brandSignalsUnseenCount = 0;
let brandSignalsLoaded = false;
```

- [ ] **Step 2: Add fetch function**

Add a function in the script block:

```typescript
async function loadBrandSignals() {
  const sub = $profile.googleSub?.trim();
  if (!sub) return;
  try {
    const res = await fetch(`/api/creator/brand-signals?googleSub=${encodeURIComponent(sub)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok) {
      brandSignals = data.signals ?? [];
      brandSignalsUnseenCount = data.unseenCount ?? 0;
      brandSignalsLoaded = true;
    }
  } catch {
    // Silent fail
  }
}

function markSignalSeen(id: string) {
  const sub = $profile.googleSub?.trim();
  if (!sub) return;
  brandSignals = brandSignals.map((s) => (s.id === id ? { ...s, seen: true } : s));
  brandSignalsUnseenCount = Math.max(0, brandSignalsUnseenCount - 1);
  fetch('/api/creator/brand-signals', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ googleSub: sub, id }),
  }).catch(() => {});
}
```

- [ ] **Step 3: Call `loadBrandSignals()` on mount**

Find the existing `onMount` block (or the reactive block that runs on profile load). Add `loadBrandSignals()` alongside the other data-loading calls. For example, if there's an `onMount(() => { ... })`, add inside it:

```typescript
loadBrandSignals();
```

Or if data loading is triggered reactively on `$profile.googleSub`, add a reactive call:

```typescript
$: if ($profile.googleSub && !brandSignalsLoaded) loadBrandSignals();
```

- [ ] **Step 4: Add the template section**

In the template, right after the opening `<div class="os-root" ...>` line (~line 2186) and before the first existing content section, add:

```svelte
{#if brandSignals.length > 0}
  <section class="bsi-section">
    <div class="bsi-header">
      <h2 class="bsi-title">Brands interested in you</h2>
      {#if brandSignalsUnseenCount > 0}
        <span class="bsi-badge">{brandSignalsUnseenCount} new</span>
      {/if}
    </div>
    <div class="bsi-scroll">
      {#each brandSignals as signal (signal.id)}
        <BrandSignalCard {signal} onMarkSeen={markSignalSeen} />
      {/each}
    </div>
  </section>
{/if}
```

- [ ] **Step 5: Add styles**

Add to the `<style>` block at the bottom of the file:

```css
.bsi-section {
  padding: 24px 20px 8px;
}
.bsi-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.bsi-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
  margin: 0;
}
.bsi-badge {
  font-size: 11px;
  font-weight: 700;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.12);
  padding: 2px 8px;
  border-radius: 8px;
}
.bsi-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 12px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.bsi-scroll::-webkit-scrollbar {
  height: 4px;
}
.bsi-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
```

- [ ] **Step 6: Verify build**

Run: `npx vite build`
Expected: No TypeScript errors.

- [ ] **Step 7: Test in browser**

Run: `npm run dev`

1. Log in as a creator who has been added to at least one brand's roster
2. Navigate to home page
3. Verify "Brands interested in you" section appears with brand cards
4. Click "View brand" — verify it navigates to `/brand/[id]`
5. Reload — verify the signal is now marked as seen (no dot)
6. Log in as a creator with no signals — verify section is hidden

- [ ] **Step 8: Commit**

```bash
git add src/routes/(app)/home/+page.svelte
git commit -m "feat: add 'Brands interested in you' section to creator home"
```

---

### Task 10: End-to-end verification

- [ ] **Step 1: Test brand → on-platform creator flow**

1. Log in as a brand
2. Go to roster/invite panel
3. Enter the IG handle of a creator who is already on Wagwan
4. Verify the invite is created in the roster dashboard
5. Switch to the creator account
6. Navigate to home page
7. Verify the "Brands interested in you" section shows the brand card with name, fit label, and invite message

- [ ] **Step 2: Test prospect → onboarding linkback flow**

1. Log in as a brand
2. Add a new IG handle (not on Wagwan) to the roster
3. Copy the onboarding URL from the invite
4. Open the URL in an incognito window
5. Complete onboarding (connect Instagram, finish)
6. Navigate to home page
7. Verify the brand signal card appears

- [ ] **Step 3: Test mark-as-seen**

1. On creator home with unseen signals, verify the badge shows count
2. Click "View brand" on a card
3. Return to home — verify that signal no longer has the unseen dot
4. Verify badge count decreased

- [ ] **Step 4: Final build check**

Run: `npx vite build`
Expected: Clean build, no errors.

- [ ] **Step 5: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: address issues found during e2e testing"
```
