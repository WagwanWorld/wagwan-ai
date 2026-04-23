<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import OsCard from '$lib/components/os/OsCard.svelte';
  import OsPill from '$lib/components/os/OsPill.svelte';
  import OsButton from '$lib/components/os/OsButton.svelte';

  export let campaignId: string = '';
  export let brandName = '';
  export let title = '';
  export let creativeText = '';
  export let rewardInr = 0;
  export let matchReason = '';
  export let matchScore = 0;
  export let briefStatus: 'sent' | 'accepted' | 'live' | 'completed' | 'declined' = 'sent';
  export let igPostUrl: string | null = null;

  const dispatch = createEventDispatcher();

  function scoreColor(s: number): string {
    if (s >= 85) return '#4D7CFF';
    if (s >= 70) return '#FFB84D';
    return '#FF4D4D';
  }

  const statusLabel: Record<typeof briefStatus, string> = {
    sent: 'New request',
    accepted: 'Accepted',
    live: 'Live',
    completed: 'Completed',
    declined: 'Declined',
  };
</script>

<OsCard interactive={true} className="offer-card">
  <div class="offer-top">
    <span class="offer-brand">{brandName}</span>
    <span
      class="offer-score"
      style="background:{scoreColor(matchScore)}20;color:{scoreColor(
        matchScore,
      )};border-color:{scoreColor(matchScore)}40"
    >
      {matchScore}% match
    </span>
  </div>
  <h4 class="offer-title">{title}</h4>
  <p class="offer-brief">{creativeText}</p>
  <div class="offer-reward">₹{rewardInr.toLocaleString()}</div>
  {#if matchReason}
    <p class="offer-reason">{matchReason}</p>
  {/if}

  <OsPill className="offer-state offer-state--{briefStatus}">
    <span class="offer-state-dot"></span>
    <span>{statusLabel[briefStatus]}</span>
  </OsPill>

  {#if briefStatus === 'sent'}
    <div class="offer-actions">
      <OsButton
        className="offer-accept"
        variant="primary"
        on:click={() => dispatch('accept', { campaignId })}>Accept</OsButton
      >
      <OsButton
        className="offer-decline"
        variant="secondary"
        on:click={() => dispatch('decline', { campaignId })}>Decline</OsButton
      >
    </div>
  {:else if briefStatus === 'accepted'}
    <p class="offer-waiting">Waiting for the brand to go live. We'll notify you once they do.</p>
  {:else if briefStatus === 'live'}
    <div class="offer-actions">
      <OsButton
        className="offer-complete"
        variant="primary"
        on:click={() => dispatch('complete', { campaignId })}>Mark as posted</OsButton
      >
    </div>
  {:else if briefStatus === 'completed'}
    <div class="offer-completed">
      <span>Submitted for payout</span>
      {#if igPostUrl}
        <a href={igPostUrl} target="_blank" rel="noreferrer">View post</a>
      {/if}
    </div>
  {/if}
</OsCard>

<style>
  .offer-card {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 20px;
    backdrop-filter: blur(var(--blur-medium));
    -webkit-backdrop-filter: blur(var(--blur-medium));
    transition:
      transform 0.15s,
      border-color 0.15s;
  }
  .offer-card:hover {
    transform: translateY(-2px);
    border-color: rgba(77, 124, 255, 0.2);
  }
  .offer-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .offer-brand {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent-secondary, #4d7cff);
  }
  .offer-score {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 100px;
    border: 1px solid;
  }
  .offer-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 6px;
  }
  .offer-brief {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0 0 8px;
  }
  .offer-reward {
    font-size: 18px;
    font-weight: 800;
    color: var(--text-primary);
    font-family: var(--font-mono);
    margin-bottom: 8px;
  }
  .offer-reason {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    margin: 0 0 12px;
  }
  .offer-state {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 10px;
  }
  .offer-state-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
  .offer-state--sent {
    color: #ffb84d;
  }
  .offer-state--accepted {
    color: #4d7cff;
  }
  .offer-state--live {
    color: #4dff99;
  }
  .offer-state--completed {
    color: #c1a0e8;
  }
  .offer-state--declined {
    color: var(--text-muted);
  }
  .offer-actions {
    display: flex;
    gap: 10px;
  }
  .offer-accept {
    flex: 1;
    padding: 12px;
    border-radius: 100px;
    border: none;
    background: linear-gradient(135deg, #ff4d4d, #ffb84d);
    color: white;
    font-size: 14px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: transform 0.15s;
  }
  .offer-accept:active {
    transform: scale(0.97);
  }
  .offer-decline {
    padding: 12px 20px;
    border-radius: 100px;
    background: transparent;
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .offer-decline:hover {
    border-color: var(--text-secondary);
  }
  .offer-complete {
    flex: 1;
    padding: 12px;
    border-radius: 100px;
    border: 1px solid rgba(77, 255, 153, 0.4);
    background: rgba(77, 255, 153, 0.08);
    color: #4dff99;
    font-size: 13px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
  }
  .offer-complete:hover {
    background: rgba(77, 255, 153, 0.14);
  }
  .offer-waiting {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0;
    font-style: italic;
  }
  .offer-completed {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--text-muted);
    gap: 10px;
  }
  .offer-completed a {
    color: #4d7cff;
    text-decoration: underline;
  }
</style>
