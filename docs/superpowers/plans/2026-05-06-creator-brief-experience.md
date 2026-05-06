# Creator Brief Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated brief browsing and response experience for creators — list page, detail page, nav integration, and home page summary.

**Architecture:** Two new Svelte routes under `(app)/briefs/` with server-side data loading. Two new API endpoints for discover and single-brief detail. Nav components updated. Home page brief card simplified.

**Tech Stack:** SvelteKit, Supabase (existing client), existing phosphor-svelte icons, existing glass/theme CSS from workstream 1.

---

### Task 1: API — Single Brief Detail Endpoint

**Files:**

- Create: `src/routes/api/user/campaigns/[id]/+server.ts`

- [ ] **Step 1: Create the endpoint file**

```typescript
// src/routes/api/user/campaigns/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ params, url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const campaignId = params.id;
  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) throw error(400, 'sub is required');

  const sb = getServiceSupabase();

  // Fetch campaign
  const { data: campaign, error: cErr } = await sb
    .from('campaigns')
    .select('id, brand_name, title, creative_text, reward_inr, channels, status, created_at')
    .eq('id', campaignId)
    .single();

  if (cErr || !campaign) {
    return json({ ok: false, error: 'campaign_not_found' }, { status: 404 });
  }

  // Fetch brief response for this creator
  const { data: briefRows } = await sb
    .from('brief_responses')
    .select('status, ig_post_url, accepted_at, completed_at, payout_inr')
    .eq('campaign_id', campaignId)
    .eq('user_google_sub', sub)
    .limit(1);

  const briefResponse = briefRows?.[0] ?? null;

  // Fetch match info
  const { data: matchRows } = await sb
    .from('campaign_audience')
    .select('match_score, match_reason')
    .eq('campaign_id', campaignId)
    .eq('user_google_sub', sub)
    .limit(1);

  const match = matchRows?.[0] ?? null;

  return json({ ok: true, campaign, briefResponse, match });
};
```

- [ ] **Step 2: Verify it builds**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✔ done`

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/user/campaigns/\[id\]/+server.ts
git commit -m "feat: add single brief detail API endpoint"
```

---

### Task 2: API — Discover Briefs Endpoint

**Files:**

- Create: `src/routes/api/user/campaigns/discover/+server.ts`

- [ ] **Step 1: Create the endpoint file**

```typescript
// src/routes/api/user/campaigns/discover/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) throw error(400, 'sub is required');

  const sb = getServiceSupabase();

  // Get campaign IDs this creator is already targeted for
  const { data: targeted } = await sb
    .from('campaign_audience')
    .select('campaign_id')
    .eq('user_google_sub', sub);

  const targetedIds = (targeted ?? []).map((r) => r.campaign_id);

  // Get active campaigns NOT in targeted list
  let query = sb
    .from('campaigns')
    .select('id, brand_name, title, creative_text, reward_inr, channels, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20);

  if (targetedIds.length > 0) {
    query = query.not('id', 'in', `(${targetedIds.join(',')})`);
  }

  const { data: campaigns, error: qErr } = await query;

  if (qErr) {
    return json({ ok: false, error: 'query_failed' }, { status: 500 });
  }

  return json({ ok: true, campaigns: campaigns ?? [] });
};
```

- [ ] **Step 2: Verify it builds**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✔ done`

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/user/campaigns/discover/+server.ts
git commit -m "feat: add discover briefs API endpoint"
```

---

### Task 3: Navigation — Add Briefs to Sidebar and Mobile Nav

**Files:**

- Modify: `src/lib/components/DesktopSidebar.svelte`
- Modify: `src/lib/components/FloatingNav.svelte`

- [ ] **Step 1: Add Briefs link to DesktopSidebar**

Add `Briefcase` import at the top (it's already imported — check first). Add a reactive `briefsActive` variable. Add the link between Home and Earn:

In the `<script>` block, add after the `homeActive` reactive:

```typescript
$: briefsActive = path === '/briefs' || path.startsWith('/briefs/');
```

In the `<nav>` block, add after the Home link:

```svelte
<a href="/briefs" class="sidebar-link" class:sidebar-link--active={briefsActive} title="Briefs">
  <Briefcase size={18} weight={briefsActive ? 'fill' : 'regular'} />
  <span class="sidebar-label">Briefs</span>
</a>
```

Check if `Briefcase` is already imported. If not, add:

```typescript
import Briefcase from 'phosphor-svelte/lib/Briefcase';
```

- [ ] **Step 2: Add Briefs tab to FloatingNav**

Add the same reactive variable and the tab between Home and Earn:

In the `<script>` block:

```typescript
$: briefsActive = path === '/briefs' || path.startsWith('/briefs/');
```

Add import if needed:

```typescript
import Briefcase from 'phosphor-svelte/lib/Briefcase';
```

In the `<nav>` bottom tabs, add after Home tab:

```svelte
<a
  href="/briefs"
  class="bottom-tab"
  class:bottom-tab--active={briefsActive}
  aria-label="Briefs"
  aria-current={briefsActive ? 'page' : undefined}
>
  <Briefcase size={22} weight={briefsActive ? 'fill' : 'regular'} />
  <span class="bottom-tab__label">Briefs</span>
</a>
```

- [ ] **Step 3: Verify it builds**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✔ done`

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/DesktopSidebar.svelte src/lib/components/FloatingNav.svelte
git commit -m "feat: add Briefs to sidebar and mobile nav"
```

---

### Task 4: Briefs List Page

**Files:**

- Create: `src/routes/(app)/briefs/+page.svelte`

- [ ] **Step 1: Create the briefs list page**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { profile } from '$lib/stores/profile';
  import { goto } from '$app/navigation';
  import Briefcase from 'phosphor-svelte/lib/Briefcase';
  import Lightning from 'phosphor-svelte/lib/Lightning';

  type Brief = {
    campaign_id: string;
    brand_name: string;
    title: string;
    creative_text: string;
    reward_inr: number;
    match_score: number | null;
    match_reason: string | null;
    brief_status: string;
    created_at: string;
  };

  type DiscoverBrief = {
    id: string;
    brand_name: string;
    title: string;
    creative_text: string;
    reward_inr: number;
    created_at: string;
  };

  let targeted: Brief[] = [];
  let discover: DiscoverBrief[] = [];
  let loading = true;
  let filter: 'all' | 'sent' | 'accepted' | 'completed' = 'all';

  $: filtered = filter === 'all' ? targeted : targeted.filter((b) => b.brief_status === filter);

  function formatInr(n: number) {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
  }

  onMount(async () => {
    const sub = $profile.googleSub;
    if (!sub) {
      loading = false;
      return;
    }

    const [tRes, dRes] = await Promise.all([
      fetch(`/api/user/campaigns?sub=${encodeURIComponent(sub)}`)
        .then((r) => r.json())
        .catch(() => ({ ok: false })),
      fetch(`/api/user/campaigns/discover?sub=${encodeURIComponent(sub)}`)
        .then((r) => r.json())
        .catch(() => ({ ok: false })),
    ]);

    if (tRes.ok && tRes.briefs) {
      targeted = tRes.briefs;
    }
    if (dRes.ok && dRes.campaigns) {
      discover = dRes.campaigns;
    }
    loading = false;
  });
</script>

<svelte:head>
  <title>Briefs | Wagwan</title>
</svelte:head>

<div class="briefs-page">
  <header class="briefs-header">
    <h1 class="briefs-title">Briefs</h1>
    <div class="briefs-tabs" role="tablist">
      {#each [['all', 'All'], ['sent', 'Pending'], ['accepted', 'Accepted'], ['completed', 'Completed']] as [key, label]}
        <button
          type="button"
          role="tab"
          class="briefs-tab"
          class:active={filter === key}
          on:click={() => (filter = key)}>{label}</button
        >
      {/each}
    </div>
  </header>

  {#if loading}
    <div class="briefs-loading">Loading briefs...</div>
  {:else}
    <!-- Targeted briefs -->
    <section class="briefs-section">
      <span class="briefs-section-label">Your briefs</span>
      {#if filtered.length === 0}
        <div class="briefs-empty">
          <Briefcase size={32} weight="light" />
          <p>No briefs yet — brands are discovering your signal portrait.</p>
        </div>
      {:else}
        <div class="briefs-grid">
          {#each filtered as brief}
            <a href="/briefs/{brief.campaign_id}" class="brief-card">
              <div class="brief-card-top">
                <div class="brief-brand-circle">{(brief.brand_name || '?').charAt(0)}</div>
                <div class="brief-card-meta">
                  <span class="brief-brand-name">{brief.brand_name}</span>
                  <span class="brief-status brief-status--{brief.brief_status}"
                    >{brief.brief_status}</span
                  >
                </div>
                <span class="brief-reward">{formatInr(brief.reward_inr)}</span>
              </div>
              <h3 class="brief-title">{brief.title}</h3>
              <p class="brief-snippet">
                {(brief.creative_text || '').slice(0, 100)}{brief.creative_text?.length > 100
                  ? '...'
                  : ''}
              </p>
              {#if brief.match_score}
                <span class="brief-match">{brief.match_score}% fit</span>
              {/if}
            </a>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Discover -->
    {#if discover.length > 0}
      <section class="briefs-section">
        <span class="briefs-section-label">Discover</span>
        <div class="briefs-grid">
          {#each discover as brief}
            <a href="/briefs/{brief.id}" class="brief-card brief-card--discover">
              <div class="brief-card-top">
                <div class="brief-brand-circle">{(brief.brand_name || '?').charAt(0)}</div>
                <div class="brief-card-meta">
                  <span class="brief-brand-name">{brief.brand_name}</span>
                </div>
                <span class="brief-reward">{formatInr(brief.reward_inr)}</span>
              </div>
              <h3 class="brief-title">{brief.title}</h3>
              <p class="brief-snippet">
                {(brief.creative_text || '').slice(0, 100)}{brief.creative_text?.length > 100
                  ? '...'
                  : ''}
              </p>
              <span class="brief-explore">Explore →</span>
            </a>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .briefs-page {
    padding: clamp(20px, 3vw, 40px);
    max-width: 1100px;
    margin: 0 auto;
    font-family:
      'Geist Variable',
      'Inter',
      -apple-system,
      sans-serif;
    color: #ededef;
  }

  .briefs-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 32px;
    flex-wrap: wrap;
  }

  .briefs-title {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: clamp(1.8rem, 3vw, 2.4rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    margin: 0;
  }

  .briefs-tabs {
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 100px;
    padding: 3px;
  }

  .briefs-tab {
    padding: 5px 14px;
    border: none;
    border-radius: 100px;
    background: transparent;
    color: rgba(255, 248, 232, 0.5);
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .briefs-tab.active {
    background: rgba(196, 242, 74, 0.12);
    color: #c4f24a;
  }

  .briefs-section {
    margin-bottom: 48px;
  }

  .briefs-section-label {
    display: block;
    margin-bottom: 16px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: #9cec7b;
    text-transform: uppercase;
  }

  .briefs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
  }

  .brief-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.04);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(12px);
    text-decoration: none;
    color: inherit;
    transition:
      border-color 200ms ease,
      transform 200ms ease;
  }

  .brief-card:hover {
    border-color: rgba(196, 242, 74, 0.25);
    transform: translateY(-2px);
  }

  .brief-card--discover {
    border-color: rgba(255, 255, 255, 0.05);
    opacity: 0.85;
  }

  .brief-card--discover:hover {
    opacity: 1;
    border-color: rgba(196, 242, 74, 0.15);
  }

  .brief-card-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brief-brand-circle {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(196, 242, 74, 0.12);
    color: #c4f24a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 14px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .brief-card-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .brief-brand-name {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .brief-status {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 248, 232, 0.4);
  }

  .brief-status--accepted {
    color: #c4f24a;
  }
  .brief-status--live {
    color: #ff4d97;
  }
  .brief-status--completed {
    color: #4ade80;
  }

  .brief-reward {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: 1.3rem;
    font-weight: 700;
    color: #c4f24a;
    flex-shrink: 0;
  }

  .brief-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.3;
  }

  .brief-snippet {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255, 248, 232, 0.5);
  }

  .brief-match {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 100px;
    background: rgba(196, 242, 74, 0.1);
    color: #c4f24a;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    align-self: flex-start;
  }

  .brief-explore {
    font-size: 12px;
    font-weight: 600;
    color: #c4f24a;
    align-self: flex-start;
  }

  .briefs-empty {
    text-align: center;
    padding: 48px 20px;
    color: rgba(255, 248, 232, 0.4);
  }

  .briefs-empty p {
    margin: 12px 0 0;
    font-size: 14px;
    line-height: 1.5;
  }

  .briefs-loading {
    text-align: center;
    padding: 48px;
    color: rgba(255, 248, 232, 0.4);
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 12px;
  }

  @media (max-width: 640px) {
    .briefs-grid {
      grid-template-columns: 1fr;
    }

    .briefs-header {
      flex-direction: column;
      gap: 12px;
    }
  }
</style>
```

- [ ] **Step 2: Verify it builds**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✔ done`

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(app)/briefs/+page.svelte"
git commit -m "feat: add briefs list page with targeted + discover sections"
```

---

### Task 5: Brief Detail Page

**Files:**

- Create: `src/routes/(app)/briefs/[id]/+page.svelte`

- [ ] **Step 1: Create the brief detail page**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { profile } from '$lib/stores/profile';
  import { goto } from '$app/navigation';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
  import InstagramLogo from 'phosphor-svelte/lib/InstagramLogo';

  let campaign: any = null;
  let briefResponse: any = null;
  let match: any = null;
  let personalizedText = '';
  let personalizing = false;
  let loading = true;
  let acting = false;
  let igPostUrl = '';

  function formatInr(n: number) {
    if (!n) return '₹0';
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
  }

  async function loadBrief() {
    const sub = $profile.googleSub;
    const id = $page.params.id;
    if (!sub || !id) {
      loading = false;
      return;
    }

    const res = await fetch(`/api/user/campaigns/${id}?sub=${encodeURIComponent(sub)}`)
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
    if (res.ok) {
      campaign = res.campaign;
      briefResponse = res.briefResponse;
      match = res.match;
    }
    loading = false;

    // Generate personalized brief if targeted
    if (match && campaign) {
      personalizing = true;
      const pRes = await fetch('/api/brand/member-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub, campaignId: campaign.id, brandName: campaign.brand_name }),
      })
        .then((r) => r.json())
        .catch(() => ({ ok: false }));
      if (pRes.ok && pRes.brief) personalizedText = pRes.brief;
      personalizing = false;
    }
  }

  async function respond(action: 'accept' | 'decline') {
    acting = true;
    const res = await fetch('/api/creator/brief-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub: $profile.googleSub, campaignId: campaign.id, action }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
    if (res.ok) {
      briefResponse = { ...briefResponse, status: action === 'accept' ? 'accepted' : 'declined' };
    }
    acting = false;
  }

  async function submitProof() {
    if (!igPostUrl.trim()) return;
    acting = true;
    const res = await fetch('/api/creator/brief-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sub: $profile.googleSub,
        campaignId: campaign.id,
        action: 'complete',
        igPostUrl: igPostUrl.trim(),
      }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
    if (res.ok) {
      briefResponse = { ...briefResponse, status: 'completed', ig_post_url: igPostUrl.trim() };
    }
    acting = false;
  }

  onMount(loadBrief);
</script>

<svelte:head>
  <title>{campaign?.title || 'Brief'} | Wagwan</title>
</svelte:head>

<div class="brief-detail">
  <a href="/briefs" class="brief-back"><ArrowLeft size={16} /> All briefs</a>

  {#if loading}
    <div class="brief-loading">Loading brief...</div>
  {:else if !campaign}
    <div class="brief-loading">Brief not found.</div>
  {:else}
    <!-- Top section -->
    <header class="brief-hero">
      <div class="brief-hero-brand">
        <div class="brief-brand-initial">{(campaign.brand_name || '?').charAt(0)}</div>
        <span class="brief-hero-brand-name">{campaign.brand_name}</span>
        {#if briefResponse?.status}
          <span class="brief-detail-status brief-detail-status--{briefResponse.status}"
            >{briefResponse.status}</span
          >
        {/if}
      </div>
      <h1 class="brief-hero-title">{campaign.title}</h1>
      <div class="brief-hero-reward">{formatInr(campaign.reward_inr)}</div>
      {#if match}
        <div class="brief-hero-match">
          {#if match.match_score}<span class="brief-match-pill">{match.match_score}% fit</span>{/if}
          {#if match.match_reason}<p class="brief-match-reason">{match.match_reason}</p>{/if}
        </div>
      {/if}
    </header>

    <!-- Campaign details -->
    <section class="brief-section">
      <span class="brief-section-label">CAMPAIGN DETAILS</span>
      <p class="brief-body">{campaign.creative_text}</p>
      {#if campaign.channels}
        <div class="brief-channels">
          {#if campaign.channels.in_app}<span class="brief-channel-pill">In-app</span>{/if}
          {#if campaign.channels.email}<span class="brief-channel-pill">Email</span>{/if}
          {#if campaign.channels.whatsapp}<span class="brief-channel-pill">WhatsApp</span>{/if}
        </div>
      {/if}
    </section>

    <!-- Personalized brief -->
    {#if match}
      <section class="brief-section">
        <span class="brief-section-label">PERSONALIZED FOR YOU</span>
        {#if personalizing}
          <div class="brief-shimmer"></div>
        {:else if personalizedText}
          <p class="brief-body brief-body--personalized">{personalizedText}</p>
        {/if}
      </section>
    {/if}

    <!-- Actions -->
    <section class="brief-actions">
      {#if !briefResponse || !match}
        <p class="brief-discover-note">
          This brief wasn't sent to you. Brands will discover you as your signal grows.
        </p>
      {:else if briefResponse.status === 'sent'}
        <button
          class="brief-btn brief-btn--accept"
          on:click={() => respond('accept')}
          disabled={acting}
        >
          {acting ? 'Processing...' : 'Accept Brief'}
        </button>
        <button
          class="brief-btn brief-btn--decline"
          on:click={() => respond('decline')}
          disabled={acting}
        >
          Decline
        </button>
      {:else if briefResponse.status === 'accepted'}
        <div class="brief-info-msg">Brief accepted — waiting for brand to mark campaign live.</div>
      {:else if briefResponse.status === 'live'}
        <div class="brief-proof-form">
          <label class="brief-proof-label">Submit your Instagram post as proof</label>
          <div class="brief-proof-row">
            <input
              type="url"
              class="brief-proof-input"
              placeholder="https://instagram.com/p/..."
              bind:value={igPostUrl}
            />
            <button
              class="brief-btn brief-btn--accept"
              on:click={submitProof}
              disabled={acting || !igPostUrl.trim()}
            >
              <InstagramLogo size={16} weight="bold" /> Submit Proof
            </button>
          </div>
        </div>
      {:else if briefResponse.status === 'completed'}
        <div class="brief-completed">
          <CheckCircle size={28} weight="fill" color="#4ade80" />
          <span class="brief-completed-text">{formatInr(campaign.reward_inr)} earned</span>
          {#if briefResponse.ig_post_url}
            <a
              href={briefResponse.ig_post_url}
              target="_blank"
              rel="noopener"
              class="brief-proof-link">View post →</a
            >
          {/if}
        </div>
      {:else if briefResponse.status === 'declined'}
        <div class="brief-info-msg brief-info-msg--muted">You declined this brief.</div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .brief-detail {
    padding: clamp(20px, 3vw, 40px);
    max-width: 720px;
    margin: 0 auto;
    font-family:
      'Geist Variable',
      'Inter',
      -apple-system,
      sans-serif;
    color: #ededef;
  }

  .brief-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: rgba(255, 248, 232, 0.5);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    margin-bottom: 32px;
    transition: color 200ms ease;
  }
  .brief-back:hover {
    color: #c4f24a;
  }

  .brief-loading {
    text-align: center;
    padding: 64px;
    color: rgba(255, 248, 232, 0.4);
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 12px;
  }

  /* Hero */
  .brief-hero {
    margin-bottom: 48px;
  }

  .brief-hero-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .brief-brand-initial {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(196, 242, 74, 0.12);
    color: #c4f24a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 18px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .brief-hero-brand-name {
    font-size: 15px;
    font-weight: 600;
  }

  .brief-detail-status {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 248, 232, 0.5);
  }
  .brief-detail-status--accepted {
    background: rgba(196, 242, 74, 0.12);
    color: #c4f24a;
  }
  .brief-detail-status--live {
    background: rgba(255, 77, 151, 0.12);
    color: #ff4d97;
  }
  .brief-detail-status--completed {
    background: rgba(74, 222, 128, 0.12);
    color: #4ade80;
  }

  .brief-hero-title {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: clamp(1.6rem, 3.2vw, 2.4rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
    margin: 0 0 12px;
  }

  .brief-hero-reward {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 700;
    color: #c4f24a;
    letter-spacing: -0.03em;
    margin-bottom: 16px;
  }

  .brief-hero-match {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .brief-match-pill {
    padding: 3px 10px;
    border-radius: 100px;
    background: rgba(196, 242, 74, 0.1);
    color: #c4f24a;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 11px;
    font-weight: 700;
  }

  .brief-match-reason {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 248, 232, 0.6);
    line-height: 1.5;
  }

  /* Sections */
  .brief-section {
    margin-bottom: 48px;
    padding-bottom: 48px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .brief-section-label {
    display: block;
    margin-bottom: 12px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: #9cec7b;
    text-transform: uppercase;
  }

  .brief-body {
    font-size: 15px;
    line-height: 1.7;
    color: rgba(255, 248, 232, 0.7);
    margin: 0;
    max-width: 65ch;
  }

  .brief-body--personalized {
    padding: 16px;
    border-radius: 16px;
    background: rgba(196, 242, 74, 0.04);
    border: 1px solid rgba(196, 242, 74, 0.1);
  }

  .brief-channels {
    display: flex;
    gap: 6px;
    margin-top: 16px;
  }
  .brief-channel-pill {
    padding: 3px 10px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 248, 232, 0.55);
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
  }

  .brief-shimmer {
    height: 80px;
    border-radius: 12px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.03) 25%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.03) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Actions */
  .brief-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }

  .brief-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 28px;
    border: none;
    border-radius: 14px;
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition:
      transform 200ms ease,
      box-shadow 200ms ease;
  }

  .brief-btn:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  .brief-btn--accept {
    background: #c4f24a;
    color: #0a0a0a;
  }
  .brief-btn--accept:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(196, 242, 74, 0.3);
  }

  .brief-btn--decline {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 248, 232, 0.6);
  }
  .brief-btn--decline:hover:not(:disabled) {
    border-color: rgba(255, 77, 151, 0.3);
    color: #ff4d97;
  }

  .brief-info-msg {
    font-size: 14px;
    color: rgba(255, 248, 232, 0.55);
    padding: 16px 20px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    width: 100%;
  }
  .brief-info-msg--muted {
    opacity: 0.6;
  }

  .brief-discover-note {
    font-size: 14px;
    color: rgba(255, 248, 232, 0.45);
    margin: 0;
  }

  .brief-proof-form {
    width: 100%;
  }
  .brief-proof-label {
    display: block;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 248, 232, 0.7);
  }
  .brief-proof-row {
    display: flex;
    gap: 10px;
  }
  .brief-proof-input {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    color: #ededef;
    font-size: 14px;
    font-family: inherit;
    outline: none;
  }
  .brief-proof-input:focus {
    border-color: rgba(196, 242, 74, 0.3);
  }

  .brief-completed {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px;
    border-radius: 16px;
    background: rgba(74, 222, 128, 0.06);
    border: 1px solid rgba(74, 222, 128, 0.12);
    width: 100%;
  }
  .brief-completed-text {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: 1.3rem;
    font-weight: 700;
    color: #4ade80;
  }
  .brief-proof-link {
    margin-left: auto;
    color: #c4f24a;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }

  @media (max-width: 640px) {
    .brief-actions {
      position: sticky;
      bottom: 0;
      padding: 16px 0;
      background: linear-gradient(to top, rgba(3, 3, 6, 0.95), transparent);
    }
    .brief-proof-row {
      flex-direction: column;
    }
  }
</style>
```

- [ ] **Step 2: Verify it builds**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✔ done`

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(app)/briefs/[id]/+page.svelte"
git commit -m "feat: add brief detail page with accept/decline/proof flow"
```

---

### Task 6: Update Home Page — Compact Brief Summary Card

**Files:**

- Modify: `src/routes/(app)/home/+page.svelte`

- [ ] **Step 1: Find and replace the `os-card--requests` section**

The Brand Requests card HTML (look for `<!-- ── Brand Requests (hero) ── -->`) should be replaced with a compact summary that links to `/briefs`.

Replace the full requests card section with:

```svelte
<!-- ── Your Briefs (summary) ── -->
<section class="os-card os-card--requests">
  <div class="os-card-head">
    <span class="os-card-label">YOUR BRIEFS</span>
    <a href="/briefs" class="os-card-link">View all →</a>
  </div>
  {#if dashCampaigns.length === 0}
    <div class="os-card-empty">No briefs yet — brands are discovering your signal.</div>
  {:else}
    <div class="os-brief-summary">
      <span class="os-brief-count"
        >{dashCampaigns.filter((c) => c.brief_status === 'sent').length} pending</span
      >
      <span class="os-brief-sep">·</span>
      <span class="os-brief-count"
        >{dashCampaigns.filter((c) => c.brief_status === 'accepted' || c.brief_status === 'live')
          .length} active</span
      >
    </div>
    <div class="os-brief-preview-list">
      {#each dashCampaigns.slice(0, 2) as c}
        <a href="/briefs/{c.campaign_id}" class="os-brief-preview">
          <div class="os-brief-preview-brand">{(c.brand_name || '?').charAt(0)}</div>
          <div class="os-brief-preview-info">
            <span class="os-brief-preview-title">{c.title}</span>
            <span class="os-brief-preview-meta">{c.brand_name}</span>
          </div>
          <span class="os-brief-preview-reward">₹{c.reward_inr?.toLocaleString('en-IN') ?? 0}</span>
        </a>
      {/each}
    </div>
  {/if}
</section>
```

- [ ] **Step 2: Add the CSS for `.os-card-link` and `.os-brief-*` classes**

Add near the existing card styles:

```css
.os-card-link {
  margin-left: auto;
  color: #c4f24a;
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  font-family: 'Geist Mono Variable', 'SF Mono', monospace;
  letter-spacing: 0.04em;
}
.os-card-link:hover {
  text-decoration: underline;
}

.os-brief-summary {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  font-family: 'Geist Mono Variable', 'SF Mono', monospace;
  font-size: 12px;
  color: rgba(255, 248, 232, 0.55);
}
.os-brief-sep {
  color: rgba(255, 248, 232, 0.2);
}

.os-brief-preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.os-brief-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  text-decoration: none;
  color: inherit;
  transition: border-color 200ms ease;
}
.os-brief-preview:hover {
  border-color: rgba(196, 242, 74, 0.2);
}
.os-brief-preview-brand {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(196, 242, 74, 0.1);
  color: #c4f24a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Geist Mono Variable', 'SF Mono', monospace;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}
.os-brief-preview-info {
  flex: 1;
  min-width: 0;
}
.os-brief-preview-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.os-brief-preview-meta {
  font-size: 11px;
  color: rgba(255, 248, 232, 0.4);
}
.os-brief-preview-reward {
  font-family: 'Bodoni Moda', Georgia, serif;
  font-size: 16px;
  font-weight: 700;
  color: #c4f24a;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Verify it builds**

Run: `npx vite build 2>&1 | tail -3`
Expected: `✔ done`

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/home/+page.svelte"
git commit -m "feat: replace brand requests card with compact brief summary"
```

---

### Task 7: Build, Verify, Deploy

- [ ] **Step 1: Full build check**

Run: `npx vite build 2>&1 | tail -5`
Expected: `✔ done`

- [ ] **Step 2: Deploy to production**

Run: `vercel --prod 2>&1 | grep -E "(READY|ERROR|wagwanworld)"`
Expected: `READY` + `wagwanworld.vercel.app`

- [ ] **Step 3: Verify all routes**

```bash
curl -s -o /dev/null -w "%{http_code}" https://wagwanworld.vercel.app/briefs
curl -s -o /dev/null -w "%{http_code}" https://wagwanworld.vercel.app/home
```

Expected: `200` for both

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "feat: creator brief experience — list, detail, nav, home summary"
```
