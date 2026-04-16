<script lang="ts">
  export let creatorCount: number;
  export let selectedCount: number;
  export let totalReach: number;
  export let estimatedCost: number | null;
  export let avgMatchScore: number;
  export let keyTraits: { tag: string; count: number }[];
  export let pctHighStrength: number;

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  function formatINR(n: number): string {
    if (n === 0) return 'Free';
    return '₹' + n.toLocaleString('en-IN');
  }

  $: matchColor = avgMatchScore >= 75 ? 'text-emerald-400' : avgMatchScore >= 50 ? 'text-amber-300' : 'text-zinc-400';
  $: strengthColor = pctHighStrength >= 60 ? 'bg-emerald-500/30' : pctHighStrength >= 30 ? 'bg-amber-500/30' : 'bg-zinc-500/30';
</script>

<div class="summary-grid">
  <div class="summary-card">
    <span class="summary-value">{creatorCount}</span>
    <span class="summary-label">Matched Creators</span>
  </div>
  <div class="summary-card">
    <span class="summary-value">{formatNumber(totalReach)}</span>
    <span class="summary-label">Est. Reach ({selectedCount} selected)</span>
  </div>
  <div class="summary-card">
    <span class="summary-value">
      {#if estimatedCost != null}{formatINR(estimatedCost)}{:else}<span class="text-muted">Set rates</span>{/if}
    </span>
    <span class="summary-label">Campaign Cost</span>
  </div>
  <div class="summary-card">
    <span class="summary-value {matchColor}">{Math.round(avgMatchScore)}%</span>
    <span class="summary-label">Avg Match</span>
  </div>
  <div class="summary-card summary-card--wide">
    <div class="trait-pills">
      {#each keyTraits.slice(0, 5) as t}
        <span class="trait-pill">{t.tag}</span>
      {/each}
    </div>
    <span class="summary-label">Top Signals</span>
  </div>
  <div class="summary-card">
    <div class="strength-row">
      <span class="summary-value">{Math.round(pctHighStrength)}%</span>
      <div class="strength-bar-track">
        <div class="strength-bar-fill {strengthColor}" style="width:{Math.min(100, pctHighStrength)}%"></div>
      </div>
    </div>
    <span class="summary-label">Strong Profiles</span>
  </div>
</div>

<style>
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  @media (max-width: 768px) {
    .summary-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 480px) {
    .summary-grid { grid-template-columns: 1fr; }
  }
  .summary-card {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    transition: border-color 0.3s;
  }
  .summary-card:hover {
    border-color: rgba(77, 124, 255, 0.2);
  }
  .summary-card--wide {
    grid-column: span 2;
  }
  @media (max-width: 480px) {
    .summary-card--wide { grid-column: span 1; }
  }
  .summary-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.03em;
  }
  .summary-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .trait-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .trait-pill {
    font-size: 11px;
    background: var(--glass-medium, rgba(255,255,255,0.06));
    border: 1px solid var(--border-subtle);
    border-radius: 9999px;
    padding: 3px 10px;
    color: var(--text-secondary);
  }
  .strength-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .strength-bar-track {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.06);
    overflow: hidden;
  }
  .strength-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .text-muted { color: var(--text-muted); font-size: 14px; }
</style>
