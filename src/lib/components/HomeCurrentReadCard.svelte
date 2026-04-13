<script lang="ts">
  /** 1–3 short lines */
  export let lines: string[] = [];
  /** 0–1 */
  export let confidence: number | null = null;

  $: pct = confidence != null ? Math.round(Math.min(1, Math.max(0, confidence)) * 100) : null;
  $: barWidth = pct != null ? `${pct}%` : '72%';
</script>

<section class="current-read">
  <div class="current-read__head">
    <h2 class="current-read__title">Current read</h2>
    <span class="current-read__evolving" title="Still refining">
      <span class="current-read__dot" aria-hidden="true"></span>
      Evolving
    </span>
  </div>
  <div class="current-read__body">
    {#each lines as line}
      {#if line?.trim()}
        <p class="current-read__line">{line.trim()}</p>
      {/if}
    {/each}
  </div>
  {#if pct != null}
    <div class="current-read__meter" aria-label="Confidence {pct} percent">
      <div class="current-read__meter-fill" style:width={barWidth}></div>
    </div>
  {/if}
</section>

<style>
  .current-read {
    border-radius: 18px;
    border: 1px solid var(--panel-border);
    background: var(--bg-elevated);
    padding: 18px 18px 16px;
    box-shadow: none;
  }

  .current-read__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .current-read__title {
    margin: 0;
    font-size: var(--home-font-section, 14px);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text-primary);
  }

  .current-read__evolving {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--home-font-meta, 11px);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .current-read__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-primary);
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent-primary) 45%, transparent);
  }

  @media (prefers-reduced-motion: no-preference) {
    .current-read__dot {
      animation: current-read-pulse 2.4s ease-in-out infinite;
    }
  }

  @keyframes current-read-pulse {
    0%,
    100% {
      opacity: 0.55;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.15);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .current-read__dot {
      animation: none;
    }
  }

  .current-read__body {
    margin-bottom: 14px;
  }

  .current-read__line {
    margin: 0 0 10px;
    font-size: var(--home-font-body, 13px);
    line-height: 1.65;
    color: var(--text-secondary);
  }

  .current-read__line:last-child {
    margin-bottom: 0;
  }

  .current-read__meter {
    height: 4px;
    border-radius: 99px;
    background: var(--panel-surface);
    overflow: hidden;
  }

  .current-read__meter-fill {
    height: 100%;
    border-radius: 99px;
    background: var(--home-accent-gradient, linear-gradient(90deg, #FF4D4D, #4D7CFF));
    transition: width 0.85s ease;
  }
</style>
