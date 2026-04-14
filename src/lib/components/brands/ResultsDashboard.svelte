<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  type MatchedCreator = {
    creator: {
      google_sub: string;
      name: string;
      handle: string;
      follower_count: number;
      content_themes: string[];
      location: string;
      rates: { ig_post_rate_inr: number; ig_story_rate_inr: number; ig_reel_rate_inr: number; available: boolean } | null;
      graph_strength: number;
    };
    score: number;
    reasoning: string;
    watch_out: string;
  };

  export let matches: MatchedCreator[] = [];
  export let brandName: string = '';

  const dispatch = createEventDispatcher<{
    startCampaign: { selected: string[] };
    startOver: void;
  }>();

  let selected = new Set<string>(matches.slice(0, Math.min(5, matches.length)).map(m => m.creator.google_sub));

  $: totalReach = matches
    .filter(m => selected.has(m.creator.google_sub))
    .reduce((sum, m) => sum + m.creator.follower_count, 0);

  $: estimatedCost = matches
    .filter(m => selected.has(m.creator.google_sub))
    .reduce((sum, m) => {
      const rate = m.creator.rates?.ig_post_rate_inr ?? 0;
      return sum + rate;
    }, 0);

  $: selectedCount = selected.size;

  function toggleCreator(sub: string) {
    const next = new Set(selected);
    if (next.has(sub)) next.delete(sub);
    else next.add(sub);
    selected = next;
  }

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  function formatINR(n: number): string {
    if (n === 0) return 'Free';
    return '₹' + n.toLocaleString('en-IN');
  }

  function initials(name: string): string {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }

  function tileGradient(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    const h2 = (hue + 38) % 360;
    return `linear-gradient(145deg, hsl(${hue}, 42%, 18%), hsl(${h2}, 36%, 10%))`;
  }

  $: strategyLabel = (() => {
    const avgScore = matches.reduce((s, m) => s + m.score, 0) / (matches.length || 1);
    if (avgScore >= 75) return 'High-affinity creator seeding';
    if (matches.length <= 5) return 'Focused micro-creator push';
    return 'Broad awareness campaign';
  })();
</script>

<div class="results-root">
  {#if matches.length > 0}
    <div class="summary-row">
      <div class="summary-card">
        <span class="summary-value">{formatNumber(totalReach)}</span>
        <span class="summary-label">Total Reach</span>
      </div>
      <div class="summary-card">
        <span class="summary-value">{matches.length}</span>
        <span class="summary-label">Matched Creators</span>
      </div>
      <div class="summary-card">
        <span class="summary-value">{formatINR(estimatedCost)}</span>
        <span class="summary-label">Estimated Cost</span>
      </div>
      <div class="summary-card summary-card--accent">
        <span class="summary-value summary-value--small">{strategyLabel}</span>
        <span class="summary-label">Recommended Strategy</span>
      </div>
    </div>
  {/if}

  {#if matches.length === 0}
    <div class="empty-state">
      <h3 class="empty-title">No exact matches yet</h3>
      <p class="empty-text">We couldn't find creators that perfectly match your criteria right now. Here's what a result would look like:</p>
    </div>

    <div class="grid-header">
      <h3 class="grid-title">Example creators</h3>
      <button class="text-btn" on:click={() => dispatch('startOver')}>Try different criteria</button>
    </div>

    <div class="creator-grid">
      {#each [
        { name: 'Sample Creator', handle: 'creator1', score: 85, themes: ['fitness', 'lifestyle'], followers: '12.4K', reason: 'Strong overlap with your target audience and content themes.' },
        { name: 'Another Creator', handle: 'creator2', score: 72, themes: ['fashion', 'sustainability'], followers: '8.1K', reason: 'Engaged micro-audience in your target geography.' },
        { name: 'Third Creator', handle: 'creator3', score: 68, themes: ['wellness', 'food'], followers: '5.2K', reason: 'Authentic voice that matches your brand tone.' },
      ] as placeholder}
        <div class="creator-card creator-card--placeholder">
          <div class="card-avatar" style="background: linear-gradient(145deg, hsl(220, 30%, 18%), hsl(258, 25%, 12%))">
            <span>{placeholder.name.split(' ').map(w => w[0]).join('')}</span>
          </div>
          <div class="card-info">
            <span class="card-name">{placeholder.name}</span>
            <span class="card-handle">@{placeholder.handle}</span>
          </div>
          <div class="card-meta">
            <span class="card-score">{placeholder.score}% match</span>
            <span class="card-followers">{placeholder.followers}</span>
          </div>
          <p class="card-reason">{placeholder.reason}</p>
          <div class="card-tags">
            {#each placeholder.themes as tag}
              <span class="tag">{tag}</span>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <div class="empty-cta">
      <button class="action-btn" on:click={() => dispatch('startOver')}>Try again with different criteria</button>
    </div>
  {:else}
    <div class="grid-header">
      <h3 class="grid-title">Your creators</h3>
      <button class="text-btn" on:click={() => dispatch('startOver')}>Start over</button>
    </div>

    <div class="creator-grid">
      {#each matches as match}
        {@const c = match.creator}
        {@const isSelected = selected.has(c.google_sub)}
        <button
          class="creator-card"
          class:creator-card--selected={isSelected}
          on:click={() => toggleCreator(c.google_sub)}
        >
          <div class="card-check" class:card-check--on={isSelected}>
            {#if isSelected}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5l3.5 3.5L13 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            {/if}
          </div>

          <div class="card-avatar" style="background: {tileGradient(c.google_sub)}">
            <span>{initials(c.name)}</span>
          </div>

          <div class="card-info">
            <span class="card-name">{c.name}</span>
            <span class="card-handle">@{c.handle}</span>
          </div>

          <div class="card-meta">
            <span class="card-score">{match.score}% match</span>
            <span class="card-followers">{formatNumber(c.follower_count)}</span>
          </div>

          <p class="card-reason">{match.reasoning}</p>

          <div class="card-tags">
            {#each c.content_themes.slice(0, 3) as tag}
              <span class="tag">{tag}</span>
            {/each}
          </div>
        </button>
      {/each}
    </div>

    {#if selectedCount > 0}
      <div class="action-bar">
        <div class="action-info">
          <span class="action-count">{selectedCount} selected</span>
          <span class="action-sep">·</span>
          <span class="action-cost">{formatINR(estimatedCost)}</span>
        </div>
        <button class="action-btn" on:click={() => dispatch('startCampaign', { selected: [...selected] })}>
          Start Campaign
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .results-root {
    max-width: 800px;
    margin: 0 auto;
    padding: 32px 24px 120px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .summary-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }

  .summary-card {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .summary-card--accent {
    border-color: var(--accent-primary);
    background: var(--accent-soft);
  }

  .summary-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .summary-value--small {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
  }

  .summary-label {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .grid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .grid-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .text-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: color 0.15s;
  }

  .text-btn:hover {
    color: var(--text-primary);
  }

  .creator-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .creator-card {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: inherit;
    transition: border-color 0.2s, background 0.2s;
    position: relative;
  }

  .creator-card:hover {
    border-color: var(--border-strong);
    background: var(--glass-medium);
  }

  .creator-card--selected {
    border-color: var(--accent-primary);
    background: var(--accent-soft);
  }

  .card-check {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 1.5px solid var(--border-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s;
  }

  .card-check--on {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .card-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .card-handle {
    font-size: 12px;
    color: var(--text-muted);
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-score {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent-primary);
  }

  .card-followers {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .card-reason {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tag {
    font-size: 11px;
    background: var(--glass-medium);
    border-radius: 6px;
    padding: 2px 8px;
    color: var(--text-muted);
  }

  .action-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-elevated);
    border-top: 1px solid var(--border-subtle);
    padding: 14px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 100;
    animation: slide-up 0.3s ease-out;
  }

  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .action-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .action-count {
    font-weight: 600;
    color: var(--text-primary);
  }

  .action-sep {
    color: var(--text-muted);
  }

  .action-btn {
    background: var(--accent-primary);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
  }

  .action-btn:hover { opacity: 0.9; }
  .action-btn:active { transform: scale(0.97); }

  .empty-state {
    text-align: center;
    padding: 24px 24px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .empty-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .empty-text {
    font-size: 14px;
    color: var(--text-muted);
    margin: 0;
    max-width: 400px;
    line-height: 1.5;
  }

  .empty-cta {
    display: flex;
    justify-content: center;
    padding-top: 8px;
  }

  .creator-card--placeholder {
    opacity: 0.5;
    pointer-events: none;
    border-style: dashed;
  }
</style>
