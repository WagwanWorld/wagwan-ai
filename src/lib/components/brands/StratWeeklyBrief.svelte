<script lang="ts">
  export let brief: {
    headline: string;
    brief_date: string;
    sections: {
      whats_working: string;
      whats_not: string;
      audience_shift: string;
      competitor_moves: string;
      recommended_moves: string;
    };
    key_metrics: Array<{
      metric: string;
      current: number;
      previous: number;
      deltaPct: number;
      trend: 'up' | 'down' | 'stable';
    }>;
  } | null = null;

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d
        .toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        .toUpperCase()
        .replace(',', '');
    } catch {
      return dateStr.toUpperCase();
    }
  }

  function formatDelta(pct: number): string {
    if (pct === 0) return '0%';
    return (pct > 0 ? '+' : '') + pct.toFixed(1) + '%';
  }
</script>

<div class="brief">
  {#if !brief}
    <div class="empty">
      <span class="empty-dash">--</span>
      <p class="empty-text">No weekly brief yet. Run your first analysis to generate one.</p>
    </div>
  {:else}
    <!-- Header -->
    <div class="brief-header">
      <div class="brief-meta">
        <span class="label">Weekly Brief</span>
        <span class="brief-date">{formatDate(brief.brief_date)}</span>
      </div>
      <h2 class="brief-headline">{brief.headline}</h2>
    </div>

    <div class="divider"></div>

    <!-- Main grid -->
    <div class="brief-grid">
      <!-- Left: sections -->
      <div class="brief-sections">
        <div class="section-block">
          <div class="section-label-row">
            <span class="dot dot-green"></span>
            <span class="label">What's Working</span>
          </div>
          <p class="body">{brief.sections.whats_working}</p>
        </div>

        <div class="divider"></div>

        <div class="section-block">
          <div class="section-label-row">
            <span class="dot dot-red"></span>
            <span class="label">What's Not</span>
          </div>
          <p class="body">{brief.sections.whats_not}</p>
        </div>

        <div class="divider"></div>

        <div class="section-block">
          <div class="section-label-row">
            <span class="dot dot-accent"></span>
            <span class="label">Recommended Moves</span>
          </div>
          <p class="body body--accent">{brief.sections.recommended_moves}</p>
        </div>
      </div>

      <!-- Right: key metrics -->
      <div class="metrics-col">
        <span class="label brief-metrics-label">Key Metrics</span>
        <div class="metrics-list">
          {#each brief.key_metrics as km}
            <div class="metric-row">
              <div class="metric-info">
                <span class="metric-name">{km.metric}</span>
                <span class="metric-val">{km.current.toLocaleString()}</span>
              </div>
              <span
                class="delta"
                class:delta-up={km.trend === 'up'}
                class:delta-down={km.trend === 'down'}
                class:delta-stable={km.trend === 'stable'}>{formatDelta(km.deltaPct)}</span
              >
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Footer notes -->
    <div class="divider"></div>
    <div class="brief-footer">
      <div class="footer-block">
        <span class="label">Audience Shift</span>
        <p class="footer-body">{brief.sections.audience_shift}</p>
      </div>
      <div class="footer-sep"></div>
      <div class="footer-block">
        <span class="label">Competitor Moves</span>
        <p class="footer-body">{brief.sections.competitor_moves}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .brief {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Empty */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 48px 24px;
    border: 1px dashed var(--border-subtle-2);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--surface-subtle) 62%, transparent);
    text-align: center;
  }
  .empty-dash {
    font-size: 1.5rem;
    font-weight: 300;
    color: var(--text-muted);
  }
  .empty-text {
    font-size: 13px;
    color: var(--text-body);
    margin: 0;
    max-width: 280px;
    line-height: 1.6;
  }

  /* Header */
  .brief-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }
  .brief-meta {
    display: flex;
    align-items: baseline;
    gap: 16px;
  }
  .brief-date {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .brief-headline {
    font-size: 18px;
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 1.35;
    color: var(--text-strong);
    margin: 0;
  }

  /* Shared label */
  .label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .brief-metrics-label {
    display: block;
    margin-bottom: 12px;
  }

  /* Divider */
  .divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-subtle-2), transparent);
  }

  /* Grid */
  .brief-grid {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 0;
    padding: 4px 0;
  }

  /* Left sections */
  .brief-sections {
    display: flex;
    flex-direction: column;
    gap: 0;
    border-right: 1px solid var(--border-subtle-2);
    padding-right: 24px;
    padding-bottom: 20px;
  }
  .section-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 0;
  }
  .section-label-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-green {
    background: color-mix(in srgb, oklch(78% 0.15 162) 72%, transparent);
  }
  .dot-red {
    background: color-mix(in srgb, oklch(70% 0.22 25) 72%, transparent);
  }
  .dot-accent {
    background: color-mix(in srgb, var(--accent-main) 70%, transparent);
  }

  .body {
    font-size: 14px;
    color: var(--text-body);
    line-height: 1.7;
    margin: 0;
  }
  .body--accent {
    color: var(--text-strong);
    font-weight: 500;
  }

  /* Right metrics */
  .metrics-col {
    padding: 14px 0 20px 24px;
    display: flex;
    flex-direction: column;
  }
  .metrics-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .metric-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-subtle-2);
  }
  .metric-row:last-child {
    border-bottom: none;
  }
  .metric-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .metric-name {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.3;
  }
  .metric-val {
    font-size: 15px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: var(--text-strong);
    line-height: 1.2;
  }
  .delta {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 9px;
    flex-shrink: 0;
    letter-spacing: 0.01em;
  }
  .delta-up {
    background: color-mix(in srgb, oklch(78% 0.15 162) 14%, transparent);
    color: oklch(79% 0.14 162);
  }
  .delta-down {
    background: color-mix(in srgb, oklch(68% 0.21 26) 14%, transparent);
    color: oklch(70% 0.2 26);
  }
  .delta-stable {
    background: color-mix(in srgb, var(--surface-subtle) 88%, transparent);
    color: var(--text-muted);
  }

  /* Footer */
  .brief-footer {
    display: flex;
    gap: 0;
    padding: 18px 0 0;
  }
  .footer-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 20px 0 0;
  }
  .footer-block:last-child {
    padding: 0 0 0 20px;
  }
  .footer-sep {
    width: 1px;
    background: var(--border-subtle-2);
    flex-shrink: 0;
  }
  .footer-body {
    font-size: 12px;
    line-height: 1.65;
    color: var(--text-body);
    margin: 0;
  }

  /* Mobile */
  @media (max-width: 640px) {
    .brief-grid {
      grid-template-columns: 1fr;
    }
    .brief-sections {
      border-right: none;
      padding-right: 0;
      border-bottom: 1px solid var(--border-subtle-2);
    }
    .metrics-col {
      padding: 14px 0 20px;
    }
    .brief-footer {
      flex-direction: column;
      gap: 18px;
    }
    .footer-block,
    .footer-block:last-child {
      padding: 0;
    }
    .footer-sep {
      width: 100%;
      height: 1px;
    }
  }
</style>
