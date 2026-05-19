<script lang="ts">
  import { onMount } from 'svelte';
  import StratPostingHeatmap from './StratPostingHeatmap.svelte';
  import StratContentIdeas from './StratContentIdeas.svelte';
  import StratBrandDirection from './StratBrandDirection.svelte';
  import StratEngagementBreakdown from './StratEngagementBreakdown.svelte';
  import StratWeeklyBrief from './StratWeeklyBrief.svelte';
  import StratProposals from './StratProposals.svelte';
  import StratAudienceDNA from './StratAudienceDNA.svelte';
  import StratCompetitorWatch from './StratCompetitorWatch.svelte';
  import GlassCard from './GlassCard.svelte';
  import Metric from './Metric.svelte';

  export let brandProfile: {
    ig_user_id: string;
    ig_username: string;
    ig_name: string;
    ig_profile_picture: string;
    ig_followers_count: number;
  };

  let snapshot: any = null;
  let brief: any = null;
  let proposals: any[] = [];
  let competitors: any[] = [];
  let competitorMatrix: any = null;

  let loading = true;
  let loaded = false;
  let refreshing = false;
  let error = '';
  let refreshError = '';
  let needsReauth = false;

  // Derived from snapshot
  $: intelligence = snapshot?.intelligence || {};
  $: demographics = snapshot?.demographics || null;
  $: audiencePortrait = intelligence?.audiencePortrait || null;
  $: strategicPositioning = intelligence?.strategicPositioning || null;
  $: contentPerformance = snapshot?.content_performance || {};
  $: postingHeatmap = intelligence?.postingHeatmap || [];
  $: bestHours = intelligence?.bestHours || [];
  $: bestDays = intelligence?.bestDays || [];
  $: topHashtags = intelligence?.topHashtags || [];
  $: recentPosts = (intelligence?.recentPosts || []) as Array<{
    id: string;
    thumbnail: string;
    type: string;
    likes: number;
    comments: number;
    permalink: string;
  }>;

  // Profile from snapshot or fallback to prop
  $: profile = snapshot
    ? {
        name: snapshot.intelligence?.identity?.displayName || brandProfile.ig_name,
        username: snapshot.intelligence?.identity?.username || brandProfile.ig_username,
        biography: snapshot.intelligence?.identity?.rawSummary || '',
        profilePicture:
          snapshot.intelligence?.identity?.profilePicture || brandProfile.ig_profile_picture,
        followersCount: snapshot.followers || brandProfile.ig_followers_count,
        mediaCount: snapshot.media_count || 0,
        followingCount: snapshot.following || 0,
      }
    : {
        name: brandProfile.ig_name,
        username: brandProfile.ig_username,
        biography: '',
        profilePicture: brandProfile.ig_profile_picture,
        followersCount: brandProfile.ig_followers_count,
        mediaCount: 0,
        followingCount: 0,
      };

  // Content ideas from proposals or strategic positioning
  $: contentIdeas = proposals
    .filter((p) => p.type === 'content' && p.status === 'pending')
    .map((p) => p.payload)
    .slice(0, 5);

  onMount(async () => {
    await reloadData();
    loading = false;
    loaded = true;
  });

  let dataError = '';

  async function reloadData() {
    try {
      const res = await fetch('/api/brand/intelligence/dashboard');
      if (res.ok) {
        const d = await res.json();
        snapshot = d.snapshot || null;
        brief = d.brief || null;
        proposals = d.proposals || [];
        competitors = d.competitors || [];
        competitorMatrix = d.snapshot?.competitor_data || null;
        dataError = '';
      } else {
        dataError = `Dashboard load failed (${res.status})`;
      }
    } catch (e: any) {
      dataError = `Failed to load: ${e.message || 'network error'}`;
    }
  }

  let refreshPhase = '';

  async function runPhase(phase: string, label: string): Promise<boolean> {
    refreshing = true;
    refreshPhase = label;
    refreshError = '';
    try {
      const res = await fetch(`/api/brand/intelligence/refresh?phase=${phase}`, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        try {
          const errData = JSON.parse(text);
          if (errData.needsReauth) {
            needsReauth = true;
            refreshError = errData.error;
            refreshing = false;
            return false;
          }
          refreshError = errData.error || `Phase ${phase} failed (${res.status})`;
        } catch {
          refreshError = `Phase ${phase} failed (${res.status})`;
        }
        refreshing = false;
        return false;
      }
      await reloadData();
      refreshing = false;
      refreshPhase = '';
      return true;
    } catch {
      refreshError = `Phase ${phase} failed — network error`;
      refreshing = false;
      return false;
    }
  }

  async function handleRefresh() {
    refreshing = true;
    refreshError = '';
    needsReauth = false;

    // Phase 1: Instagram data + metrics (~5s)
    if (!(await runPhase('1', 'Fetching Instagram data...'))) {
      refreshing = false;
      return;
    }
    await reloadData();

    // Phase 2a: Identity pipeline (~8s)
    if (!(await runPhase('2a', 'Extracting brand identity...'))) {
      refreshing = false;
      return;
    }
    await reloadData();

    // Phase 2b: Audience + content analysis (~8s)
    if (!(await runPhase('2b', 'Analysing audience & content...'))) {
      refreshing = false;
      return;
    }
    await reloadData();

    // Phase 2c: Strategy + brief (~8s)
    if (!(await runPhase('2c', 'Generating strategy & brief...'))) {
      refreshing = false;
      return;
    }
    await reloadData();

    // Phase 2d: Content proposals (~8s)
    if (!(await runPhase('2d', 'Generating content ideas...'))) {
      refreshing = false;
      return;
    }
    await reloadData();

    // Phase 2e: Creator matches (~8s)
    if (!(await runPhase('2e', 'Finding creator matches...'))) {
      /* non-critical, continue */
    }
    await reloadData();

    refreshing = false;
    refreshPhase = '';
  }

  async function handleProposalAction(e: CustomEvent<{ id: string; status: string }>) {
    const { id, status } = e.detail;
    try {
      await fetch(`/api/brand/intelligence/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      // Remove from list
      proposals = proposals.filter((p) => p.id !== id);
    } catch {}
  }

  let addingCompetitor = false;
  let competitorMessage = '';

  async function handleAddCompetitor(e: CustomEvent<{ username: string }>) {
    addingCompetitor = true;
    competitorMessage = '';
    try {
      const res = await fetch('/api/brand/intelligence/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: e.detail.username }),
      });
      const data = await res.json();
      competitorMessage = data.message || '';
      // Reload competitors
      const reloadRes = await fetch('/api/brand/intelligence/competitors');
      if (reloadRes.ok) {
        const d = await reloadRes.json();
        competitors = d.competitors || [];
        competitorMatrix = d.matrix || null;
      }
    } catch {
      competitorMessage = 'Failed to add competitor.';
    } finally {
      addingCompetitor = false;
    }
  }

  function scrollToPublish() {
    const el = document.getElementById('create-publish-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<!-- ═══════════════════════════════════════════════════════════
     BRAND OS — Bento Dashboard (rendered directly, no sub-components)
     ═══════════════════════════════════════════════════════════ -->

{#if loading}
  <div class="bs-loading">
    <div class="bs-loading-bar"><div class="bs-loading-fill"></div></div>
    <p class="bs-loading-text">Loading intelligence…</p>
  </div>
{/if}

{#if refreshError}
  <div class="bs-banner">
    <p class="bs-banner-text">{refreshError}</p>
    {#if needsReauth}
      <a href="/" class="bs-banner-action">Re-authenticate</a>
    {:else}
      <button class="bs-banner-action" on:click={() => (refreshError = '')}>Dismiss</button>
    {/if}
  </div>
{/if}

{#if dataError}
  <div class="bs-banner">
    <p class="bs-banner-text">{dataError}</p>
    <button
      class="bs-banner-action"
      on:click={() => {
        dataError = '';
        reloadData();
      }}>Retry</button
    >
  </div>
{/if}

<!-- ── Brand Identity Card ── -->
<div class="bs-card bs-card--identity">
  <div class="bs-id-row">
    <div class="bs-id-left">
      {#if profile.profilePicture}
        <img src={profile.profilePicture} alt="" class="bs-avatar" />
      {:else}
        <div class="bs-avatar bs-avatar--init">{profile.name.charAt(0)}</div>
      {/if}
      <div class="bs-id-info">
        <span class="bs-id-name">{profile.name}</span>
        <span class="bs-id-handle">@{profile.username}</span>
      </div>
    </div>
    <div class="bs-id-actions">
      <button class="bs-btn bs-btn--primary" on:click={handleRefresh} disabled={refreshing}>
        {#if refreshing}{refreshPhase || 'Analysing…'}{:else}Run Analysis{/if}
      </button>
    </div>
  </div>
  {#if profile.biography}
    <p class="bs-id-bio">{profile.biography}</p>
  {/if}
</div>

<!-- ── Key Metrics Row ── -->
<div class="bs-card bs-card--metric">
  <span class="bs-label">FOLLOWERS</span>
  <span class="bs-metric-val">{profile.followersCount.toLocaleString()}</span>
</div>
<div class="bs-card bs-card--metric">
  <span class="bs-label">ENG. RATE</span>
  <span class="bs-metric-val">{snapshot?.engagement_rate || '0'}<small>%</small></span>
</div>
<div class="bs-card bs-card--metric">
  <span class="bs-label">REACH (7D)</span>
  <span class="bs-metric-val">{snapshot?.reach_7d?.toLocaleString() || '—'}</span>
  {#if snapshot?.reach_7d_delta}<span
      class="bs-metric-delta"
      class:up={snapshot.reach_7d_delta > 0}
      class:down={snapshot.reach_7d_delta < 0}
      >{snapshot.reach_7d_delta > 0 ? '+' : ''}{snapshot.reach_7d_delta.toFixed(1)}%</span
    >{/if}
</div>
<div class="bs-card bs-card--metric">
  <span class="bs-label">AVG. SAVES</span>
  <span class="bs-metric-val">{snapshot?.avg_saves?.toLocaleString() || '—'}</span>
</div>
<div class="bs-card bs-card--metric">
  <span class="bs-label">SHARES</span>
  <span class="bs-metric-val">{snapshot?.avg_shares?.toLocaleString() || '—'}</span>
</div>
<div class="bs-card bs-card--metric">
  <span class="bs-label">POSTS/WEEK</span>
  <span class="bs-metric-val">{snapshot?.posts_per_week || '—'}</span>
</div>

<!-- ── Weekly Brief ── -->
{#if brief}
  <div class="bs-card bs-card--brief">
    <div class="bs-card-head">
      <span class="bs-label">WEEKLY BRIEF</span>
      <span class="bs-card-date">{brief.brief_date}</span>
    </div>
    <h3 class="bs-brief-headline">{brief.headline}</h3>
    {#if brief.key_metrics?.length}
      <div class="bs-brief-metrics">
        {#each brief.key_metrics as km}
          <div class="bs-brief-km">
            <span class="bs-brief-km-label">{km.metric}</span>
            <span class="bs-brief-km-val">{km.current}</span>
            <span
              class="bs-brief-km-delta"
              class:up={km.trend === 'up'}
              class:down={km.trend === 'down'}
              >{km.deltaPct > 0 ? '+' : ''}{km.deltaPct.toFixed(1)}%</span
            >
          </div>
        {/each}
      </div>
    {/if}
  </div>
  <div class="bs-card bs-card--brief-section">
    <span class="bs-label bs-label--green">WHAT'S WORKING</span>
    <p class="bs-body">{brief.sections.whats_working}</p>
  </div>
  <div class="bs-card bs-card--brief-section">
    <span class="bs-label bs-label--red">WHAT'S NOT</span>
    <p class="bs-body">{brief.sections.whats_not}</p>
  </div>
  <div class="bs-card bs-card--brief-section">
    <span class="bs-label bs-label--amber">RECOMMENDED MOVES</span>
    <p class="bs-body">{brief.sections.recommended_moves}</p>
  </div>
{:else if loaded}
  <div class="bs-card bs-card--brief">
    <div class="bs-card-head"><span class="bs-label">WEEKLY BRIEF</span></div>
    <p class="bs-body bs-body--muted">No brief yet. Run analysis to generate one.</p>
    <button
      class="bs-btn"
      on:click|stopPropagation={() => runPhase('2c', 'Generating brief…')}
      disabled={refreshing}>Generate Brief</button
    >
  </div>
{/if}

<!-- ── Brand Direction ── -->
{#if strategicPositioning?.brandDirection || intelligence?.identity?.rawSummary}
  <div class="bs-card bs-card--direction">
    <div class="bs-card-head"><span class="bs-label">BRAND DIRECTION</span></div>
    <p class="bs-body">
      {strategicPositioning?.brandDirection &&
      !strategicPositioning.brandDirection.includes('Not enough data')
        ? strategicPositioning.brandDirection
        : intelligence?.identity?.rawSummary || ''}
    </p>
    {#if intelligence?.identity?.brandVibes?.length}
      <div class="bs-tags">
        {#each intelligence.identity.brandVibes.slice(0, 6) as vibe}
          <span class="bs-tag">{vibe}</span>
        {/each}
      </div>
    {/if}
    {#if strategicPositioning?.quickWins?.length}
      <div class="bs-quick-wins">
        <span class="bs-label bs-label--amber" style="margin-bottom:6px">QUICK WINS</span>
        {#each strategicPositioning.quickWins.slice(0, 3) as win}
          <p class="bs-body bs-body--sm">• {win}</p>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<!-- ── Audience DNA ── -->
{#if audiencePortrait?.narrative}
  <div class="bs-card bs-card--audience">
    <div class="bs-card-head"><span class="bs-label">AUDIENCE DNA</span></div>
    <p class="bs-body">{audiencePortrait.narrative}</p>
    {#if audiencePortrait.primaryDemographic}
      <div class="bs-demo-row">
        <div class="bs-demo-item">
          <span class="bs-label">AGE</span><span class="bs-demo-val"
            >{audiencePortrait.primaryDemographic.ageRange || '—'}</span
          >
        </div>
        <div class="bs-demo-item">
          <span class="bs-label">GENDER</span><span class="bs-demo-val"
            >{audiencePortrait.primaryDemographic.gender || '—'}</span
          >
        </div>
        {#if audiencePortrait.primaryDemographic.topCities?.length}
          <div class="bs-demo-item">
            <span class="bs-label">TOP CITIES</span><span class="bs-demo-val"
              >{audiencePortrait.primaryDemographic.topCities.slice(0, 3).join(', ')}</span
            >
          </div>
        {/if}
      </div>
    {/if}
  </div>
{:else if loaded}
  <div class="bs-card">
    <div class="bs-card-head"><span class="bs-label">AUDIENCE DNA</span></div>
    <p class="bs-body bs-body--muted">Not analysed yet.</p>
    <button
      class="bs-btn"
      on:click|stopPropagation={() => runPhase('2b', 'Analysing…')}
      disabled={refreshing}>Analyse Audience</button
    >
  </div>
{/if}

<!-- ── Posting Heatmap ── -->
{#if bestHours.length || bestDays.length}
  <div class="bs-card bs-card--timing">
    <div class="bs-card-head"><span class="bs-label">BEST POSTING TIMES</span></div>
    <div class="bs-timing-grid">
      {#if bestDays.length}<div class="bs-timing-item">
          <span class="bs-label">DAYS</span><span class="bs-timing-val"
            >{bestDays.slice(0, 3).join(', ')}</span
          >
        </div>{/if}
      {#if bestHours.length}<div class="bs-timing-item">
          <span class="bs-label">HOURS</span><span class="bs-timing-val"
            >{bestHours
              .slice(0, 3)
              .map((h) => `${h}:00`)
              .join(', ')}</span
          >
        </div>{/if}
    </div>
  </div>
{/if}

<!-- ── Content Ideas ── -->
{#if contentIdeas.length > 0}
  <div class="bs-card bs-card--ideas">
    <div class="bs-card-head">
      <span class="bs-label">CONTENT IDEAS</span><span class="bs-count">{contentIdeas.length}</span>
    </div>
    <div class="bs-ideas-list">
      {#each contentIdeas.slice(0, 4) as idea}
        <div class="bs-idea">
          <span class="bs-idea-title">{idea.title || idea.hook || 'Untitled'}</span>
          {#if idea.format}<span class="bs-tag bs-tag--sm">{idea.format}</span>{/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- ── Top Hashtags ── -->
{#if topHashtags.length > 0}
  <div class="bs-card bs-card--hashtags">
    <div class="bs-card-head"><span class="bs-label">TOP HASHTAGS</span></div>
    <div class="bs-tags">
      {#each topHashtags.slice(0, 10) as tag}
        <span class="bs-tag">#{tag}</span>
      {/each}
    </div>
  </div>
{/if}

<!-- ── Recent Posts ── -->
{#if recentPosts.length > 0}
  <div class="bs-card bs-card--posts">
    <div class="bs-card-head"><span class="bs-label">RECENT POSTS</span></div>
    <div class="bs-posts-strip">
      {#each recentPosts.slice(0, 6) as post}
        <a href={post.permalink} target="_blank" rel="noopener" class="bs-post-thumb">
          {#if post.thumbnail}
            <img src={post.thumbnail} alt="" />
          {:else}
            <span class="bs-post-type">{post.type}</span>
          {/if}
          <span class="bs-post-stat">{post.likes}</span>
        </a>
      {/each}
    </div>
  </div>
{/if}

<style>
  /* ══════════════════════════════════════════════════════════
     BRAND OS — Strategist Bento Cards
     ══════════════════════════════════════════════════════════ */

  /* ── Card base ── */
  .bs-card {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    word-break: break-word;
  }
  .bs-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }
  .bs-card-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    flex-shrink: 0;
  }
  .bs-card-date {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    color: #3a3a40;
    margin-left: auto;
  }

  /* ── Labels ── */
  .bs-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
  }
  .bs-label--green {
    color: #4ade80;
  }
  .bs-label--red {
    color: #f87171;
  }
  .bs-label--amber {
    color: #e8833a;
  }
  .bs-count {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: #6a6a72;
    background: rgba(255, 255, 255, 0.04);
    padding: 2px 7px;
    border-radius: 100px;
  }

  /* ── Body text ── */
  .bs-body {
    font-size: 13px;
    color: #ededef;
    line-height: 1.6;
    margin: 0;
  }
  .bs-body--muted {
    color: #3a3a40;
  }
  .bs-body--sm {
    font-size: 12px;
    margin: 2px 0;
  }

  /* ── Tags ── */
  .bs-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 10px;
  }
  .bs-tag {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6a6a72;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    white-space: nowrap;
  }
  .bs-tag--sm {
    font-size: 8px;
    padding: 2px 6px;
  }

  /* ── Button ── */
  .bs-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: transparent;
    color: #ededef;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
    margin-top: 10px;
    align-self: flex-start;
  }
  .bs-btn:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.03);
  }
  .bs-btn--primary {
    background: #e8833a;
    border-color: #e8833a;
    color: #0a0a0c;
    margin-top: 0;
  }
  .bs-btn--primary:hover {
    background: #d4752e;
    border-color: #d4752e;
  }
  .bs-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Identity Card ── */
  .bs-card--identity {
    grid-column: 1 / -1;
  }
  .bs-id-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .bs-id-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .bs-avatar {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    object-fit: cover;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }
  .bs-avatar--init {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #e87fa8, #e8833a);
    color: #fff;
    font-size: 18px;
    font-weight: 700;
  }
  .bs-id-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .bs-id-name {
    font-size: 16px;
    font-weight: 700;
    color: #ededef;
  }
  .bs-id-handle {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    color: #4a4a50;
  }
  .bs-id-bio {
    font-size: 12px;
    color: #6a6a72;
    line-height: 1.5;
    margin: 10px 0 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Metric Cards ── */
  .bs-card--metric {
    grid-column: span 1;
    gap: 6px;
    justify-content: center;
    align-items: flex-start;
  }
  .bs-metric-val {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: 28px;
    font-weight: 700;
    color: #ededef;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .bs-metric-val small {
    font-size: 0.5em;
    opacity: 0.5;
  }
  .bs-metric-delta {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    color: #4a4a50;
  }
  .bs-metric-delta.up {
    color: #4ade80;
  }
  .bs-metric-delta.down {
    color: #f87171;
  }

  /* ── Brief ── */
  .bs-card--brief {
    grid-column: 1 / -1;
  }
  .bs-brief-headline {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 16px;
    font-weight: 700;
    color: #ededef;
    margin: 0 0 12px;
    letter-spacing: -0.02em;
  }
  .bs-brief-metrics {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
  .bs-brief-km {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 80px;
  }
  .bs-brief-km-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #3a3a40;
  }
  .bs-brief-km-val {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    color: #ededef;
    line-height: 1;
  }
  .bs-brief-km-delta {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    color: #4a4a50;
  }
  .bs-brief-km-delta.up {
    color: #4ade80;
  }
  .bs-brief-km-delta.down {
    color: #f87171;
  }
  .bs-card--brief-section {
    grid-column: span 1;
  }

  /* ── Direction ── */
  .bs-card--direction {
    grid-column: span 2;
  }
  .bs-quick-wins {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  /* ── Audience ── */
  .bs-card--audience {
    grid-column: span 1;
  }
  .bs-demo-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }
  .bs-demo-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bs-demo-val {
    font-size: 13px;
    font-weight: 600;
    color: #ededef;
  }

  /* ── Timing ── */
  .bs-card--timing {
    grid-column: span 1;
  }
  .bs-timing-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .bs-timing-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .bs-timing-val {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 13px;
    font-weight: 600;
    color: #ededef;
  }

  /* ── Ideas ── */
  .bs-card--ideas {
    grid-column: span 1;
  }
  .bs-ideas-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bs-idea {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }
  .bs-idea:last-child {
    border-bottom: none;
  }
  .bs-idea-title {
    font-size: 12px;
    color: #ededef;
    flex: 1;
    min-width: 0;
  }

  /* ── Hashtags ── */
  .bs-card--hashtags {
    grid-column: span 1;
  }

  /* ── Posts ── */
  .bs-card--posts {
    grid-column: 1 / -1;
  }
  .bs-posts-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .bs-posts-strip::-webkit-scrollbar {
    display: none;
  }
  .bs-post-thumb {
    width: 80px;
    height: 80px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.02);
  }
  .bs-post-thumb:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }
  .bs-post-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .bs-post-type {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: #3a3a40;
    text-transform: uppercase;
  }
  .bs-post-stat {
    position: absolute;
    bottom: 4px;
    right: 4px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    padding: 1px 4px;
    border-radius: 3px;
  }

  /* ── Loading ── */
  .bs-loading {
    grid-column: 1 / -1;
    text-align: center;
    padding: 24px;
  }
  .bs-loading-bar {
    width: 100%;
    height: 2px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 999px;
    overflow: hidden;
  }
  .bs-loading-fill {
    width: 30%;
    height: 100%;
    background: #e8833a;
    animation: bs-slide 1.5s ease-in-out infinite;
    border-radius: 999px;
  }
  @keyframes bs-slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(400%);
    }
  }
  .bs-loading-text {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    color: #3a3a40;
    margin: 8px 0 0;
  }

  /* ── Banner ── */
  .bs-banner {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-left: 3px solid #e8833a;
  }
  .bs-banner-text {
    font-size: 12px;
    color: #6a6a72;
    margin: 0;
    flex: 1;
  }
  .bs-banner-action {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: transparent;
    color: #ededef;
    cursor: pointer;
    text-decoration: none;
  }
  .bs-banner-action:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .bs-card--direction {
      grid-column: 1 / -1;
    }
    .bs-card--brief-section {
      grid-column: span 1;
    }
  }
  @media (max-width: 640px) {
    .bs-card--metric {
      grid-column: span 1;
    }
    .bs-card--brief-section {
      grid-column: 1 / -1;
    }
    .bs-card--direction {
      grid-column: 1 / -1;
    }
    .bs-card--audience {
      grid-column: 1 / -1;
    }
  }
</style>
