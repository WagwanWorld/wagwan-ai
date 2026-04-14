<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let campaignId: string | number = '';
  export let brandName = '';
  export let title = '';
  export let creativeText = '';
  export let rewardInr = 0;
  export let matchReason = '';
  export let matchScore = 0;

  const dispatch = createEventDispatcher();

  function scoreColor(s: number): string {
    if (s >= 85) return '#4D7CFF';
    if (s >= 70) return '#FFB84D';
    return '#FF4D4D';
  }
</script>

<div class="offer-card">
  <div class="offer-top">
    <span class="offer-brand">{brandName}</span>
    <span class="offer-score" style="background:{scoreColor(matchScore)}20;color:{scoreColor(matchScore)};border-color:{scoreColor(matchScore)}40">
      {matchScore}% match
    </span>
  </div>
  <h4 class="offer-title">{title}</h4>
  <p class="offer-brief">{creativeText}</p>
  <div class="offer-reward">₹{rewardInr.toLocaleString()}</div>
  {#if matchReason}
    <p class="offer-reason">{matchReason}</p>
  {/if}
  <div class="offer-actions">
    <button class="offer-accept" on:click={() => dispatch('accept', { campaignId })}>Accept</button>
    <button class="offer-decline" on:click={() => dispatch('decline', { campaignId })}>Decline</button>
  </div>
</div>

<style>
  .offer-card {
    background: var(--glass-light); border: 1px solid var(--border-subtle);
    border-radius: 16px; padding: 20px;
    backdrop-filter: blur(var(--blur-medium)); -webkit-backdrop-filter: blur(var(--blur-medium));
    transition: transform 0.15s, border-color 0.15s;
  }
  .offer-card:hover { transform: translateY(-2px); border-color: rgba(77, 124, 255, 0.2); }
  .offer-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .offer-brand { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent-secondary, #4D7CFF); }
  .offer-score {
    font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 100px;
    border: 1px solid;
  }
  .offer-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px; }
  .offer-brief { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0 0 8px; }
  .offer-reward { font-size: 18px; font-weight: 800; color: var(--text-primary); font-family: var(--font-mono); margin-bottom: 8px; }
  .offer-reason { font-size: 11px; color: var(--text-muted); font-style: italic; margin: 0 0 12px; }
  .offer-actions { display: flex; gap: 10px; }
  .offer-accept {
    flex: 1; padding: 12px; border-radius: 100px; border: none;
    background: linear-gradient(135deg, #FF4D4D, #FFB84D);
    color: white; font-size: 14px; font-weight: 700; font-family: inherit;
    cursor: pointer; transition: transform 0.15s;
  }
  .offer-accept:active { transform: scale(0.97); }
  .offer-decline {
    padding: 12px 20px; border-radius: 100px;
    background: transparent; border: 1px solid var(--border-strong);
    color: var(--text-muted); font-size: 13px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: border-color 0.15s;
  }
  .offer-decline:hover { border-color: var(--text-secondary); }
</style>
