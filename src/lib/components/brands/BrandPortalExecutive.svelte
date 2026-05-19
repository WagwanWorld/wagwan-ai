<script lang="ts">
  import OsCard from '$lib/components/os/OsCard.svelte';
  import OsPill from '$lib/components/os/OsPill.svelte';
  import type { BrandOsDashboard } from '$lib/types/brand-os';

  export let executive: BrandOsDashboard['executive'];
</script>

<OsCard raised className="os-bento-span-12 brand-os-exec">
  <header class="brand-os-exec__header">
    <div>
      <p class="brand-os-kicker">Brand OS</p>
      <h1>{executive.brandName}</h1>
      <p class="brand-os-sub">{executive.handle}</p>
    </div>
    <OsPill accent
      >Updated {executive.lastUpdated
        ? new Date(executive.lastUpdated).toLocaleDateString()
        : 'now'}</OsPill
    >
  </header>

  <div class="brand-os-exec__metrics">
    {#each executive.metrics as metric}
      <article class="brand-os-metric">
        <p class="brand-os-metric__label">{metric.label}</p>
        <p class="brand-os-metric__value">{metric.value}</p>
        {#if metric.delta}
          <p
            class={`brand-os-metric__delta ${metric.trend === 'up' ? 'up' : metric.trend === 'down' ? 'down' : 'flat'}`}
          >
            {metric.delta}
          </p>
        {:else if metric.note}
          <p class="brand-os-metric__note">{metric.note}</p>
        {/if}
      </article>
    {/each}
  </div>
</OsCard>

<style>
  .brand-os-exec {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
  }
  .brand-os-kicker {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  h1 {
    margin: 4px 0;
    font-size: clamp(1.4rem, 3vw, 2rem);
  }
  .brand-os-sub {
    margin: 0;
    color: var(--text-body);
  }
  .brand-os-exec__header {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
  }
  .brand-os-exec__metrics {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 10px;
  }
  .brand-os-metric {
    border: 1px solid var(--border-subtle-2);
    border-radius: 12px;
    padding: 12px;
    background: color-mix(in srgb, var(--surface-subtle) 75%, transparent);
  }
  .brand-os-metric__label {
    margin: 0;
    font-size: 11px;
    color: var(--text-muted);
  }
  .brand-os-metric__value {
    margin: 6px 0 2px;
    font-size: 1.1rem;
    font-weight: 600;
  }
  .brand-os-metric__delta,
  .brand-os-metric__note {
    margin: 0;
    font-size: 11px;
  }
  .brand-os-metric__delta.up {
    color: oklch(78% 0.15 162);
  }
  .brand-os-metric__delta.down {
    color: oklch(70% 0.2 26);
  }
  .brand-os-metric__delta.flat,
  .brand-os-metric__note {
    color: var(--text-body);
  }
  @media (max-width: 1024px) {
    .brand-os-exec__metrics {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (max-width: 640px) {
    .brand-os-exec__metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
