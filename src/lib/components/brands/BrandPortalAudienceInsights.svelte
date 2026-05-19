<script lang="ts">
  import OsCard from '$lib/components/os/OsCard.svelte';
  import type { BrandOsDashboard } from '$lib/types/brand-os';

  export let audience: BrandOsDashboard['audienceInsights'];
</script>

<OsCard className="os-bento-span-8 brand-os-audience">
  <p class="brand-os-kicker">Audience Insights</p>
  <p class="brand-os-summary">{audience.summary}</p>

  <div class="brand-os-insights">
    {#each audience.keyInsights as item}
      <article>
        <h3>{item.title}</h3>
        <p class="value">{item.value}</p>
        <p class="rationale">{item.rationale}</p>
      </article>
    {/each}
  </div>

  {#if audience.personas.length}
    <div class="brand-os-personas">
      {#each audience.personas as persona}
        <article>
          <h4>{persona.name}</h4>
          <p>{persona.description}</p>
        </article>
      {/each}
    </div>
  {/if}
</OsCard>

<style>
  .brand-os-audience {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
  }
  .brand-os-kicker {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .brand-os-summary {
    margin: 0;
    color: var(--text-body);
    line-height: 1.6;
  }
  .brand-os-insights {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .brand-os-insights article,
  .brand-os-personas article {
    border: 1px solid var(--border-subtle-2);
    border-radius: 12px;
    padding: 12px;
    background: color-mix(in srgb, var(--surface-subtle) 75%, transparent);
  }
  h3,
  h4 {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .value {
    margin: 6px 0 2px;
    font-size: 15px;
    color: var(--text-strong);
  }
  .rationale,
  .brand-os-personas p {
    margin: 0;
    font-size: 12px;
    color: var(--text-body);
    line-height: 1.5;
  }
  .brand-os-personas {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  @media (max-width: 1024px) {
    .brand-os-insights,
    .brand-os-personas {
      grid-template-columns: 1fr;
    }
  }
</style>
