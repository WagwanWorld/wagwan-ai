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

<div class="strategist">
  <!-- ═══ PROFILE HERO ═══ -->
  <div
    class="prof"
    style="
      display: flex; align-items: center; gap: 28px;
      padding: 32px 36px; margin-bottom: 24px;
      border-radius: 28px;
      background: var(--g-flat-bg);
      border: 1px solid var(--g-border, rgba(255,255,255,0.06));
      box-shadow: var(--g-flat-shadow);
      backdrop-filter: blur(32px); -webkit-backdrop-filter: blur(32px);
      position: relative; overflow: hidden;
    "
  >
    <!-- Top edge highlight -->
    <div class="prof-edge"></div>
    <!-- Warm glow -->
    <div class="prof-glow"></div>
    <!-- Accent gradient behind profile -->
    <div class="prof-accent-bg"></div>

    <!-- Avatar -->
    <div class="prof-av-wrap">
      {#if profile.profilePicture}
        <img src={profile.profilePicture} alt="" class="prof-av-img" />
      {:else}
        <div class="prof-av-fallback">{profile.name.charAt(0)}</div>
      {/if}
      <div class="prof-av-ring"></div>
    </div>

    <!-- Body -->
    <div class="prof-body">
      <div class="prof-name">{profile.name}</div>
      <div class="prof-meta">@{profile.username}</div>
      {#if profile.biography}
        <div class="prof-bio">{profile.biography}</div>
      {/if}
      <div class="prof-btns">
        <button class="b b--p" on:click={handleRefresh} disabled={refreshing}>
          {#if refreshing}
            <span class="btn-spinner"></span>
            {refreshPhase || 'Analysing...'}
          {:else}
            Run Analysis
          {/if}
        </button>
        <button class="b" on:click={scrollToPublish}>Create Post</button>
        <a href="#timing" class="b">Schedule</a>
      </div>
    </div>

    <!-- Stats -->
    <div class="prof-stats">
      <div class="pst">
        <Metric
          value={profile.followersCount.toLocaleString()}
          type="growth"
          size="lg"
          showLabel={false}
        />
        <div class="pst-l">Followers</div>
      </div>
      <div class="pst">
        <Metric
          value={profile.mediaCount.toLocaleString()}
          type="cadence"
          size="lg"
          showLabel={false}
        />
        <div class="pst-l">Posts</div>
      </div>
      <div class="pst">
        <Metric
          value={snapshot?.engagement_rate || '0'}
          suffix="%"
          type="engagement"
          size="lg"
          showLabel={false}
        />
        <div class="pst-l">Eng. Rate</div>
      </div>
    </div>
  </div>

  <!-- ═══ POSTS STRIP ═══ -->
  {#if recentPosts.length > 0}
    <div class="strip">
      {#each recentPosts as post}
        <a href={post.permalink} target="_blank" rel="noopener" class="th">
          {#if post.thumbnail}
            <img src={post.thumbnail} alt="" class="th-img" />
          {:else}
            <div class="th-placeholder"><span class="th-type">{post.type}</span></div>
          {/if}
          <div class="th-ov">
            <span class="th-s">{post.likes} likes</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}

  <!-- ═══ ERROR BANNER ═══ -->
  {#if refreshError}
    <div class="strat-banner" class:strat-banner--reauth={needsReauth}>
      <p class="banner-text">{refreshError}</p>
      {#if needsReauth}
        <a href="/brands/login" class="banner-action">Re-authenticate</a>
      {:else}
        <button class="banner-dismiss" on:click={() => (refreshError = '')}>Dismiss</button>
      {/if}
    </div>
  {/if}

  <!-- ═══ LOADING BAR ═══ -->
  {#if loading}
    <div class="strat-loading-bar">
      <div class="strat-loading-fill"></div>
    </div>
    <p class="strat-loading-text-small">Loading intelligence data...</p>
  {/if}

  <!-- ═══ DATA ERROR ═══ -->
  {#if dataError}
    <div class="strat-banner">
      <p class="banner-text">{dataError}</p>
      <button
        class="banner-dismiss"
        on:click={() => {
          dataError = '';
          reloadData();
        }}>Retry</button
      >
    </div>
  {/if}

  <!-- ═══ BENTO GRID ═══ -->
  <div class="grid">
    <!-- Weekly Brief (span 12) — promoted to first section -->
    <GlassCard
      span={12}
      color="blue"
      expandable
      expandLabel="Read full brief"
      glowSize={115}
      delay={0.36}
    >
      {#if brief}
        <StratWeeklyBrief {brief} />
      {:else}
        <div class="section-empty">
          <span class="section-empty-label">Weekly Brief</span>
          <p class="section-empty-text">No brief yet.</p>
          <button
            class="section-retry"
            on:click|stopPropagation={() => runPhase('2c', 'Generating brief...')}
            disabled={refreshing}>Generate Brief</button
          >
        </div>
      {/if}
    </GlassCard>

    <!-- 4 Stat Cards -->
    <GlassCard span={3} color="red" glowSize={85}>
      <div class="cl">Reach (7d)</div>
      <Metric
        value={snapshot?.reach_7d?.toLocaleString() || '—'}
        type="reach"
        size="xl"
        showLabel={false}
      />
      <div class="cd">Weekly reach</div>
    </GlassCard>

    <GlassCard span={3} color="green" glowSize={70} glowY="bottom">
      <div class="cl">Avg. Saves</div>
      <Metric
        value={snapshot?.avg_saves?.toLocaleString() || '—'}
        type="engagement"
        size="xl"
        showLabel={false}
      />
      <div class="cd">Per post</div>
    </GlassCard>

    <GlassCard span={3} color="indigo" glowSize={65} glowX="left">
      <div class="cl">Shares</div>
      <Metric
        value={snapshot?.avg_shares?.toLocaleString() || '—'}
        type="shares"
        size="xl"
        showLabel={false}
      />
      <div class="cd">Per post avg</div>
    </GlassCard>

    <GlassCard span={3} color="amber" glowSize={70} glowX="left" glowY="bottom">
      <div class="cl">Posts/Week</div>
      <Metric value={snapshot?.posts_per_week || '—'} type="cadence" size="xl" showLabel={false} />
      <div class="cd">
        {snapshot?.posts_per_week && snapshot.posts_per_week < 2
          ? 'Increase recommended'
          : 'Current pace'}
      </div>
    </GlassCard>

    <!-- Section label: Intelligence -->
    <div class="sec-label">Intelligence</div>

    <!-- Brand Direction (span 8) -->
    <GlassCard
      span={8}
      color="red"
      expandable
      expandLabel="Expand full strategy"
      glowSize={170}
      glowY="bottom"
      delay={0.42}
    >
      {#if strategicPositioning?.brandDirection || intelligence?.identity?.rawSummary}
        <StratBrandDirection
          brandDirection={strategicPositioning?.brandDirection &&
          !strategicPositioning.brandDirection.includes('Not enough data')
            ? strategicPositioning.brandDirection
            : intelligence?.identity?.rawSummary || ''}
          audienceSummary={audiencePortrait?.narrative &&
          !audiencePortrait.narrative.includes('not yet available')
            ? audiencePortrait.narrative
            : ''}
          competitiveEdge={strategicPositioning?.competitiveGaps || ''}
          quickWins={strategicPositioning?.quickWins || []}
          brandIdentity={intelligence?.identity || null}
        />
      {:else}
        <div class="section-empty">
          <span class="section-empty-label">Brand Direction</span>
          <p class="section-empty-text">Not analysed yet.</p>
          <button
            class="section-retry"
            on:click|stopPropagation={() => runPhase('2c', 'Generating strategy...')}
            disabled={refreshing}>Analyse Strategy</button
          >
        </div>
      {/if}
    </GlassCard>

    <!-- Posting Heatmap (span 4) -->
    <GlassCard
      span={4}
      color="rose"
      expandable
      expandLabel="Full heatmap"
      glowSize={85}
      glowX="left"
      delay={0.42}
    >
      {#if postingHeatmap.length > 0}
        <StratPostingHeatmap heatmap={postingHeatmap} {bestHours} {bestDays} />
      {:else}
        <div class="section-empty">
          <span class="section-empty-label">Best Posting Times</span>
          <p class="section-empty-text">No posting data yet.</p>
          <button
            class="section-retry"
            on:click|stopPropagation={() => runPhase('1', 'Fetching data...')}
            disabled={refreshing}>Fetch Data</button
          >
        </div>
      {/if}
    </GlassCard>

    <!-- Audience DNA (span 6) -->
    <GlassCard
      span={6}
      color="teal"
      expandable
      expandLabel="Full demographics"
      glowSize={105}
      glowX="left"
      glowY="bottom"
      delay={0.48}
    >
      {#if audiencePortrait?.narrative}
        <StratAudienceDNA {demographics} {audiencePortrait} />
      {:else}
        <div class="section-empty">
          <span class="section-empty-label">Audience DNA</span>
          <p class="section-empty-text">Not analysed yet.</p>
          <button
            class="section-retry"
            on:click|stopPropagation={() => runPhase('2b', 'Analysing audience...')}
            disabled={refreshing}>Analyse Audience</button
          >
        </div>
      {/if}
    </GlassCard>

    <!-- Engagement Breakdown (span 6) -->
    <GlassCard
      span={6}
      color="indigo"
      expandable
      expandLabel="Full engagement breakdown"
      glowSize={140}
      delay={0.48}
    >
      <StratEngagementBreakdown
        rate={snapshot?.engagement_rate || 0}
        avgPerPost={Math.round((snapshot?.avg_likes || 0) + (snapshot?.avg_comments || 0))}
        postsPerWeek={snapshot?.posts_per_week || 0}
        growthTrend={0}
        contentTypes={Object.entries(contentPerformance?.formatBreakdown || {}).map(
          ([type, v]) => ({
            type,
            count: v?.count || 0,
            avgEng: v?.avgEngagement || 0,
          }),
        )}
        topPosts={[]}
        {topHashtags}
      />
      {#if !snapshot}
        <button
          class="section-retry"
          on:click|stopPropagation={() => runPhase('1', 'Fetching metrics...')}
          disabled={refreshing}>Fetch Metrics</button
        >
      {/if}
    </GlassCard>

    <!-- Section label: Opportunities -->
    <div class="sec-label">Opportunities</div>

    <!-- Content Ideas (span 6) -->
    <GlassCard
      span={6}
      color="purple"
      expandable
      expandLabel="See all ideas"
      glowSize={95}
      delay={0.54}
    >
      {#if contentIdeas.length > 0}
        <StratContentIdeas
          ideas={contentIdeas}
          captionStyle={strategicPositioning?.voiceGuidelines || ''}
          contentPillars={strategicPositioning?.contentPillars || []}
        />
      {:else}
        <div class="section-empty">
          <span class="section-empty-label">Content Ideas</span>
          <p class="section-empty-text">No ideas yet.</p>
          <button
            class="section-retry"
            on:click|stopPropagation={() => runPhase('2d', 'Generating ideas...')}
            disabled={refreshing}>Generate Ideas</button
          >
        </div>
      {/if}
    </GlassCard>

    <!-- Creator Matches (span 6) -->
    <GlassCard
      span={6}
      color="emerald"
      expandable
      expandLabel="Browse all matches"
      glowSize={85}
      glowY="bottom"
      delay={0.54}
    >
      <div class="section-empty">
        <span class="section-empty-label">Creator Matches</span>
        {#if proposals.filter((p) => p.type === 'creator_match').length > 0}
          <p class="section-empty-text">
            {proposals.filter((p) => p.type === 'creator_match').length} matches found
          </p>
        {:else}
          <p class="section-empty-text">No matches yet.</p>
          <button
            class="section-retry"
            on:click|stopPropagation={() => runPhase('2e', 'Finding creators...')}
            disabled={refreshing}>Find Creators</button
          >
        {/if}
      </div>
    </GlassCard>

    <!-- Competitor Watch (span 12) — bottom utility -->
    <GlassCard
      span={12}
      color="gold"
      expandable
      expandLabel="Manage competitors"
      glowSize={125}
      delay={0.6}
    >
      <StratCompetitorWatch {competitors} matrix={competitorMatrix} on:add={handleAddCompetitor} />
      {#if addingCompetitor}
        <p class="comp-status">Analysing competitor...</p>
      {/if}
      {#if competitorMessage}
        <p class="comp-status">{competitorMessage}</p>
      {/if}
    </GlassCard>
  </div>
</div>

<style>
  .strategist {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ═══ PROFILE HERO (inline-styled container, these are child elements) ═══ */
  .prof {
    position: relative;
  }

  .prof-edge {
    position: absolute;
    top: 0;
    left: 20px;
    right: 20px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
    pointer-events: none;
  }

  .prof-accent-bg {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      140deg,
      rgba(255, 55, 55, 0.02),
      rgba(255, 130, 65, 0.012),
      transparent 55%
    );
    pointer-events: none;
  }

  .prof-glow {
    position: absolute;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: rgba(255, 70, 70, 0.04);
    filter: blur(100px);
    top: -80px;
    right: -60px;
    animation: prof-glow-pulse 7s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes prof-glow-pulse {
    0%,
    100% {
      opacity: 0.35;
      transform: scale(1);
    }
    50% {
      opacity: 0.55;
      transform: scale(1.08);
    }
  }

  /* Avatar */
  .prof-av-wrap {
    width: 68px;
    height: 68px;
    border-radius: 18px;
    position: relative;
    flex-shrink: 0;
  }
  .prof-av-img {
    width: 68px;
    height: 68px;
    border-radius: 18px;
    object-fit: cover;
    box-shadow:
      0 6px 28px rgba(255, 70, 70, 0.12),
      0 1px 2px rgba(0, 0, 0, 0.2);
  }
  .prof-av-fallback {
    width: 68px;
    height: 68px;
    border-radius: 18px;
    background: linear-gradient(140deg, #ff4040, #ff7e3a);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 24px;
    color: #fff;
    box-shadow:
      0 6px 28px rgba(255, 70, 70, 0.12),
      0 1px 2px rgba(0, 0, 0, 0.2);
  }
  .prof-av-ring {
    position: absolute;
    inset: -4px;
    border-radius: 21px;
    border: 1px solid rgba(255, 70, 70, 0.08);
    animation: ring-breathe 4s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes ring-breathe {
    0%,
    100% {
      opacity: 0.15;
    }
    50% {
      opacity: 0.35;
    }
  }

  .prof-body {
    flex: 1;
    position: relative;
  }
  .prof-name {
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.025em;
    color: var(--g-text-1, rgba(255, 255, 255, 0.92));
  }
  .prof-meta {
    font-size: 12px;
    color: var(--g-text-ghost, rgba(255, 255, 255, 0.22));
    margin-top: 3px;
  }
  .prof-bio {
    font-size: 13px;
    color: var(--g-text-3, rgba(255, 255, 255, 0.3));
    margin-top: 10px;
    line-height: 1.55;
    max-width: 480px;
  }
  .prof-btns {
    display: flex;
    gap: 7px;
    margin-top: 18px;
  }
  .prof-stats {
    display: flex;
    gap: 32px;
    position: relative;
  }
  .pst {
    text-align: center;
  }
  .pst-l {
    font-size: 9px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    color: var(--g-text-ghost, rgba(255, 255, 255, 0.16));
    margin-top: 3px;
  }

  /* ═══ BUTTONS ═══ */
  .b {
    padding: 8px 18px;
    border-radius: 11px;
    border: 1px solid var(--g-border, rgba(255, 255, 255, 0.06));
    background: var(--g-flat-bg);
    color: rgba(255, 255, 255, 0.38);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: var(--g-flat-shadow);
    transition:
      color 0.6s,
      background 0.6s,
      border-color 0.6s,
      box-shadow 0.6s;
  }
  .b:hover {
    background: var(--g-raised-bg);
    color: rgba(255, 255, 255, 0.72);
    border-color: var(--g-raised-border, rgba(255, 255, 255, 0.065));
    box-shadow: var(--g-raised-shadow);
  }
  .b:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .b--p {
    background: linear-gradient(175deg, rgba(255, 65, 65, 0.1), rgba(255, 65, 65, 0.04));
    border-color: rgba(255, 65, 65, 0.1);
    color: rgba(255, 140, 140, 0.85);
  }
  .b--p:hover {
    background: linear-gradient(175deg, rgba(255, 65, 65, 0.14), rgba(255, 65, 65, 0.06));
    box-shadow: 0 2px 20px rgba(255, 65, 65, 0.06);
  }
  .btn-spinner {
    width: 12px;
    height: 12px;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ═══ POSTS STRIP ═══ */
  .strip {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 0 0 22px;
    margin-bottom: 22px;
    scrollbar-width: none;
  }
  .strip::-webkit-scrollbar {
    display: none;
  }
  .th {
    width: 108px;
    height: 108px;
    border-radius: 16px;
    overflow: hidden;
    flex-shrink: 0;
    border: 1px solid var(--g-flat-border, rgba(255, 255, 255, 0.04));
    position: relative;
    box-shadow: var(--g-flat-shadow);
    transition:
      border-color 0.7s,
      box-shadow 0.7s;
  }
  .th:hover {
    border-color: var(--g-raised-border, rgba(255, 255, 255, 0.065));
    box-shadow: var(--g-raised-shadow);
  }
  .th-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 1.2s var(--g-ease);
  }
  .th:hover .th-img {
    transform: scale(1.06);
  }
  .th-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.005));
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .th-type {
    font-size: 9px;
    color: var(--g-text-3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ═══ BENTO GRID ═══ */
  .grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 11px;
  }

  /* ═══ SECTION LABELS ═══ */
  .sec-label {
    grid-column: span 12;
    padding: 28px 0 8px;
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--g-text-ghost, rgba(255, 255, 255, 0.07));
  }

  /* ═══ CARD CONTENT TYPOGRAPHY ═══ */
  .cl {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    color: var(--g-text-3, rgba(255, 255, 255, 0.2));
    margin-bottom: 14px;
  }
  .cd {
    font-size: 11px;
    color: var(--g-text-ghost, rgba(255, 255, 255, 0.16));
    margin-top: 7px;
  }

  /* ═══ ERROR BANNER — glass styled ═══ */
  .strat-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 14px;
    background: var(--g-flat-bg);
    border: 1px solid var(--g-border, rgba(255, 255, 255, 0.06));
    border-left: 3px solid rgba(255, 65, 65, 0.4);
    margin: 16px 0;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
  }
  .strat-banner--reauth {
    border-left-color: rgba(245, 158, 11, 0.5);
  }
  .banner-text {
    font-size: 14px;
    color: var(--g-text-3, rgba(255, 255, 255, 0.42));
    margin: 0;
    flex: 1;
  }
  .banner-action {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: 9px;
    background: linear-gradient(175deg, rgba(255, 65, 65, 0.1), rgba(255, 65, 65, 0.04));
    border: 1px solid rgba(255, 65, 65, 0.1);
    color: rgba(255, 140, 140, 0.85);
    text-decoration: none;
    white-space: nowrap;
  }
  .banner-dismiss {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 5px 12px;
    border-radius: 9px;
    border: 1px solid var(--g-border, rgba(255, 255, 255, 0.06));
    background: var(--g-flat-bg);
    color: rgba(255, 255, 255, 0.38);
    cursor: pointer;
    font-family: inherit;
    transition:
      color 0.5s,
      background 0.5s;
  }
  .banner-dismiss:hover {
    background: var(--g-raised-bg);
    color: rgba(255, 255, 255, 0.72);
  }

  /* ═══ SECTION EMPTY + RETRY — glass styled ═══ */
  .section-empty {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .section-empty-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    color: var(--g-text-3, rgba(255, 255, 255, 0.2));
  }
  .section-empty-text {
    font-size: 14px;
    color: var(--g-text-3, rgba(255, 255, 255, 0.3));
    margin: 0;
  }
  .section-retry {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: 9px;
    border: 1px solid var(--g-border, rgba(255, 255, 255, 0.06));
    background: var(--g-flat-bg);
    color: rgba(255, 255, 255, 0.38);
    cursor: pointer;
    transition:
      color 0.5s,
      background 0.5s,
      border-color 0.5s;
    margin-top: 8px;
    align-self: flex-start;
    box-shadow: var(--g-flat-shadow);
  }
  .section-retry:hover {
    background: var(--g-raised-bg);
    color: rgba(255, 255, 255, 0.72);
    border-color: var(--g-raised-border, rgba(255, 255, 255, 0.065));
  }
  .section-retry:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ═══ LOADING BAR ═══ */
  .strat-loading-bar {
    width: 100%;
    height: 2px;
    background: rgba(255, 255, 255, 0.04);
    overflow: hidden;
    margin: 20px 0;
    border-radius: 1px;
  }
  .strat-loading-fill {
    width: 30%;
    height: 100%;
    background: linear-gradient(90deg, rgba(255, 65, 65, 0.6), rgba(255, 130, 65, 0.4));
    animation: loading-slide 1.5s ease-in-out infinite;
    border-radius: 1px;
  }
  @keyframes loading-slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(400%);
    }
  }
  .strat-loading-text-small {
    font-size: 11px;
    color: var(--g-text-ghost, rgba(255, 255, 255, 0.16));
    text-align: center;
    margin: 8px 0 0;
  }

  /* ═══ COMP STATUS ═══ */
  .comp-status {
    font-size: 14px;
    color: var(--g-text-3, rgba(255, 255, 255, 0.3));
    margin: 12px 0 0;
    font-style: italic;
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 900px) {
    .prof {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 18px !important;
      padding: 24px !important;
    }
    .prof-stats {
      margin-top: 14px;
    }
    .grid {
      grid-template-columns: repeat(4, 1fr);
    }
    .sec-label {
      grid-column: span 4;
    }
    .th {
      width: 88px;
      height: 88px;
      border-radius: 14px;
    }
  }
  @media (max-width: 600px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .sec-label {
      grid-column: span 2;
    }
    .prof-name {
      font-size: 21px;
    }
    .prof-av-img,
    .prof-av-fallback {
      width: 52px;
      height: 52px;
      font-size: 18px;
      border-radius: 14px;
    }
    .prof-av-wrap {
      width: 52px;
      height: 52px;
    }
    .pst-v {
      font-size: 21px;
    }
    .cn {
      font-size: 34px;
    }
    .th {
      width: 76px;
      height: 76px;
      border-radius: 12px;
    }
  }
</style>
