<script lang="ts">
  import Note from 'phosphor-svelte/lib/Note';

  type UserRow = {
    user_google_sub: string;
    name: string;
    city: string;
    match_score: number;
    match_score_breakdown?: {
      interest_match: number;
      behavior_match: number;
      intent_signal: number;
      engagement_probability: number;
    };
    match_reason: string;
    preview_tags: string[];
    followers: number;
    graph_strength: number;
    graph_strength_label: string;
    rates?: {
      ig_post_rate_inr?: number;
      ig_story_rate_inr?: number;
      ig_reel_rate_inr?: number;
      available?: boolean;
    };
  };

  type MemberBrief = {
    happening_now: string;
    do_next: string;
    missing: string;
  };

  export let user: UserRow;
  export let selected: boolean = false;
  export let brief: MemberBrief | null = null;
  export let briefLoading: boolean = false;

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    toggle: string;
    loadBrief: string;
  }>();

  let expanded = false;

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
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

  $: scoreColor = user.match_score >= 75 ? 'score--high' : user.match_score >= 50 ? 'score--mid' : 'score--low';
  $: strengthBadge = user.graph_strength_label === 'high'
    ? 'bg-emerald-500/20 text-emerald-300'
    : user.graph_strength_label === 'medium'
      ? 'bg-amber-500/20 text-amber-200'
      : 'bg-zinc-500/20 text-zinc-400';
</script>

<div class="creator-card" class:creator-card--selected={selected}>
  <button type="button" class="card-check" class:card-check--on={selected}
    on:click|stopPropagation={() => dispatch('toggle', user.user_google_sub)}
    aria-label="{selected ? 'Deselect' : 'Select'} {user.name}">
    {#if selected}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path d="M3 8.5l3.5 3.5L13 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {/if}
  </button>

  <button type="button" class="card-body" on:click={() => expanded = !expanded}>
    <div class="card-top">
      <div class="card-identity">
        <div class="card-avatar" style="background: {tileGradient(user.user_google_sub)}">
          <span>{initials(user.name)}</span>
        </div>
        <div class="card-name-block">
          <span class="card-name">{user.name}</span>
          <span class="card-location">{user.city || 'Unknown'}</span>
        </div>
      </div>
      <span class="card-followers">{formatNumber(user.followers || 0)}</span>
    </div>

    <div class="card-badges">
      <span class="card-score {scoreColor}">{Math.round(user.match_score)}% match</span>
      <span class="card-strength {strengthBadge}">{user.graph_strength}</span>
    </div>

    <div class="card-rates">
      {#if user.rates?.available}
        {#if user.rates.ig_post_rate_inr}<span class="rate-item">Post &#x20B9;{user.rates.ig_post_rate_inr?.toLocaleString('en-IN')}</span>{/if}
        {#if user.rates.ig_story_rate_inr}<span class="rate-item">Story &#x20B9;{user.rates.ig_story_rate_inr?.toLocaleString('en-IN')}</span>{/if}
        {#if user.rates.ig_reel_rate_inr}<span class="rate-item">Reel &#x20B9;{user.rates.ig_reel_rate_inr?.toLocaleString('en-IN')}</span>{/if}
      {:else}
        <span class="rate-item rate-item--na">Rates not set</span>
      {/if}
    </div>

    <div class="card-tags">
      {#each user.preview_tags.slice(0, 5) as tag}
        <span class="tag">{tag}</span>
      {/each}
    </div>

    <p class="card-reason">{user.match_reason}</p>
  </button>

  {#if expanded}
    <div class="card-expanded">
      {#if user.match_score_breakdown}
        <div class="breakdown">
          <p class="breakdown-title">Match breakdown</p>
          {#each [
            { label: 'Interest', value: user.match_score_breakdown.interest_match },
            { label: 'Behavior', value: user.match_score_breakdown.behavior_match },
            { label: 'Intent', value: user.match_score_breakdown.intent_signal },
            { label: 'Engagement', value: user.match_score_breakdown.engagement_probability },
          ] as item}
            <div class="breakdown-row">
              <span class="breakdown-label">{item.label}</span>
              <div class="breakdown-bar-track">
                <div class="breakdown-bar-fill" style="width:{Math.min(100, item.value * 100)}%"></div>
              </div>
              <span class="breakdown-val">{Math.round(item.value * 100)}</span>
            </div>
          {/each}
        </div>
      {/if}

      <div class="brief-section">
        {#if brief}
          <div class="brief-body">
            <p><span class="brief-label">Now:</span> {brief.happening_now}</p>
            <p><span class="brief-label">Next:</span> {brief.do_next}</p>
            <p><span class="brief-label">Missing:</span> {brief.missing}</p>
          </div>
        {:else}
          <button type="button" class="brief-btn" disabled={briefLoading}
            on:click|stopPropagation={() => dispatch('loadBrief', user.user_google_sub)}>
            <Note size={14} />
            {briefLoading ? 'Loading...' : 'Generate brief'}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .creator-card {
    position: relative;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    transition: border-color 0.3s, background 0.3s, transform 0.3s;
    overflow: hidden;
  }
  .creator-card:hover {
    border-color: rgba(77, 124, 255, 0.25);
    background: var(--glass-medium, rgba(255,255,255,0.04));
  }
  .creator-card--selected {
    border-color: var(--accent-secondary, #4D7CFF);
    box-shadow: 0 0 0 1px rgba(77, 124, 255, 0.15);
  }
  .card-check {
    position: absolute; top: 14px; right: 14px;
    width: 22px; height: 22px; border-radius: 6px;
    border: 1.5px solid var(--border-strong, rgba(255,255,255,0.15));
    background: transparent; display: flex; align-items: center; justify-content: center;
    cursor: pointer; z-index: 2; transition: background 0.15s, border-color 0.15s;
    padding: 0; color: white;
  }
  .card-check--on { background: var(--accent-secondary, #4D7CFF); border-color: var(--accent-secondary, #4D7CFF); }
  .card-body {
    display: flex; flex-direction: column; gap: 10px;
    padding: 18px; padding-right: 44px; text-align: left;
    background: none; border: none; color: inherit; font-family: inherit; cursor: pointer; width: 100%;
  }
  .card-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .card-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .card-avatar {
    width: 42px; height: 42px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; color: white; flex-shrink: 0;
  }
  .card-name-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .card-name { font-size: 14px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-location { font-size: 11px; color: var(--text-muted); }
  .card-followers { font-size: 13px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
  .card-badges { display: flex; align-items: center; gap: 8px; }
  .card-score { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 8px; }
  .score--high { color: #6ee7b7; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.25); }
  .score--mid { color: #fcd34d; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.2); }
  .score--low { color: #a1a1aa; background: rgba(161, 161, 170, 0.1); border: 1px solid rgba(161, 161, 170, 0.15); }
  .card-strength { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.04em; }
  .card-rates { display: flex; flex-wrap: wrap; gap: 8px; }
  .rate-item { font-size: 11px; color: var(--text-secondary); padding: 2px 8px; border-radius: 6px; background: rgba(255,255,255,0.04); }
  .rate-item--na { color: var(--text-muted); font-style: italic; background: none; }
  .card-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .tag { font-size: 11px; background: var(--glass-medium, rgba(255,255,255,0.06)); border-radius: 6px; padding: 2px 8px; color: var(--text-muted); }
  .card-reason { font-size: 12px; color: var(--text-secondary); line-height: 1.45; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .card-expanded { padding: 0 18px 18px; display: flex; flex-direction: column; gap: 14px; border-top: 1px solid var(--border-subtle); padding-top: 14px; margin-top: 4px; }
  .breakdown-title { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 8px; }
  .breakdown-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .breakdown-label { font-size: 11px; color: var(--text-secondary); width: 72px; flex-shrink: 0; }
  .breakdown-bar-track { flex: 1; height: 5px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow: hidden; }
  .breakdown-bar-fill { height: 100%; border-radius: 3px; background: var(--accent-secondary, #4D7CFF); transition: width 0.5s cubic-bezier(0.32, 0.72, 0, 1); }
  .breakdown-val { font-size: 11px; color: var(--text-muted); width: 24px; text-align: right; }
  .brief-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; font-family: inherit; color: var(--accent-tertiary, #FFB84D); background: none; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 6px 12px; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
  .brief-btn:hover { border-color: var(--accent-tertiary, #FFB84D); background: rgba(255, 184, 77, 0.06); }
  .brief-btn:disabled { opacity: 0.5; cursor: default; }
  .brief-body { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
  .brief-body p { margin: 0; }
  .brief-label { font-weight: 600; color: var(--text-primary); }
</style>
