<script lang="ts">
  import OsCard from '$lib/components/os/OsCard.svelte';
  import type { BrandOsDashboard } from '$lib/types/brand-os';

  export let campaignOps: BrandOsDashboard['campaignOps'];
</script>

<OsCard className="os-bento-span-6 brand-os-campaigns">
  <div class="head">
    <p class="brand-os-kicker">Campaign Ops</p>
    <p class="count">{campaignOps.activeCount} active</p>
  </div>

  {#if campaignOps.campaigns.length === 0}
    <p class="empty">No campaigns yet.</p>
  {:else}
    <div class="list">
      {#each campaignOps.campaigns as c}
        <article>
          <div>
            <p class="title">{c.title}</p>
            <p class="meta">{new Date(c.createdAt).toLocaleDateString()} · INR {c.rewardInr}</p>
          </div>
          <p class={`status status-${c.status}`}>{c.status}</p>
        </article>
      {/each}
    </div>
  {/if}
</OsCard>

<style>
  .brand-os-campaigns {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand-os-kicker {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .count {
    margin: 0;
    color: var(--text-body);
    font-size: 12px;
  }
  .list {
    display: grid;
    gap: 8px;
    max-height: 320px;
    overflow: auto;
  }
  article {
    border: 1px solid var(--border-subtle-2);
    border-radius: 10px;
    padding: 10px;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .title {
    margin: 0;
    font-size: 13px;
    color: var(--text-strong);
  }
  .meta {
    margin: 2px 0 0;
    font-size: 11px;
    color: var(--text-muted);
  }
  .status {
    margin: 0;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-body);
  }
  .status-live,
  .status-active {
    color: oklch(78% 0.15 162);
  }
  .status-ended,
  .status-completed {
    color: var(--text-muted);
  }
  .empty {
    margin: 0;
    color: var(--text-body);
  }
</style>
