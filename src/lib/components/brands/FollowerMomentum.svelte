<script lang="ts">
  export let momentum: number = 0;
  export let avg7d: number = 0;
  export let avg28d: number = 0;
  export let trend: 'accelerating' | 'steady' | 'decelerating' = 'steady';

  $: hasData = momentum > 0 || avg7d !== 0 || avg28d !== 0;

  $: color = momentum > 1 ? '#4ade80' : momentum >= 0.8 ? '#E8833A' : '#f87171';

  // Ring arc: 0-0.5 = quarter, 0.5-1.0 = half, 1.0-1.5 = three-quarter, >1.5 = full
  $: fillFraction =
    momentum <= 0
      ? 0
      : momentum <= 0.5
        ? (momentum / 0.5) * 0.25
        : momentum <= 1.0
          ? 0.25 + ((momentum - 0.5) / 0.5) * 0.25
          : momentum <= 1.5
            ? 0.5 + ((momentum - 1.0) / 0.5) * 0.25
            : Math.min(0.75 + ((momentum - 1.5) / 0.5) * 0.25, 1.0);

  const CX = 80;
  const CY = 80;
  const R = 62;
  const STROKE = 7;

  $: arcAngle = fillFraction * 360;

  function describeArc(
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number,
  ): string {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  $: arcPath = arcAngle > 0.5 ? describeArc(CX, CY, R, 0, Math.min(arcAngle, 359.9)) : '';

  $: trendLabel =
    trend === 'accelerating'
      ? 'Accelerating'
      : trend === 'decelerating'
        ? 'Decelerating'
        : 'Steady';

  $: trendIcon = trend === 'accelerating' ? '↑' : trend === 'decelerating' ? '↓' : '→';

  function formatAvg(n: number): string {
    const sign = n >= 0 ? '+' : '';
    if (Math.abs(n) >= 1000) return sign + (n / 1000).toFixed(1) + 'K';
    return sign + n.toFixed(0);
  }
</script>

<div class="bs-card">
  <span class="card-label">MOMENTUM</span>

  {#if !hasData}
    <div class="empty">No momentum data yet</div>
  {:else}
    <div class="gauge-wrap">
      <svg viewBox="0 0 160 160" class="gauge-svg">
        <!-- Track ring -->
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          stroke-width={STROKE}
        />

        <!-- Filled arc -->
        {#if arcPath}
          <path
            d={arcPath}
            fill="none"
            stroke={color}
            stroke-width={STROKE}
            stroke-linecap="round"
          />
        {/if}

        <!-- Big number -->
        <text
          x={CX}
          y={CY - 6}
          text-anchor="middle"
          dominant-baseline="central"
          class="big-num"
          fill={color}
        >
          {momentum.toFixed(1)}
        </text>

        <!-- "x" label -->
        <text x={CX} y={CY + 16} text-anchor="middle" class="sub-label">momentum</text>
      </svg>
    </div>

    <div class="trend-row" style="color: {color};">
      <span class="trend-icon">{trendIcon}</span>
      <span class="trend-text">{trendLabel}</span>
    </div>

    <div class="avg-row">
      <span class="avg-item">7d avg: <strong>{formatAvg(avg7d)}/day</strong></span>
      <span class="avg-item">28d avg: <strong>{formatAvg(avg28d)}/day</strong></span>
    </div>
  {/if}
</div>

<style>
  .bs-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 18px 16px;
  }

  .card-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: #4a4a50;
    text-transform: uppercase;
  }

  .gauge-wrap {
    display: flex;
    justify-content: center;
    padding: 12px 0 4px;
  }

  .gauge-svg {
    width: 140px;
    height: 140px;
  }

  .big-num {
    font-family:
      'Inter',
      'Geist Variable',
      -apple-system,
      sans-serif;
    font-size: 32px;
    font-weight: 800;
  }

  .sub-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 8px;
    fill: #4a4a50;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .trend-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    margin-bottom: 10px;
  }

  .trend-icon {
    font-size: 14px;
  }

  .trend-text {
    font-family: 'PP Mori', sans-serif;
    font-size: 13px;
    font-weight: 500;
  }

  .avg-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .avg-item {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 11px;
    color: #4a4a50;
  }

  .avg-item strong {
    color: #ededef;
    font-weight: 500;
  }

  .empty {
    font-family: 'PP Mori', sans-serif;
    font-size: 13px;
    color: #4a4a50;
    text-align: center;
    padding: 40px 0;
  }
</style>
