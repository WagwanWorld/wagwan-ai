<script lang="ts">
  import OsCard from '$lib/components/os/OsCard.svelte';

  export let title = '';
  export let items: string[] = [];
</script>

<OsCard className="brand-kit-section">
  <h3>{title}</h3>
  {#if items.length}
    <ul>
      {#each items as item}
        <li>{item}</li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No entries yet.</p>
  {/if}
</OsCard>

<style>
  .brand-kit-section {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }
  ul {
    margin: 0;
    padding-left: 16px;
    display: grid;
    gap: 6px;
    color: var(--text-body);
    font-size: 13px;
    line-height: 1.4;
  }
  .empty {
    margin: 0;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
