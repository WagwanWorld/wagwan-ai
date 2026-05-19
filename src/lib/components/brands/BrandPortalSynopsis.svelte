<script lang="ts">
  import OsCard from '$lib/components/os/OsCard.svelte';
  import OsButton from '$lib/components/os/OsButton.svelte';
  import type { BrandOsDashboard } from '$lib/types/brand-os';

  export let synopsis: BrandOsDashboard['synopsis'];
  export let syncing = false;
  export let onRegenerate: () => void;
</script>

<OsCard className="os-bento-span-4 brand-os-synopsis">
  <div class="head">
    <p class="brand-os-kicker">Synopsis</p>
    <OsButton className="small" on:click={onRegenerate} disabled={syncing}>Regenerate</OsButton>
  </div>
  <h3>{synopsis.headline}</h3>
  <p><strong>What happened:</strong> {synopsis.whatHappened}</p>
  <p><strong>Why:</strong> {synopsis.whyItHappened}</p>
  <div>
    <p class="next">What next</p>
    <ul>
      {#each synopsis.whatNext as item}
        <li>{item}</li>
      {/each}
    </ul>
  </div>
  <p class="confidence">{synopsis.confidenceLabel}</p>
</OsCard>

<style>
  .brand-os-synopsis {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .brand-os-kicker {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  p {
    margin: 0;
    color: var(--text-body);
    font-size: 13px;
    line-height: 1.5;
  }
  .next {
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  ul {
    margin: 0;
    padding-left: 16px;
    color: var(--text-body);
    display: grid;
    gap: 5px;
    font-size: 13px;
  }
  .confidence {
    color: var(--text-muted);
    font-size: 11px;
  }
  :global(.small) {
    min-height: 30px;
    padding: 0 10px;
    font-size: 11px;
  }
</style>
