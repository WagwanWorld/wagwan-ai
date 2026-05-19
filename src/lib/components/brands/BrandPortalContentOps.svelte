<script lang="ts">
  import OsCard from '$lib/components/os/OsCard.svelte';
  import type { BrandOsDashboard } from '$lib/types/brand-os';

  export let contentOps: BrandOsDashboard['contentOps'];
</script>

<OsCard className="os-bento-span-6 brand-os-content">
  <p class="brand-os-kicker">Content Ops</p>
  <div class="stats">
    <span>Draft {contentOps.draft}</span>
    <span>Scheduled {contentOps.scheduled}</span>
    <span>Published {contentOps.published}</span>
    <span>Failed {contentOps.failed}</span>
  </div>
  <div class="list">
    {#if contentOps.latestPosts.length === 0}
      <p class="empty">No content items yet.</p>
    {:else}
      {#each contentOps.latestPosts as p}
        <article>
          <p class="cap">{p.caption || '(No caption)'}</p>
          <p class="meta">
            {p.mediaType} · {p.status}{#if p.scheduledAt}
              · {new Date(p.scheduledAt).toLocaleString()}{/if}
          </p>
        </article>
      {/each}
    {/if}
  </div>
</OsCard>

<style>
  .brand-os-content {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .brand-os-kicker {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .stats span {
    border: 1px solid var(--border-subtle-2);
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 11px;
    color: var(--text-body);
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
  }
  .cap {
    margin: 0;
    color: var(--text-strong);
    font-size: 13px;
    line-height: 1.5;
  }
  .meta,
  .empty {
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
