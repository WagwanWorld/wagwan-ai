<script lang="ts">
  export let type: 'reach' | 'engagement' | 'shares' | 'cadence' | 'growth' = 'reach';
  export let value: string | number = '';
  export let label: string = '';
  export let size: 'xl' | 'lg' | 'md' | 'sm' = 'md';
  export let suffix: string = '';
  export let delta: number | null = null;
  export let showLabel: boolean = true;

  const colorVar: Record<string, string> = {
    reach: 'var(--g-metric-reach)',
    engagement: 'var(--g-metric-engagement)',
    shares: 'var(--g-metric-shares)',
    cadence: 'var(--g-metric-cadence)',
    growth: 'var(--g-metric-growth)',
  };
  $: metricColor = colorVar[type] || 'var(--g-text)';
</script>

<div class="metric metric--{size}">
  <span class="metric-value" style="color: {metricColor}">
    {value}{#if suffix}<span class="metric-suffix">{suffix}</span>{/if}
  </span>
  {#if delta !== null}
    <span class="metric-delta" class:up={delta > 0} class:down={delta < 0}>
      {delta > 0 ? '+' : ''}{delta}%
    </span>
  {/if}
  {#if showLabel && label}
    <span class="metric-label">{label}</span>
  {/if}
</div>

<style>
  .metric {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .metric-value {
    font-weight: 300;
    letter-spacing: -0.04em;
    line-height: 1;
    transition: letter-spacing var(--g-dur, 0.7s) var(--g-ease);
  }
  .metric--xl .metric-value { font-size: var(--g-display-xl, 48px); }
  .metric--lg .metric-value { font-size: var(--g-display-lg, 32px); }
  .metric--md .metric-value { font-size: var(--g-display-md, 24px); }
  .metric--sm .metric-value { font-size: 18px; }
  .metric-suffix {
    font-size: 0.5em;
    opacity: 0.5;
    margin-left: 1px;
  }
  .metric-label {
    font-size: var(--g-label-size, 11px);
    font-weight: var(--g-label-weight, 500);
    letter-spacing: var(--g-label-spacing, 0.08em);
    text-transform: uppercase;
    color: var(--g-text-3, #4A4A50);
  }
  .metric-delta {
    font-size: 11px;
    font-weight: 500;
    font-family: var(--g-font-mono);
    letter-spacing: 0.02em;
  }
  .metric-delta.up { color: var(--g-metric-engagement); }
  .metric-delta.down { color: var(--g-accent); }
  .metric-delta:not(.up):not(.down) { color: var(--g-text-3); }
</style>
