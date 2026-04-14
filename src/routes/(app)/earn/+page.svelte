<script lang="ts">
  import { onMount } from 'svelte';
  import { profile } from '$lib/stores/profile';
  import IdentityIntelligencePanel from '$lib/components/IdentityIntelligencePanel.svelte';
  import InferenceIdentityPanel from '$lib/components/InferenceIdentityPanel.svelte';
  import type { IdentityIntelligenceWrapper } from '$lib/types/identityIntelligence';
  import type { InferenceIdentityWrapper } from '$lib/types/inferenceIdentity';
  import Wallet from 'phosphor-svelte/lib/Wallet';
  import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';
  import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
  import Broadcast from 'phosphor-svelte/lib/Broadcast';
  import IntegrityScore from '$lib/components/earn/IntegrityScore.svelte';
  import RateCard from '$lib/components/earn/RateCard.svelte';
  import OfferCard from '$lib/components/earn/OfferCard.svelte';
  import VisibilityControls from '$lib/components/earn/VisibilityControls.svelte';
  import PortraitPreview from '$lib/components/earn/PortraitPreview.svelte';

  let loading = true;
  let err = '';
  let campaigns: Array<{
    campaign_id: string;
    brand_name: string;
    title: string;
    creative_text: string;
    reward_inr: number;
    match_reason: string;
    match_score: number;
    created_at: string;
  }> = [];

  let wallet: {
    summary: { total_inr: number; pending_inr: number; withdrawable_inr: number };
    transactions: Array<{
      id: string;
      amount_inr: number;
      status: string;
      note: string;
      created_at: string;
    }>;
  } | null = null;

  let prefs: {
    channels: { email?: boolean; in_app?: boolean; whatsapp?: boolean };
    categories: Record<string, boolean>;
    max_campaigns_per_week: number;
    manual_interest_tags: string[];
  } | null = null;

  let identityTags: string[] = [];
  let inferenceIdentity: InferenceIdentityWrapper | null = null;
  let identityIntelligence: IdentityIntelligenceWrapper | null = null;
  let intelligenceQuery = '';
  let intelligenceRunning = false;
  let intelligenceMsg = '';
  let manualTagInput = '';
  let withdrawMsg = '';

  let graphStrength: {
    score: number;
    label: string;
    source_count: number;
    freshness_bucket: string;
    tag_count: number;
  } | null = null;
  let refreshingGraph = false;
  let graphRefreshMsg = '';

  let creatorRates: {
    ig_post_rate_inr: number;
    ig_story_rate_inr: number;
    ig_reel_rate_inr: number;
    whatsapp_intro_rate_inr: number;
    available: boolean;
  } = { ig_post_rate_inr: 0, ig_story_rate_inr: 0, ig_reel_rate_inr: 0, whatsapp_intro_rate_inr: 0, available: false };

  let visibility = {
    music_visible: true,
    instagram_visible: true,
    career_visible: true,
    lifestyle_visible: true,
    calendar_visible: false,
    email_visible: false,
  };

  let showPortraitPreview = false;
  let whatsappLink = '';

  $: sub = $profile.googleSub;

  async function loadAll() {
    if (!sub) return;
    loading = true;
    err = '';
    try {
      const [cRes, wRes, pRes, tRes, gRes] = await Promise.all([
        fetch(`/api/user/campaigns?sub=${encodeURIComponent(sub)}`),
        fetch(`/api/user/wallet?sub=${encodeURIComponent(sub)}`),
        fetch(`/api/user/marketing-prefs?sub=${encodeURIComponent(sub)}`),
        fetch(`/api/user/identity-tags?sub=${encodeURIComponent(sub)}`),
        fetch(`/api/user/graph-strength?sub=${encodeURIComponent(sub)}`),
      ]);
      const cJson = await cRes.json();
      const wJson = await wRes.json();
      const pJson = await pRes.json();
      const tJson = await tRes.json();
      const gJson = await gRes.json();
      if (!cJson.ok) throw new Error(cJson.error || 'campaigns');
      campaigns = cJson.campaigns ?? [];
      wallet = wJson.ok ? wJson : null;
      if (pJson.ok && pJson.prefs) {
        const p = pJson.prefs as Record<string, unknown>;
        prefs = {
          channels:
            (p.channels as { email?: boolean; in_app?: boolean; whatsapp?: boolean }) ?? {},
          categories: (p.categories as Record<string, boolean>) ?? {},
          max_campaigns_per_week: Number(p.max_campaigns_per_week) || 5,
          manual_interest_tags: (p.manual_interest_tags as string[]) ?? [],
        };
      } else {
        prefs = {
          channels: { email: true, in_app: true, whatsapp: false },
          categories: {},
          max_campaigns_per_week: 5,
          manual_interest_tags: [],
        };
      }
      identityTags = tJson.ok ? tJson.tags ?? [] : [];
      const inf = tJson.ok ? (tJson as { inference?: InferenceIdentityWrapper | null }).inference : null;
      inferenceIdentity = inf ?? null;
      const intel = tJson.ok
        ? (tJson as { identityIntelligence?: IdentityIntelligenceWrapper | null }).identityIntelligence
        : null;
      identityIntelligence = intel ?? null;
      manualTagInput = (prefs.manual_interest_tags ?? []).join(', ');
      if (gJson.ok) {
        graphStrength = {
          score: gJson.score,
          label: gJson.label,
          source_count: gJson.source_count,
          freshness_bucket: gJson.freshness_bucket,
          tag_count: gJson.tag_count,
        };
      } else {
        graphStrength = null;
      }
      const [ratesRes, visRes] = await Promise.all([
        fetch(`/api/creator/rates?sub=${encodeURIComponent(sub)}`),
        fetch(`/api/creator/visibility?sub=${encodeURIComponent(sub)}`),
      ]);
      const ratesJson = await ratesRes.json();
      const visJson = await visRes.json();
      if (ratesJson.rates) creatorRates = ratesJson.rates;
      if (visJson.visibility) visibility = visJson.visibility;
    } catch (e) {
      err = e instanceof Error ? e.message : 'Load failed';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadAll();
  });

  async function savePrefs() {
    if (!sub || !prefs) return;
    const manualInterestTags = manualTagInput
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const res = await fetch('/api/user/update-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleSub: sub,
        channels: prefs.channels,
        categories: prefs.categories,
        max_campaigns_per_week: prefs.max_campaigns_per_week,
        manualInterestTags,
      }),
    });
    const j = await res.json();
    if (!j.ok) {
      err = 'Could not save preferences';
      return;
    }
    prefs = { ...prefs, manual_interest_tags: manualInterestTags };
    await loadAll();
  }

  function toggleChannel(k: 'email' | 'in_app' | 'whatsapp') {
    if (!prefs) return;
    prefs.channels = { ...prefs.channels, [k]: !prefs.channels[k] };
    prefs = prefs;
  }

  function toggleCategory(k: string) {
    if (!prefs) return;
    prefs.categories = { ...prefs.categories, [k]: !prefs.categories[k] };
    prefs = prefs;
  }

  async function logAction(campaignId: string, action: string) {
    if (!sub) return;
    await fetch('/api/user/campaign-interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleSub: sub, campaignId, action }),
    });
    await loadAll();
  }

  async function tryWithdraw() {
    withdrawMsg = '';
    const res = await fetch('/api/user/wallet/withdraw', { method: 'POST' });
    const j = await res.json();
    withdrawMsg = j.message || j.error || 'Unavailable';
  }

  async function runOperatorIntelligence() {
    if (!sub || intelligenceRunning) return;
    intelligenceMsg = '';
    intelligenceRunning = true;
    try {
      const q = intelligenceQuery.trim();
      const res = await fetch('/api/user/identity-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleSub: sub,
          ...(q ? { userQuery: q } : { force: true }),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !(j as { ok?: boolean }).ok) {
        intelligenceMsg =
          (j as { error?: string }).error === 'anthropic_not_configured'
            ? 'Server needs ANTHROPIC_API_KEY.'
            : (j as { error?: string }).error || 'Could not refresh operator view.';
        return;
      }
      identityIntelligence =
        (j as { identityIntelligence?: IdentityIntelligenceWrapper | null }).identityIntelligence ?? null;
      intelligenceMsg = (j as { fromCache?: boolean }).fromCache
        ? 'Loaded saved operator view.'
        : 'Operator view updated.';
      await loadAll();
    } catch {
      intelligenceMsg = 'Network error';
    } finally {
      intelligenceRunning = false;
    }
  }

  async function refreshIdentitySignals() {
    if (!sub || refreshingGraph) return;
    graphRefreshMsg = '';
    refreshingGraph = true;
    try {
      const res = await fetch('/api/refresh-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleSub: sub, forceInference: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        graphRefreshMsg = (j as { error?: string }).error || 'Refresh failed';
        return;
      }
      graphRefreshMsg = 'Signals updated. Brand match quality usually improves with fresher data.';
      await loadAll();
    } catch {
      graphRefreshMsg = 'Network error';
    } finally {
      refreshingGraph = false;
    }
  }

  async function saveRates(e: CustomEvent) {
    const rates = e.detail;
    creatorRates = { ...creatorRates, ...rates };
    await fetch('/api/creator/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub, rates }),
    }).catch(() => {});
  }

  async function saveVisibility(e: CustomEvent) {
    const vis = e.detail;
    visibility = { ...visibility, ...vis };
    await fetch('/api/creator/visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub, visibility: vis }),
    }).catch(() => {});
  }

  async function acceptOffer(e: CustomEvent) {
    const { campaignId } = e.detail;
    const phone = localStorage.getItem('wagwan_user_id') ? (localStorage.getItem('wagwan_phone') || '') : '';
    const campaign = campaigns.find(c => String(c.campaign_id) === String(campaignId));
    const res = await fetch('/api/creator/brief-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sub, campaignId, action: 'accept',
        phone,
        briefText: campaign?.creative_text || '',
      }),
    });
    const data = await res.json();
    if (data.whatsappLink) whatsappLink = data.whatsappLink;
    campaigns = campaigns.filter(c => String(c.campaign_id) !== String(campaignId));
  }

  async function declineOffer(e: CustomEvent) {
    const { campaignId } = e.detail;
    await fetch('/api/creator/brief-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub, campaignId, action: 'decline' }),
    }).catch(() => {});
    campaigns = campaigns.filter(c => String(c.campaign_id) !== String(campaignId));
  }

  const categoryKeys = ['music', 'fashion', 'events', 'sports', 'tech'];

  $: acctRows = [
    { label: 'Instagram', ok: $profile.instagramConnected, sub: $profile.instagramIdentity?.username },
    { label: 'Google', ok: $profile.googleConnected },
    { label: 'Spotify', ok: $profile.spotifyConnected },
    { label: 'LinkedIn', ok: $profile.linkedinConnected },
  ];
</script>

<div class="earn mx-auto max-w-2xl px-4 pb-28 pt-8 lg:pb-10">
  <header class="mb-8">
    <p class="text-xs font-semibold uppercase tracking-widest text-zinc-500">Earn</p>
    <h1 class="mt-1 text-2xl font-bold tracking-tight text-zinc-900">Your Offers</h1>
    <p class="mt-2 text-sm text-zinc-600">
      See campaigns matched to you, control channels, and track simulated payouts.
    </p>
    {#if graphStrength}
      <IntegrityScore
        score={graphStrength.score}
        label={graphStrength.label}
        breakdown={[
          { name: 'Google', connected: $profile.googleConnected },
          { name: 'Instagram', connected: $profile.instagramConnected },
          { name: 'Spotify', connected: $profile.spotifyConnected },
          { name: 'Apple Music', connected: $profile.appleMusicConnected },
          { name: 'LinkedIn', connected: $profile.linkedinConnected },
        ]}
      />
    {/if}
  </header>

  {#if err}
    <p class="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
  {/if}

  {#if graphStrength}
    <section class="mb-8 rounded-2xl border border-violet-200/80 bg-violet-50/40 p-5 shadow-sm backdrop-blur">
      <h2 class="flex items-center gap-2 text-lg font-semibold text-zinc-900">
        <Broadcast size={20} class="text-violet-600" weight="light" />
        Identity signal strength
      </h2>
      <p class="mt-2 text-sm text-zinc-600">
        Campaigns match using your identity graph. Higher strength usually means better, more relevant brand
        offers—especially when your data is fresh and multi-source.
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <span class="text-2xl font-bold tabular-nums text-zinc-900">{graphStrength.score}</span>
        <span class="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase text-violet-800"
          >{graphStrength.label}</span
        >
        <span class="text-sm text-zinc-600"
          >{graphStrength.source_count} sources · {graphStrength.freshness_bucket} · {graphStrength.tag_count} tags</span
        >
      </div>
      <div class="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
        <div
          class="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-600"
          style="width: {Math.min(100, graphStrength.score)}%"
        ></div>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={refreshingGraph}
          on:click={() => refreshIdentitySignals()}
        >
          {refreshingGraph ? 'Refreshing…' : 'Refresh signals from accounts'}
        </button>
        <a
          href="/profile"
          class="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
          >Connect more accounts</a
        >
      </div>
      {#if graphRefreshMsg}
        <p class="mt-2 text-sm text-zinc-700">{graphRefreshMsg}</p>
      {/if}
    </section>
  {/if}

  <RateCard
    igPostRate={creatorRates.ig_post_rate_inr}
    igStoryRate={creatorRates.ig_story_rate_inr}
    igReelRate={creatorRates.ig_reel_rate_inr}
    whatsappRate={creatorRates.whatsapp_intro_rate_inr}
    available={creatorRates.available}
    on:save={saveRates}
  />

  <section class="mb-8 rounded-2xl border border-zinc-200/80 bg-white/70 p-5 shadow-sm backdrop-blur">
    <div class="flex items-center justify-between gap-3">
      <h2 class="flex items-center gap-2 text-lg font-semibold text-zinc-900">
        <Wallet size={20} weight="light" class="text-emerald-600" />
 Overview
      </h2>
      <button
        type="button"
        class="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50"
        aria-label="Refresh"
        on:click={() => loadAll()}
      >
        <ArrowClockwise size={18} class={loading ? 'animate-spin' : ''} />
      </button>
    </div>
    {#if loading}
      <p class="mt-3 text-sm text-zinc-500">Loading…</p>
    {:else}
      <dl class="mt-4 grid grid-cols-3 gap-3 text-center">
        <div class="rounded-xl bg-zinc-50 py-3">
          <dt class="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Active</dt>
          <dd class="text-lg font-bold text-zinc-900">{campaigns.length}</dd>
        </div>
        <div class="rounded-xl bg-zinc-50 py-3">
          <dt class="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Pending ₹</dt>
          <dd class="text-lg font-bold text-emerald-700">{wallet?.summary.pending_inr ?? 0}</dd>
        </div>
        <div class="rounded-xl bg-zinc-50 py-3">
          <dt class="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Total ₹</dt>
          <dd class="text-lg font-bold text-zinc-900">{wallet?.summary.total_inr ?? 0}</dd>
        </div>
      </dl>
    {/if}
  </section>

  <section class="mb-8 rounded-2xl border border-zinc-200/80 bg-white/70 p-5 shadow-sm backdrop-blur">
    <h2 class="text-lg font-semibold text-zinc-900">Connected accounts</h2>
    <p class="mt-1 text-sm text-zinc-600">Last profile update: {$profile.profileUpdatedAt || '—'}</p>
    <ul class="mt-4 space-y-2">
      {#each acctRows as a}
        <li class="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-sm">
          <span class="font-medium text-zinc-800">{a.label}</span>
          <span class={a.ok ? 'text-emerald-600' : 'text-zinc-400'}>{a.ok ? 'Connected' : 'Not connected'}</span>
        </li>
      {/each}
    </ul>
    <a
      href="/profile"
      class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
    >
      Manage connections <ArrowSquareOut size={14} />
    </a>
  </section>

  {#if prefs}
    <section class="mb-8 rounded-2xl border border-zinc-200/80 bg-white/70 p-5 shadow-sm backdrop-blur">
      <h2 class="text-lg font-semibold text-zinc-900">Marketing preferences</h2>
      <div class="mt-4 space-y-3">
        <p class="text-xs font-medium uppercase text-zinc-500">Channels</p>
        <div class="flex flex-wrap gap-2">
          {#each [['email', 'Email'], ['in_app', 'In-app'], ['whatsapp', 'WhatsApp']] as [k, label]}
            <button
              type="button"
              class="rounded-full border px-3 py-1.5 text-sm transition {prefs.channels?.[k as 'email' | 'in_app' | 'whatsapp']
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                : 'border-zinc-200 bg-white text-zinc-600'}"
              on:click={() => toggleChannel(k as 'email' | 'in_app' | 'whatsapp')}
            >
              {label}
            </button>
          {/each}
        </div>
        <p class="mt-2 text-xs font-medium uppercase text-zinc-500">Categories</p>
        <div class="flex flex-wrap gap-2">
          {#each categoryKeys as k}
            <button
              type="button"
              class="rounded-full border px-3 py-1.5 text-sm capitalize transition {prefs.categories?.[k]
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-zinc-200 bg-white text-zinc-600'}"
              on:click={() => toggleCategory(k)}
            >
              {k}
            </button>
          {/each}
        </div>
        <label class="mt-2 block text-sm text-zinc-700">
          Max campaigns / week
          <input
            type="number"
            min="0"
            max="50"
            class="ml-2 w-20 rounded-lg border border-zinc-200 px-2 py-1"
            bind:value={prefs.max_campaigns_per_week}
          />
        </label>
        <button
          type="button"
          class="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          on:click={() => savePrefs()}
        >
          Save preferences
        </button>
      </div>
    </section>
  {/if}

  {#if campaigns.length}
    <div class="earn-section">
      <h2 class="earn-section-title">Inbound Offers</h2>
      <div class="earn-offers">
        {#each campaigns as campaign}
          <OfferCard
            campaignId={campaign.campaign_id}
            brandName={campaign.brand_name}
            title={campaign.title}
            creativeText={campaign.creative_text}
            rewardInr={campaign.reward_inr}
            matchReason={campaign.match_reason}
            matchScore={campaign.match_score}
            on:accept={acceptOffer}
            on:decline={declineOffer}
          />
        {/each}
      </div>
    </div>
  {/if}

  {#if whatsappLink}
    <div class="earn-whatsapp">
      <p class="earn-whatsapp-text">Brief accepted! Connect with the brand:</p>
      <a href={whatsappLink} target="_blank" rel="noopener" class="earn-whatsapp-btn">Open WhatsApp</a>
    </div>
  {/if}

  <section class="mb-8 rounded-2xl border border-zinc-200/80 bg-white/70 p-5 shadow-sm backdrop-blur">
    <h2 class="text-lg font-semibold text-zinc-900">Wallet</h2>
    <p class="mt-1 text-sm text-zinc-600">Simulated ledger — UPI withdraw coming soon.</p>
    {#if wallet}
      <ul class="mt-4 max-h-48 space-y-2 overflow-auto text-sm">
        {#each wallet.transactions as t}
          <li class="flex justify-between border-b border-zinc-100 py-2">
            <span class="text-zinc-700">{t.note || t.status}</span>
            <span class="font-medium text-zinc-900">₹{t.amount_inr}</span>
          </li>
        {/each}
        {#if !wallet.transactions.length}
          <li class="text-zinc-500">No transactions yet. Tap “Engage (credit)” on a campaign.</li>
        {/if}
      </ul>
    {/if}
    <button
      type="button"
      class="mt-4 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
      on:click={() => tryWithdraw()}
    >
      Withdraw
    </button>
    {#if withdrawMsg}
      <p class="mt-2 text-sm text-zinc-600">{withdrawMsg}</p>
    {/if}
  </section>

  <section class="mb-8 rounded-2xl border border-zinc-200/80 bg-white/70 p-5 shadow-sm backdrop-blur">
    <h2 class="text-lg font-semibold text-zinc-900">Your snapshot</h2>
    <p class="mt-1 text-sm text-zinc-600">
      Personal forecast from your connected accounts—refresh signals to update it. Tags below still power campaign matching.
    </p>
    <div class="mt-4 space-y-4">
      <IdentityIntelligencePanel intelligence={identityIntelligence} />
      <div class="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
        <label class="block text-xs font-medium text-zinc-700" for="intel-q">Ask the operator view (optional)</label>
        <input
          id="intel-q"
          type="text"
          class="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          placeholder="e.g. Should I double down on content or shipping this month?"
          bind:value={intelligenceQuery}
        />
        <button
          type="button"
          class="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-amber-700"
          disabled={intelligenceRunning}
          on:click={() => runOperatorIntelligence()}
        >
          {intelligenceRunning ? 'Working…' : intelligenceQuery.trim() ? 'Run with your question' : 'Regenerate operator view'}
        </button>
        {#if intelligenceMsg}
          <p class="mt-2 text-xs text-zinc-600">{intelligenceMsg}</p>
        {/if}
      </div>
      <InferenceIdentityPanel inference={inferenceIdentity} />
      {#if !loading && !inferenceIdentity}
        <p class="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600">
          No snapshot yet. Tap “Refresh signals from accounts” (server needs
          <code class="rounded bg-zinc-100 px-1 text-xs">ANTHROPIC_API_KEY</code>).
        </p>
      {/if}
    </div>
    <p class="mt-6 text-sm text-zinc-600">We also match on these interest tokens:</p>
    <div class="mt-3 flex flex-wrap gap-2">
      {#each identityTags as tag}
        <span class="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-800">{tag}</span>
      {/each}
      {#if !identityTags.length}
        <span class="text-sm text-zinc-500">No tags yet — connect accounts or add interests below.</span>
      {/if}
    </div>
    <label class="mt-4 block text-sm text-zinc-700">
      Manual interest tags (comma-separated)
      <textarea
        class="mt-1 w-full rounded-xl border border-zinc-200 p-2 text-sm"
        rows="2"
        bind:value={manualTagInput}
      ></textarea>
    </label>
    <button
      type="button"
      class="mt-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      on:click={() => savePrefs()}
    >
      Save tags
    </button>
  </section>

  <VisibilityControls
    musicVisible={visibility.music_visible}
    instagramVisible={visibility.instagram_visible}
    careerVisible={visibility.career_visible}
    lifestyleVisible={visibility.lifestyle_visible}
    calendarVisible={visibility.calendar_visible}
    emailVisible={visibility.email_visible}
    on:save={saveVisibility}
  />

  <button class="earn-preview-btn" on:click={() => showPortraitPreview = !showPortraitPreview}>
    {showPortraitPreview ? 'Hide Preview' : 'Preview Your Portrait'}
  </button>

  {#if showPortraitPreview}
    <PortraitPreview
      name={$profile.name}
      city={$profile.city}
      archetype=""
      vibeTags={[]}
      integrityScore={graphStrength?.score ?? 0}
      followers={$profile.instagramIdentity?.followersCount ?? 0}
      posts={$profile.instagramIdentity?.mediaCount ?? 0}
      rates={creatorRates}
      visibleSections={Object.entries(visibility).filter(([_, v]) => v).map(([k]) => k.replace('_visible', ''))}
    />
  {/if}

  <p class="text-center text-xs text-zinc-500">
    Brand tools: <a href="/brands" class="font-medium text-blue-600 hover:underline">/brands</a>
  </p>

  {#if refreshingGraph}
    <div
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/35 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        class="max-w-sm rounded-2xl border border-zinc-200/90 bg-white/95 p-8 text-center shadow-xl"
      >
        <div class="mb-4 flex justify-center text-violet-600">
          <ArrowClockwise size={28} class="animate-spin" aria-hidden="true" />
        </div>
        <p class="text-lg font-semibold text-zinc-900">Analysing your profile</p>
        <p class="mt-2 text-sm text-zinc-600">
          Running signal analysis across connected accounts. This can take a little while.
        </p>
      </div>
    </div>
  {/if}
</div>

<style>
  .earn :global(a) {
    text-underline-offset: 2px;
  }
  .earn-section { margin-top: 24px; }
  .earn-section-title {
    font-size: 15px; font-weight: 700; color: var(--text-primary);
    margin: 0 0 16px;
  }
  .earn-offers { display: flex; flex-direction: column; gap: 16px; }
  .earn-whatsapp {
    margin-top: 16px; padding: 16px; border-radius: 14px;
    background: rgba(77, 124, 255, 0.08); border: 1px solid rgba(77, 124, 255, 0.2);
    text-align: center;
  }
  .earn-whatsapp-text { font-size: 13px; color: var(--text-secondary); margin: 0 0 12px; }
  .earn-whatsapp-btn {
    display: inline-block; padding: 10px 24px; border-radius: 100px;
    background: #25D366; color: white; font-size: 14px; font-weight: 700;
    text-decoration: none; font-family: inherit;
  }
  .earn-preview-btn {
    width: 100%; margin-top: 16px; padding: 12px; border-radius: 14px;
    background: var(--glass-light); border: 1px solid var(--border-subtle);
    color: var(--text-secondary); font-size: 13px; font-weight: 600;
    font-family: inherit; cursor: pointer; transition: background 0.15s;
  }
  .earn-preview-btn:hover { background: var(--glass-medium); }
</style>
