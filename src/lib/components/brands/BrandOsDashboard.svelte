<script lang="ts">
  import type { BrandOsDashboard } from '$lib/types/brand-os';

  export let dashboard: BrandOsDashboard;
  export let syncing: boolean = false;
  export let onRefresh: () => void = () => {};
  export let onRegenerateSynopsis: () => void = () => {};
  export let onRegenerateBrandKit: () => void = () => {};

  /* ── Helper: find metric by label (case-insensitive partial match) ── */
  function findMetric(label: string) {
    return dashboard.executive.metrics.find(
      (m) => m.label.toLowerCase().includes(label.toLowerCase())
    ) ?? { label, value: '—', delta: undefined, trend: undefined as 'up' | 'down' | 'flat' | undefined, note: undefined };
  }

  /* ── Deterministic sparkline bars (no Math.random) ── */
  function sparkBars(seed: number, count: number): number[] {
    const s = Math.abs(seed) || 1;
    return Array.from({ length: count }, (_, i) => ((s * 7 + i * 13) % 100) / 100);
  }

  /* ── Parse a numeric string like "1,234" or "12.5%" ── */
  function parseNum(v: string): number {
    return parseFloat(v.replace(/[,%]/g, '')) || 0;
  }

  /* ── Format large numbers ── */
  function fmt(v: string): string {
    return v || '—';
  }

  /* ── Compute brand health score 0-100 ── */
  function computeHealth(): number {
    const m = dashboard.executive.metrics;
    let score = 50; // base
    const engRate = parseNum(findMetric('eng').value);
    if (engRate > 3) score += 15;
    else if (engRate > 1.5) score += 8;
    const reach = parseNum(findMetric('reach').value);
    if (reach > 5000) score += 10;
    else if (reach > 1000) score += 5;
    const saves = parseNum(findMetric('save').value);
    if (saves > 10) score += 8;
    else if (saves > 3) score += 4;
    if (dashboard.brandVibes.length > 3) score += 7;
    else if (dashboard.brandVibes.length > 0) score += 3;
    if (dashboard.audienceInsights.personas.length > 1) score += 5;
    if (m.length >= 5) score += 5;
    return Math.min(100, Math.max(0, score));
  }

  /* ── Parse hex colors from palette string ── */
  function parsePalette(palette: string): string[] {
    const matches = palette.match(/#[0-9A-Fa-f]{3,8}/g);
    return matches && matches.length > 0 ? matches : ['#E8833A', '#1a1a2e', '#E87FA8', '#EDEDEF'];
  }

  /* ── Reactive derived data ── */
  $: exec = dashboard.executive;
  $: syn = dashboard.synopsis;
  $: aud = dashboard.audienceInsights;
  $: kit = dashboard.brandKit;
  $: ops = dashboard.campaignOps;
  $: content = dashboard.contentOps;
  $: posts = dashboard.recentPosts;
  $: vibes = dashboard.brandVibes;

  $: followers = findMetric('follower');
  $: engRate = findMetric('eng');
  $: reach = findMetric('reach');
  $: saves = findMetric('save');
  $: shares = findMetric('share');
  $: postsWeek = findMetric('post');

  $: health = computeHealth();
  $: healthColor = health >= 70 ? '#4ade80' : health >= 40 ? '#E8833A' : '#f87171';
  $: healthCircum = 2 * Math.PI * 30;
  $: healthDash = (health / 100) * healthCircum;

  $: followerSeed = parseNum(followers.value);
  $: engSeed = parseNum(engRate.value);
  $: reachSeed = parseNum(reach.value);

  $: palette = parsePalette(kit.visualDirection?.palette || '');

  $: audSummaryFirst = aud.summary ? aud.summary.split('.')[0] + '.' : 'No audience data yet.';

  $: calendarItems = (kit.contentCalendar || []).slice(0, 4);
  $: personas = aud.personas || [];

  $: bestTime = aud.keyInsights.find((k) => k.title.toLowerCase().includes('best') || k.title.toLowerCase().includes('time'));

  $: lastUpdatedDate = exec.lastUpdated
    ? new Date(exec.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';
</script>

<!-- ROW 1: Brief (span 2) + Brand Health (span 1) -->

<div class="bs-card bs-brief">
  <div class="bs-brief-glow"></div>
  <span class="bs-label">THIS WEEK'S BRIEF</span>
  <span class="bs-label bs-label-date">{lastUpdatedDate}</span>
  <h2 class="bs-brief-headline">{syn.headline || 'Your Weekly Brief'}</h2>
  <p class="bs-brief-body">{syn.whatHappened || 'No synopsis data available yet.'}</p>
  {#if syncing}
    <span class="bs-syncing-badge">Syncing...</span>
  {/if}
</div>

<div class="bs-card bs-health">
  <div class="bs-health-radial"></div>
  <span class="bs-label">BRAND HEALTH</span>
  <div class="bs-health-ring">
    <svg viewBox="0 0 72 72" width="72" height="72">
      <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="5" />
      <circle
        cx="36" cy="36" r="30"
        fill="none"
        stroke={healthColor}
        stroke-width="5"
        stroke-dasharray="{healthDash} {healthCircum}"
        stroke-linecap="round"
        transform="rotate(-90 36 36)"
        style="transition: stroke-dasharray 0.6s ease"
      />
    </svg>
    <span class="bs-health-num" style="color:{healthColor}">{health}</span>
  </div>
  <span class="bs-health-label" style="color:{healthColor}">
    {health >= 70 ? 'Healthy' : health >= 40 ? 'Needs Attention' : 'At Risk'}
  </span>
</div>

<!-- ROW 2: Primary Metrics (3 cards) -->

<div class="bs-card bs-metric">
  <span class="bs-label">FOLLOWERS</span>
  <span class="bs-metric-num">{fmt(followers.value)}</span>
  {#if followers.delta}
    <span class="bs-metric-delta bs-delta-green">+{followers.delta}</span>
  {/if}
  <div class="bs-spark">
    {#each sparkBars(followerSeed, 7) as h}
      <div class="bs-spark-bar bs-spark-green" style="height:{Math.max(12, h * 28)}px"></div>
    {/each}
  </div>
</div>

<div class="bs-card bs-metric">
  <span class="bs-label">ENG. RATE</span>
  <span class="bs-metric-num">{fmt(engRate.value)}<span class="bs-metric-suffix">%</span></span>
  <div class="bs-spark">
    {#each sparkBars(engSeed, 5) as h}
      <div class="bs-spark-bar bs-spark-blue" style="height:{Math.max(10, h * 24)}px"></div>
    {/each}
  </div>
</div>

<div class="bs-card bs-metric">
  <span class="bs-label">REACH (7D)</span>
  <span class="bs-metric-num">{fmt(reach.value)}</span>
  {#if reach.trend}
    <span class="bs-metric-delta" class:bs-delta-green={reach.trend === 'up'} class:bs-delta-red={reach.trend === 'down'}>
      {reach.trend === 'up' ? '+' : reach.trend === 'down' ? '-' : ''}{reach.delta || ''}
    </span>
  {/if}
  <div class="bs-spark">
    {#each sparkBars(reachSeed, 7) as h}
      <div class="bs-spark-bar" class:bs-spark-green={reach.trend === 'up'} class:bs-spark-red={reach.trend === 'down'} class:bs-spark-blue={!reach.trend || reach.trend === 'flat'} style="height:{Math.max(12, h * 28)}px"></div>
    {/each}
  </div>
</div>

<!-- ROW 3: Secondary Metrics (3 cards) -->

<div class="bs-card bs-metric bs-metric-sm">
  <span class="bs-label">AVG. SAVES</span>
  <span class="bs-metric-num bs-num-sm">{fmt(saves.value)}</span>
  <span class="bs-metric-sub">per post</span>
</div>

<div class="bs-card bs-metric bs-metric-sm">
  <span class="bs-label">SHARES</span>
  <span class="bs-metric-num bs-num-sm">{fmt(shares.value)}</span>
  <span class="bs-metric-sub">per post avg</span>
</div>

<div class="bs-card bs-metric bs-metric-sm">
  <span class="bs-label">POSTS/WEEK</span>
  <span class="bs-metric-num bs-num-sm">{fmt(postsWeek.value)}</span>
  {#if parseNum(postsWeek.value) < 2}
    <span class="bs-metric-note-amber">increase recommended</span>
  {/if}
</div>

<!-- ROW 4: Insight Cards (3 cards) -->

<div class="bs-card bs-insight bs-insight-green">
  <span class="bs-label bs-label-green">WHAT'S WORKING</span>
  <p class="bs-insight-body">&ldquo;{syn.whatHappened || 'No data yet.'}&rdquo;</p>
</div>

<div class="bs-card bs-insight bs-insight-red">
  <span class="bs-label bs-label-red">WHAT'S NOT</span>
  <p class="bs-insight-body">&ldquo;{syn.whyItHappened || 'No data yet.'}&rdquo;</p>
</div>

<div class="bs-card bs-insight bs-insight-amber">
  <span class="bs-label bs-label-amber">DO THIS WEEK</span>
  {#if syn.whatNext && syn.whatNext.length > 0}
    <ol class="bs-insight-list">
      {#each syn.whatNext as item, i}
        <li>{item}</li>
      {/each}
    </ol>
  {:else}
    <p class="bs-insight-body">No recommendations yet.</p>
  {/if}
</div>

<!-- ROW 5: Instagram Posts (full width) -->

<div class="bs-card bs-posts-strip">
  <span class="bs-label">RECENT POSTS</span>
  <div class="bs-posts-scroll">
    {#if posts && posts.length > 0}
      {#each posts as post}
        <a class="bs-post-thumb" href={post.permalink || '#'} target="_blank" rel="noopener noreferrer">
          {#if post.thumbnail}
            <img src={post.thumbnail} alt="Post" loading="lazy" />
          {:else}
            <div class="bs-post-placeholder"></div>
          {/if}
          {#if post.type && post.type !== 'IMAGE'}
            <span class="bs-post-badge">{post.type === 'VIDEO' ? 'REEL' : post.type}</span>
          {/if}
          <div class="bs-post-overlay">
            <span class="bs-post-stat">{post.likes ?? 0}</span>
            <span class="bs-post-stat">{post.comments ?? 0}</span>
          </div>
        </a>
      {/each}
    {:else}
      <span class="bs-empty">No posts synced yet</span>
    {/if}
  </div>
</div>

<!-- ROW 6: Brand Direction (span 2) + Audience (span 1) -->

<div class="bs-card bs-direction">
  <span class="bs-label">BRAND DIRECTION</span>
  <p class="bs-direction-desc">{aud.summary || 'No audience summary available.'}</p>

  {#if vibes && vibes.length > 0}
    <div class="bs-vibe-chips">
      {#each vibes as vibe}
        <span class="bs-vibe-chip">{vibe}</span>
      {/each}
    </div>
  {/if}

  <div class="bs-palette-row">
    <span class="bs-label bs-label-inline">PALETTE</span>
    {#each palette as color}
      <span class="bs-palette-dot" style="background:{color}"></span>
    {/each}
  </div>

  {#if kit.visualDirection?.mood}
    <div class="bs-mood-row">
      <span class="bs-label bs-label-inline">MOOD</span>
      <span class="bs-mood-val">{kit.visualDirection.mood}</span>
    </div>
  {/if}

  <button class="bs-regen-btn" on:click={onRegenerateBrandKit} disabled={syncing}>
    Regenerate Kit
  </button>
</div>

<div class="bs-card bs-audience">
  <span class="bs-label">YOUR AUDIENCE</span>
  <p class="bs-audience-summary">&ldquo;{audSummaryFirst}&rdquo;</p>
  <div class="bs-audience-sep"></div>
  {#if aud.keyInsights && aud.keyInsights.length > 0}
    <div class="bs-audience-demos">
      {#each aud.keyInsights.slice(0, 3) as insight}
        <div class="bs-demo-item">
          <span class="bs-demo-label">{insight.title}</span>
          <span class="bs-demo-val">{insight.value}</span>
        </div>
      {/each}
    </div>
  {:else}
    <span class="bs-empty">No insights yet</span>
  {/if}
</div>

<!-- ROW 7: Content Ideas (span 1) + Creator Matches (span 1) + Campaign Ops (span 1) -->

<div class="bs-card bs-ideas">
  <div class="bs-card-header">
    <span class="bs-label">CONTENT IDEAS</span>
    {#if calendarItems.length > 0}
      <span class="bs-count-badge">{calendarItems.length}</span>
    {/if}
  </div>
  {#if calendarItems.length > 0}
    <ul class="bs-ideas-list">
      {#each calendarItems as item, i}
        <li class="bs-idea-item">
          <span class="bs-idea-text">{item.concept}</span>
          <span class="bs-idea-tag" class:bs-tag-amber={i === 0} class:bs-tag-blue={i === 1} class:bs-tag-muted={i > 1}>{item.pillar}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <span class="bs-empty">No content calendar yet</span>
  {/if}
</div>

<div class="bs-card bs-creators">
  <div class="bs-card-header">
    <span class="bs-label">CREATOR MATCHES</span>
    {#if personas.length > 0}
      <span class="bs-count-badge">{personas.length}</span>
    {/if}
  </div>
  {#if personas.length > 0}
    <ul class="bs-creators-list">
      {#each personas as p, i}
        <li class="bs-creator-row">
          <span class="bs-creator-avatar" style="background:linear-gradient(135deg, {palette[i % palette.length]}, {palette[(i + 1) % palette.length]})">
            {p.name.charAt(0)}
          </span>
          <div class="bs-creator-info">
            <span class="bs-creator-name">{p.name}</span>
            <span class="bs-creator-desc">{p.description.length > 60 ? p.description.slice(0, 60) + '...' : p.description}</span>
          </div>
          <span class="bs-creator-match">&mdash;</span>
        </li>
      {/each}
    </ul>
  {:else}
    <span class="bs-empty">No personas identified</span>
  {/if}
</div>

<div class="bs-card bs-campops">
  <span class="bs-label">CAMPAIGN OPS</span>

  {#if ops.activeCount > 0}
    <span class="bs-campops-active">{ops.activeCount} active</span>
  {:else}
    <span class="bs-campops-none">No active campaigns</span>
  {/if}

  <div class="bs-pipeline">
    <span class="bs-label" style="margin-top:12px">CONTENT PIPELINE</span>
    <div class="bs-pipeline-row">
      <div class="bs-pipeline-item">
        <span class="bs-pipeline-num">{content.draft}</span>
        <span class="bs-pipeline-label">Draft</span>
      </div>
      <div class="bs-pipeline-item">
        <span class="bs-pipeline-num">{content.scheduled}</span>
        <span class="bs-pipeline-label">Sched</span>
      </div>
      <div class="bs-pipeline-item">
        <span class="bs-pipeline-num">{content.published}</span>
        <span class="bs-pipeline-label">Live</span>
      </div>
      <div class="bs-pipeline-item">
        <span class="bs-pipeline-num">{content.failed}</span>
        <span class="bs-pipeline-label">Fail</span>
      </div>
    </div>
  </div>

  {#if bestTime}
    <div class="bs-best-time">
      <span class="bs-label">BEST TIME</span>
      <span class="bs-best-time-val">{bestTime.value}</span>
    </div>
  {/if}

  <button class="bs-refresh-btn" on:click={onRefresh} disabled={syncing}>
    {syncing ? 'Refreshing...' : 'Refresh Data'}
  </button>
</div>

<style>
  /* ── Host: display contents so cards flow into parent grid ── */
  :host { display: contents; }

  /* ── Base card ── */
  .bs-card {
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 18px 16px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s ease;
  }
  .bs-card:hover {
    border-color: rgba(255,255,255,0.12);
  }

  /* ── Labels ── */
  .bs-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4A4A50;
    display: block;
    margin-bottom: 8px;
  }
  .bs-label-date {
    position: absolute;
    top: 18px;
    right: 16px;
    margin-bottom: 0;
    color: #3A3A40;
  }
  .bs-label-inline {
    display: inline;
    margin-right: 8px;
    margin-bottom: 0;
  }
  .bs-label-green { color: #4ade80; }
  .bs-label-red { color: #f87171; }
  .bs-label-amber { color: #E8833A; }

  /* ── ROW 1: Brief ── */
  .bs-brief {
    grid-column: span 2;
  }
  .bs-brief-glow {
    position: absolute;
    top: -30px;
    right: -30px;
    width: 120px;
    height: 120px;
    background: radial-gradient(circle, rgba(232,131,58,0.12) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
  }
  .bs-brief-headline {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    color: #EDEDEF;
    margin: 8px 0 10px;
    line-height: 1.3;
  }
  .bs-brief-body {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: #6A6A72;
    margin: 0;
  }
  .bs-syncing-badge {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: #E8833A;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-top: 10px;
    display: inline-block;
  }

  /* ── ROW 1: Brand Health ── */
  .bs-health {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .bs-health-radial {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(255,255,255,0.02) 0%, transparent 70%);
    pointer-events: none;
  }
  .bs-health .bs-label {
    align-self: flex-start;
  }
  .bs-health-ring {
    position: relative;
    width: 72px;
    height: 72px;
    margin: 4px 0 8px;
  }
  .bs-health-ring svg {
    display: block;
  }
  .bs-health-num {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: 20px;
    font-weight: 700;
  }
  .bs-health-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ── ROW 2/3: Metric cards ── */
  .bs-metric {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .bs-metric-num {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: 24px;
    font-weight: 700;
    color: #EDEDEF;
    line-height: 1.1;
  }
  .bs-num-sm {
    font-size: 20px;
  }
  .bs-metric-suffix {
    font-size: 14px;
    color: #6A6A72;
    margin-left: 1px;
  }
  .bs-metric-delta {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
  }
  .bs-delta-green { color: #4ade80; }
  .bs-delta-red { color: #f87171; }
  .bs-metric-sub {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: #3A3A40;
    text-transform: lowercase;
  }
  .bs-metric-note-amber {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: #E8833A;
    text-transform: lowercase;
    margin-top: 2px;
  }

  /* ── Sparklines ── */
  .bs-spark {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    margin-top: auto;
    padding-top: 8px;
    height: 32px;
  }
  .bs-spark-bar {
    width: 4px;
    border-radius: 2px;
    min-height: 4px;
    transition: height 0.3s ease;
  }
  .bs-spark-green { background: rgba(74,222,128,0.35); }
  .bs-spark-blue { background: rgba(77,124,255,0.3); }
  .bs-spark-red { background: rgba(248,113,113,0.35); }

  /* ── ROW 4: Insight cards ── */
  .bs-insight {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bs-insight-green {
    border-left: 3px solid #4ade80;
  }
  .bs-insight-red {
    border-left: 3px solid #f87171;
  }
  .bs-insight-amber {
    border-left: 3px solid #E8833A;
    background: rgba(232,131,58,0.06);
  }
  .bs-insight-body {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 11px;
    line-height: 1.6;
    color: #6A6A72;
    font-style: italic;
    margin: 0;
  }
  .bs-insight-list {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 11px;
    line-height: 1.7;
    color: #EDEDEF;
    margin: 0;
    padding-left: 16px;
    list-style: decimal;
  }
  .bs-insight-list li {
    margin-bottom: 4px;
    color: #6A6A72;
  }

  /* ── ROW 5: Instagram Posts strip ── */
  .bs-posts-strip {
    grid-column: 1 / -1;
  }
  .bs-posts-scroll {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.08) transparent;
  }
  .bs-posts-scroll::-webkit-scrollbar {
    height: 4px;
  }
  .bs-posts-scroll::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.08);
    border-radius: 2px;
  }
  .bs-post-thumb {
    position: relative;
    flex-shrink: 0;
    width: 100px;
    height: 100px;
    border-radius: 10px;
    overflow: hidden;
    display: block;
    text-decoration: none;
  }
  .bs-post-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .bs-post-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #E8833A, #E87FA8, #4d7cff);
  }
  .bs-post-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 7px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #EDEDEF;
    background: rgba(0,0,0,0.55);
    padding: 2px 5px;
    border-radius: 4px;
  }
  .bs-post-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 18px 6px 5px;
    background: linear-gradient(transparent, rgba(0,0,0,0.7));
    display: flex;
    gap: 8px;
  }
  .bs-post-stat {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: #fff;
    font-weight: 600;
  }

  /* ── ROW 6: Brand Direction ── */
  .bs-direction {
    grid-column: span 2;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .bs-direction-desc {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 11px;
    line-height: 1.6;
    color: #6A6A72;
    margin: 0;
  }
  .bs-vibe-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .bs-vibe-chip {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #EDEDEF;
    background: rgba(255,255,255,0.06);
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.07);
  }
  .bs-palette-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .bs-palette-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.1);
    flex-shrink: 0;
  }
  .bs-mood-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .bs-mood-val {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 11px;
    color: #6A6A72;
  }
  .bs-regen-btn {
    margin-top: 6px;
    align-self: flex-start;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #EDEDEF;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .bs-regen-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.18);
  }
  .bs-regen-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── ROW 6: Audience ── */
  .bs-audience {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bs-audience-summary {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 11px;
    line-height: 1.6;
    color: #6A6A72;
    font-style: italic;
    margin: 0;
  }
  .bs-audience-sep {
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin: 4px 0;
  }
  .bs-audience-demos {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bs-demo-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .bs-demo-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4A4A50;
  }
  .bs-demo-val {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 11px;
    color: #EDEDEF;
  }

  /* ── ROW 7: Content Ideas ── */
  .bs-ideas {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bs-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .bs-card-header .bs-label {
    margin-bottom: 0;
  }
  .bs-count-badge {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    font-weight: 700;
    color: #EDEDEF;
    background: rgba(255,255,255,0.08);
    padding: 2px 6px;
    border-radius: 6px;
  }
  .bs-ideas-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bs-idea-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .bs-idea-text {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: #6A6A72;
    flex: 1;
  }
  .bs-idea-tag {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 7px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .bs-tag-amber {
    color: #E8833A;
    background: rgba(232,131,58,0.1);
  }
  .bs-tag-blue {
    color: #4d7cff;
    background: rgba(77,124,255,0.1);
  }
  .bs-tag-muted {
    color: #4A4A50;
    background: rgba(255,255,255,0.04);
  }

  /* ── ROW 7: Creator Matches ── */
  .bs-creators {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bs-creators-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .bs-creator-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .bs-creator-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    color: #EDEDEF;
    flex-shrink: 0;
  }
  .bs-creator-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }
  .bs-creator-name {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: #EDEDEF;
  }
  .bs-creator-desc {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 9px;
    color: #4A4A50;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bs-creator-match {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    color: #3A3A40;
    flex-shrink: 0;
  }

  /* ── ROW 7: Campaign Ops ── */
  .bs-campops {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bs-campops-active {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    color: #4ade80;
  }
  .bs-campops-none {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 11px;
    color: #4A4A50;
    font-style: italic;
  }
  .bs-pipeline {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bs-pipeline-row {
    display: flex;
    gap: 12px;
  }
  .bs-pipeline-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .bs-pipeline-num {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    color: #EDEDEF;
  }
  .bs-pipeline-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 7px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4A4A50;
  }
  .bs-best-time {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }
  .bs-best-time-val {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 11px;
    color: #6A6A72;
  }
  .bs-refresh-btn {
    margin-top: auto;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #EDEDEF;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 6px 12px;
    cursor: pointer;
    width: 100%;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .bs-refresh-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.18);
  }
  .bs-refresh-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Shared ── */
  .bs-empty {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 11px;
    color: #3A3A40;
    font-style: italic;
  }

  /* ── Responsive: tablet ── */
  @media (max-width: 1024px) {
    .bs-brief {
      grid-column: 1 / -1;
    }
    .bs-direction {
      grid-column: 1 / -1;
    }
    .bs-posts-strip {
      grid-column: 1 / -1;
    }
  }

  /* ── Responsive: mobile ── */
  @media (max-width: 640px) {
    .bs-brief,
    .bs-health,
    .bs-metric,
    .bs-insight,
    .bs-posts-strip,
    .bs-direction,
    .bs-audience,
    .bs-ideas,
    .bs-creators,
    .bs-campops {
      grid-column: span 1;
    }
  }
</style>
