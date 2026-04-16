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
  import MagnetStraight from 'phosphor-svelte/lib/MagnetStraight';
  import Lightning from 'phosphor-svelte/lib/Lightning';
  import ChartLineUp from 'phosphor-svelte/lib/ChartLineUp';
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
  let showDetails = false;

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

      const reader = res.body?.getReader();
      if (!reader) { graphRefreshMsg = 'No response stream'; return; }
      const decoder = new TextDecoder();
      let buffer = '';
      let finalData: Record<string, unknown> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.step) graphRefreshMsg = msg.step;
            if (msg.done) finalData = msg;
          } catch {}
        }
      }

      if (finalData?.ok) {
        graphRefreshMsg = 'Signals updated. Brand match quality usually improves with fresher data.';
        await loadAll();
      } else {
        graphRefreshMsg = (finalData?.error as string) || 'Refresh failed';
      }
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

<div class="earn-page">
  <!-- Status banner -->
  <div class="earn-status" class:live={$profile.instagramConnected}>
    <div class="status-dot"></div>
    <span>
      {#if $profile.instagramConnected}
        You're live in the marketplace
      {:else}
        Connect Instagram to start earning
      {/if}
    </span>
    <button
      class="earn-refresh-btn"
      aria-label="Refresh"
      on:click={() => loadAll()}
    >
      <ArrowClockwise size={16} class={loading ? 'animate-spin' : ''} />
    </button>
  </div>

  {#if err}
    <p class="earn-error">{err}</p>
  {/if}

  <!-- Match stats -->
  <div class="earn-stats">
    <div class="earn-stat-card">
      <span class="stat-value">{graphStrength?.source_count ?? 0}</span>
      <span class="stat-label">Profile views from brands</span>
    </div>
    <div class="earn-stat-card">
      <span class="stat-value">{campaigns.length}</span>
      <span class="stat-label">Matches this week</span>
    </div>
    <div class="earn-stat-card">
      <span class="stat-value">₹{wallet?.summary?.total_inr ?? 0}</span>
      <span class="stat-label">Lifetime earnings</span>
    </div>
  </div>

  <!-- Active campaigns -->
  <div class="earn-section">
    <h2 class="earn-section-title">Active campaigns</h2>
    {#if loading}
      <div class="earn-empty"><p>Loading...</p></div>
    {:else if campaigns.length === 0}
      <div class="earn-empty">
        <p>No campaigns yet. We're finding brands that match your vibe.</p>
      </div>
    {:else}
      <div class="earn-campaign-list">
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
    {/if}
  </div>

  {#if whatsappLink}
    <div class="earn-whatsapp">
      <p class="earn-whatsapp-text">Brief accepted! Connect with the brand:</p>
      <a href={whatsappLink} target="_blank" rel="noopener" class="earn-whatsapp-btn">Open WhatsApp</a>
    </div>
  {/if}

  <!-- How it works -->
  <div class="earn-section">
    <h2 class="earn-section-title">How it works</h2>
    <div class="earn-steps">
      <div class="earn-step">
        <div class="step-icon"><MagnetStraight size={24} weight="duotone" /></div>
        <div>
          <h3 class="step-title">We match you</h3>
          <p class="step-desc">Brands are paired with you based on your identity and aesthetic.</p>
        </div>
      </div>
      <div class="earn-step">
        <div class="step-icon"><Lightning size={24} weight="duotone" /></div>
        <div>
          <h3 class="step-title">You approve & post</h3>
          <p class="step-desc">Review the brief, approve the content, and it goes live.</p>
        </div>
      </div>
      <div class="earn-step">
        <div class="step-icon"><ChartLineUp size={24} weight="duotone" /></div>
        <div>
          <h3 class="step-title">We report, you earn</h3>
          <p class="step-desc">Analytics sent to the brand automatically. You get paid.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Details toggle -->
  <button class="earn-details-toggle" on:click={() => showDetails = !showDetails}>
    {showDetails ? 'Hide details' : 'Show details'}
  </button>

  {#if showDetails}
    <!-- Identity signal strength -->
    {#if graphStrength}
      <div class="earn-section">
        <h2 class="earn-section-title">Identity signal strength</h2>
        <div class="earn-glass-panel">
          <div class="signal-header">
            <Broadcast size={20} weight="light" />
            <span class="signal-score">{graphStrength.score}</span>
            <span class="signal-label">{graphStrength.label}</span>
          </div>
          <p class="signal-meta">
            {graphStrength.source_count} sources · {graphStrength.freshness_bucket} · {graphStrength.tag_count} tags
          </p>
          <div class="signal-bar-track">
            <div class="signal-bar-fill" style="width: {Math.min(100, graphStrength.score)}%"></div>
          </div>
          <div class="signal-actions">
            <button
              class="earn-action-btn"
              disabled={refreshingGraph}
              on:click={() => refreshIdentitySignals()}
            >
              {refreshingGraph ? (graphRefreshMsg || 'Refreshing...') : 'Refresh signals'}
            </button>
            <a href="/profile" class="earn-link">Connect more accounts <ArrowSquareOut size={14} /></a>
          </div>
          {#if graphRefreshMsg}
            <p class="signal-msg">{graphRefreshMsg}</p>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Rates -->
    <div class="earn-section">
      <RateCard
        igPostRate={creatorRates.ig_post_rate_inr}
        igStoryRate={creatorRates.ig_story_rate_inr}
        igReelRate={creatorRates.ig_reel_rate_inr}
        whatsappRate={creatorRates.whatsapp_intro_rate_inr}
        available={creatorRates.available}
        on:save={saveRates}
      />
    </div>

    <!-- Wallet -->
    <div class="earn-section">
      <h2 class="earn-section-title">Wallet</h2>
      <div class="earn-glass-panel">
        <div class="wallet-stats">
          <div>
            <span class="wallet-amount">₹{wallet?.summary?.pending_inr ?? 0}</span>
            <span class="wallet-label">Pending</span>
          </div>
          <div>
            <span class="wallet-amount">₹{wallet?.summary?.withdrawable_inr ?? 0}</span>
            <span class="wallet-label">Withdrawable</span>
          </div>
        </div>
        {#if wallet?.transactions?.length}
          <div class="wallet-transactions">
            {#each wallet.transactions as t}
              <div class="wallet-tx">
                <span>{t.note || t.status}</span>
                <span class="wallet-tx-amount">₹{t.amount_inr}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="wallet-empty">No transactions yet.</p>
        {/if}
        <button class="earn-action-btn" on:click={() => tryWithdraw()}>Withdraw</button>
        {#if withdrawMsg}
          <p class="signal-msg">{withdrawMsg}</p>
        {/if}
      </div>
    </div>

    <!-- Visibility -->
    <div class="earn-section">
      <VisibilityControls
        musicVisible={visibility.music_visible}
        instagramVisible={visibility.instagram_visible}
        careerVisible={visibility.career_visible}
        lifestyleVisible={visibility.lifestyle_visible}
        calendarVisible={visibility.calendar_visible}
        emailVisible={visibility.email_visible}
        on:save={saveVisibility}
      />
    </div>

    <!-- Portrait preview -->
    <button class="earn-details-toggle" on:click={() => showPortraitPreview = !showPortraitPreview}>
      {showPortraitPreview ? 'Hide portrait preview' : 'Preview your portrait'}
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

    <!-- Snapshot / Intelligence -->
    <div class="earn-section">
      <h2 class="earn-section-title">Your snapshot</h2>
      <div class="earn-glass-panel">
        <IdentityIntelligencePanel intelligence={identityIntelligence} />
        <InferenceIdentityPanel inference={inferenceIdentity} />
        {#if !loading && !inferenceIdentity}
          <p class="signal-msg">No snapshot yet. Tap "Refresh signals" above.</p>
        {/if}
      </div>
    </div>
  {/if}

  {#if refreshingGraph}
    <div class="earn-overlay" role="status" aria-live="polite" aria-busy="true">
      <div class="earn-overlay-card">
        <div class="earn-overlay-icon">
          <ArrowClockwise size={28} class="animate-spin" aria-hidden="true" />
        </div>
        <p class="earn-overlay-title">Analysing your profile</p>
        <p class="earn-overlay-desc">Running signal analysis across connected accounts.</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .earn-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 20px;
    max-width: 640px;
    margin: 0 auto;
    width: 100%;
    padding-bottom: max(100px, env(safe-area-inset-bottom, 100px));
    font-family: var(--font-sans);
  }

  /* ── Status banner ── */
  .earn-status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px;
    background: var(--glass-light);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .earn-status.live { color: var(--text-primary); }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
    flex-shrink: 0;
  }
  .earn-status.live .status-dot {
    background: #4cd964;
    box-shadow: 0 0 8px rgba(76, 217, 100, 0.5);
  }
  .earn-refresh-btn {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
  }

  .earn-error {
    padding: 12px 16px;
    border-radius: 12px;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
    font-size: 13px;
    margin: 0;
  }

  /* ── Stats ── */
  .earn-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .earn-stat-card {
    background: var(--glass-light);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stat-value {
    font-size: 24px;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }
  .stat-label {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  /* ── Sections ── */
  .earn-section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 14px;
  }

  .earn-empty {
    background: var(--glass-light);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 32px 20px;
    text-align: center;
  }
  .earn-empty p {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
  }

  .earn-campaign-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ── How it works ── */
  .earn-steps {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .earn-step {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 20px;
    background: var(--glass-light);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
  }
  .step-icon {
    color: var(--accent-tertiary);
    flex-shrink: 0;
    margin-top: 2px;
  }
  .step-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 4px;
  }
  .step-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  /* ── Details toggle ── */
  .earn-details-toggle {
    width: 100%;
    padding: 12px;
    border-radius: 14px;
    background: var(--glass-light);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }
  .earn-details-toggle:hover { background: var(--glass-medium); }

  /* ── Glass panel ── */
  .earn-glass-panel {
    background: var(--glass-light);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ── Signal strength ── */
  .signal-header {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text-primary);
  }
  .signal-score {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .signal-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--accent-tertiary);
    background: rgba(255, 184, 77, 0.1);
    padding: 4px 10px;
    border-radius: 100px;
  }
  .signal-meta {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }
  .signal-bar-track {
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }
  .signal-bar-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--accent-primary), var(--accent-tertiary));
  }
  .signal-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .signal-msg {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
  }

  /* ── Action button ── */
  .earn-action-btn {
    padding: 10px 20px;
    border-radius: 12px;
    background: var(--glass-medium);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }
  .earn-action-btn:hover { background: rgba(255, 255, 255, 0.12); }
  .earn-action-btn:disabled { opacity: 0.5; cursor: default; }

  .earn-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--accent-tertiary);
    text-decoration: none;
  }
  .earn-link:hover { text-decoration: underline; }

  /* ── Wallet ── */
  .wallet-stats {
    display: flex;
    gap: 24px;
  }
  .wallet-stats > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .wallet-amount {
    font-size: 20px;
    font-weight: 800;
    color: var(--text-primary);
  }
  .wallet-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .wallet-transactions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 160px;
    overflow-y: auto;
  }
  .wallet-tx {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 13px;
    color: var(--text-secondary);
  }
  .wallet-tx-amount {
    font-weight: 600;
    color: var(--text-primary);
  }
  .wallet-empty {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  /* ── WhatsApp ── */
  .earn-whatsapp {
    padding: 16px;
    border-radius: 14px;
    background: rgba(77, 124, 255, 0.08);
    border: 1px solid rgba(77, 124, 255, 0.2);
    text-align: center;
  }
  .earn-whatsapp-text {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0 0 12px;
  }
  .earn-whatsapp-btn {
    display: inline-block;
    padding: 10px 24px;
    border-radius: 100px;
    background: #25D366;
    color: white;
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
    font-family: inherit;
  }

  /* ── Overlay ── */
  .earn-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    padding: 24px;
  }
  .earn-overlay-card {
    max-width: 320px;
    border-radius: 20px;
    background: var(--glass-medium);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 32px;
    text-align: center;
  }
  .earn-overlay-icon {
    color: var(--accent-tertiary);
    margin-bottom: 16px;
  }
  .earn-overlay-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 8px;
  }
  .earn-overlay-desc {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Responsive ── */
  @media (max-width: 520px) {
    .earn-stats {
      grid-template-columns: 1fr;
    }
  }

  /* ── Animate spin utility ── */
  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
