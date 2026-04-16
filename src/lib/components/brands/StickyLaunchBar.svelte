<script lang="ts">
  export let selectedCount: number;
  export let totalCount: number;
  export let totalReach: number;
  export let estimatedCost: number | null;
  export let costBreakdown: { posts: number; stories: number; reels: number };
  export let disabled: boolean = false;

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ launch: void; startOver: void }>();

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  function formatINR(n: number): string {
    return '₹' + n.toLocaleString('en-IN');
  }

  $: breakdownText = [
    costBreakdown.posts > 0 ? `${costBreakdown.posts} posts` : '',
    costBreakdown.stories > 0 ? `${costBreakdown.stories} stories` : '',
    costBreakdown.reels > 0 ? `${costBreakdown.reels} reels` : '',
  ].filter(Boolean).join(' · ');
</script>

<div class="launch-bar">
  <div class="bar-inner">
    <div class="bar-left">
      <span class="bar-count">{selectedCount} of {totalCount}</span>
      <span class="bar-sep">·</span>
      <span class="bar-reach">~{formatNumber(totalReach)} reach</span>
    </div>
    <div class="bar-center">
      {#if estimatedCost != null && estimatedCost > 0}
        <span class="bar-cost">{formatINR(estimatedCost)}</span>
        {#if breakdownText}<span class="bar-breakdown">{breakdownText}</span>{/if}
      {:else}
        <span class="bar-cost bar-cost--muted">Cost TBD</span>
      {/if}
    </div>
    <div class="bar-right">
      <button type="button" class="bar-secondary" on:click={() => dispatch('startOver')}>Start over</button>
      <button type="button" class="bar-launch" disabled={disabled || selectedCount === 0} on:click={() => dispatch('launch')}>
        Launch Campaign
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  .launch-bar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
    background: rgba(10, 10, 12, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid var(--border-subtle); padding: 12px 24px;
    animation: bar-enter 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  }
  @keyframes bar-enter { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .bar-inner { max-width: 72rem; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .bar-left, .bar-center { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
  .bar-count { font-weight: 600; color: var(--text-primary); }
  .bar-sep { color: var(--text-muted); }
  .bar-reach { color: var(--text-muted); }
  .bar-cost { font-weight: 700; font-size: 15px; color: var(--text-primary); }
  .bar-cost--muted { color: var(--text-muted); font-weight: 500; }
  .bar-breakdown { font-size: 11px; color: var(--text-muted); }
  .bar-right { display: flex; align-items: center; gap: 10px; }
  .bar-secondary { background: none; border: 1px solid var(--border-subtle); color: var(--text-secondary); border-radius: 10px; padding: 8px 16px; font-size: 13px; font-family: inherit; cursor: pointer; transition: border-color 0.2s, color 0.2s; }
  .bar-secondary:hover { border-color: var(--text-muted); color: var(--text-primary); }
  .bar-launch { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, var(--accent-primary, #FF4D4D), var(--accent-tertiary, #FFB84D)); color: white; border: none; border-radius: 10px; padding: 10px 22px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; transition: opacity 0.2s, transform 0.2s; }
  .bar-launch:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
  .bar-launch:active:not(:disabled) { transform: scale(0.98); }
  .bar-launch:disabled { opacity: 0.35; cursor: default; }
  @media (max-width: 768px) {
    .bar-inner { flex-wrap: wrap; gap: 10px; }
    .bar-center { display: none; }
    .bar-right { width: 100%; }
    .bar-launch { flex: 1; justify-content: center; }
  }
</style>
