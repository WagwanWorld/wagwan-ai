<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let proposals: Array<{
    id: string;
    type: 'content' | 'creator_match' | 'strategy';
    title: string;
    payload: Record<string, unknown>;
    reasoning: string;
    urgency: 'high' | 'medium' | 'low';
    created_at: string;
  }> = [];

  const dispatch = createEventDispatcher();

  function approve(id: string) {
    dispatch('action', { id, status: 'approved' });
  }

  function reject(id: string) {
    dispatch('action', { id, status: 'rejected' });
  }

  function typeLabel(type: 'content' | 'creator_match' | 'strategy'): string {
    if (type === 'content') return 'CONTENT';
    if (type === 'creator_match') return 'CREATOR';
    return 'STRATEGY';
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
    } catch {
      return iso;
    }
  }
</script>

<div class="proposals">
  <!-- Header -->
  <div class="proposals-header">
    <span class="label">Pending Moves</span>
    {#if proposals.length > 0}
      <span class="count">{proposals.length}</span>
    {/if}
  </div>

  <!-- Empty state -->
  {#if proposals.length === 0}
    <div class="empty">
      <p class="empty-text">No pending moves. Check back after the weekly analysis.</p>
    </div>

  {:else}
    <div class="proposals-list">
      {#each proposals as proposal, i}
        <article class="proposal-card" style="--i:{i}">
          <!-- Top row -->
          <div class="card-top">
            <span class="type-badge type--{proposal.type}">{typeLabel(proposal.type)}</span>
            <span class="urgency urgency--{proposal.urgency}">
              {proposal.urgency.toUpperCase()}
            </span>
            <span class="card-date">{formatDate(proposal.created_at)}</span>
          </div>

          <!-- Title -->
          <h3 class="card-title">{proposal.title}</h3>

          <!-- Content fields -->
          {#if proposal.type === 'content'}
            {#if proposal.payload.format}
              <span class="format-badge">{proposal.payload.format}</span>
            {/if}
            {#if proposal.payload.hook}
              <p class="card-hook">&ldquo;{proposal.payload.hook}&rdquo;</p>
            {/if}
            {#if proposal.payload.caption}
              <p class="card-caption">{proposal.payload.caption}</p>
            {/if}
          {/if}

          <!-- Strategy fields -->
          {#if proposal.type === 'strategy'}
            {#if proposal.payload.description}
              <p class="card-desc">{proposal.payload.description}</p>
            {/if}
          {/if}

          <!-- Reasoning -->
          {#if proposal.reasoning}
            <p class="card-reasoning">{proposal.reasoning}</p>
          {/if}

          <!-- Actions -->
          <div class="card-actions">
            <button class="btn btn--approve" on:click={() => approve(proposal.id)}>Approve</button>
            <button class="btn btn--reject" on:click={() => reject(proposal.id)}>Reject</button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .proposals {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Header */
  .proposals-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    margin-bottom: 0;
  }
  .label {
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-label-color);
  }
  .count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--g-font-mono, monospace);
    font-size: 10px;
    font-weight: 500;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 9px;
    background: rgba(255,255,255,0.04);
    color: var(--g-text-2);
    line-height: 1;
  }

  /* Empty */
  .empty {
    padding: 40px 0;
  }
  .empty-text {
    font-size: 13px;
    color: var(--g-text-4);
    margin: 0;
    line-height: 1.6;
  }

  /* List */
  .proposals-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Card */
  .proposal-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px 0;
    border-bottom: 1px solid rgba(255,255,255,0.025);
    opacity: 0;
    transform: translateY(10px);
    animation: reveal var(--g-dur-fast, 0.4s) var(--g-ease) forwards;
    animation-delay: calc(var(--i, 0) * 60ms);
  }
  @keyframes reveal {
    to { opacity: 1; transform: translateY(0); }
  }

  /* Top row */
  .card-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* Type badge */
  .type-badge {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 9px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.02);
    color: var(--g-text-4);
  }
  .type--content {
    color: rgba(251,113,133,0.78);
    border-color: rgba(251,113,133,0.1);
    background: rgba(244,63,94,0.04);
  }
  .type--creator_match {
    color: rgba(165,180,252,0.85);
    border-color: rgba(99,102,241,0.1);
    background: rgba(99,102,241,0.04);
  }
  .type--strategy {
    color: rgba(252,210,77,0.85);
    border-color: rgba(251,191,36,0.1);
    background: rgba(251,191,36,0.04);
  }

  /* Urgency */
  .urgency {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 9px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.02);
    color: var(--g-text-4);
  }
  .urgency--high {
    color: rgba(251,113,133,0.85);
    border-color: rgba(244,63,94,0.12);
    background: rgba(244,63,94,0.06);
  }
  .urgency--low {
    color: var(--g-text-ghost);
    border-color: rgba(255,255,255,0.02);
  }

  /* Date */
  .card-date {
    font-family: var(--g-font-mono, monospace);
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: var(--g-text-ghost);
    margin-left: auto;
  }

  /* Title */
  .card-title {
    font-size: 15px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: var(--g-text);
    margin: 0;
    line-height: 1.35;
  }

  /* Format badge */
  .format-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 9px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.02);
    color: var(--g-text-4);
  }

  /* Hook */
  .card-hook {
    font-size: 13px;
    font-style: italic;
    color: var(--g-text-3);
    margin: 0;
    line-height: 1.55;
  }

  /* Caption */
  .card-caption {
    font-size: 13px;
    color: var(--g-text-3);
    margin: 0;
    line-height: 1.55;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Description */
  .card-desc {
    font-size: 14px;
    color: var(--g-text-3);
    line-height: 1.7;
    margin: 0;
  }

  /* Reasoning */
  .card-reasoning {
    font-size: 11px;
    color: var(--g-text-ghost);
    margin: 0;
    line-height: 1.55;
  }

  /* Actions */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 4px;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    padding: 8px 18px;
    border-radius: 9px;
    cursor: pointer;
    transition: all var(--g-dur) var(--g-ease);
    line-height: 1;
  }
  .btn--approve {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.06);
    color: var(--g-text);
  }
  .btn--approve:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.1);
  }
  .btn--reject {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.04);
    color: var(--g-text-4);
  }
  .btn--reject:hover {
    border-color: rgba(255,255,255,0.08);
    color: var(--g-text-3);
  }

  @media (max-width: 480px) {
    .card-date { display: none; }
  }
</style>
