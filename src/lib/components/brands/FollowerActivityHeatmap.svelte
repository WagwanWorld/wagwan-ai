<script lang="ts">
  export let grid: Array<{ day: number; hour: number; value: number }> = [];
  export let recommendedWindows: Array<{
    day: number;
    hour: number;
    value: number;
    dayName: string;
  }> = [];
  export let loading: boolean = false;

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21];

  const cellW = 14;
  const cellH = 14;
  const cellGap = 2;
  const labelW = 30;
  const labelH = 16;
  const padTop = 4;

  $: svgW = labelW + 24 * (cellW + cellGap);
  $: svgH = padTop + 7 * (cellH + cellGap) + labelH;

  $: maxVal = Math.max(...grid.map((c) => c.value), 1);

  $: gridMap = (() => {
    const m = new Map<string, number>();
    for (const c of grid) {
      m.set(`${c.day}-${c.hour}`, c.value);
    }
    return m;
  })();

  $: recSet = new Set(recommendedWindows.map((w) => `${w.day}-${w.hour}`));

  $: bestTimesLabel = recommendedWindows
    .slice(0, 5)
    .map((w) => `${w.dayName} ${String(w.hour).padStart(2, '0')}:00`)
    .join(', ');

  function cellOpacity(val: number): number {
    if (maxVal === 0) return 0.05;
    const norm = val / maxVal;
    return 0.05 + norm * 0.95;
  }
</script>

<div class="bs-card">
  <span class="card-label">WHEN YOUR AUDIENCE IS ONLINE</span>

  {#if loading}
    <div class="empty">
      <div class="pulse-bar"></div>
      <div class="pulse-bar short"></div>
    </div>
  {:else if grid.length === 0}
    <div class="empty">
      <p class="empty-text">Activity data available after first weekly sync.</p>
    </div>
  {:else}
    <div class="heatmap-container">
      <svg viewBox="0 0 {svgW} {svgH}" class="heatmap-svg" preserveAspectRatio="xMinYMin meet">
        <!-- Day labels -->
        {#each dayLabels as label, d}
          <text
            x={labelW - 6}
            y={padTop + d * (cellH + cellGap) + cellH / 2 + 1}
            text-anchor="end"
            dominant-baseline="central"
            class="svg-day-label">{label}</text
          >
        {/each}

        <!-- Hour labels -->
        {#each hourLabels as h}
          <text
            x={labelW + h * (cellW + cellGap) + cellW / 2}
            y={padTop + 7 * (cellH + cellGap) + 10}
            text-anchor="middle"
            class="svg-hour-label">{h}</text
          >
        {/each}

        <!-- Cells -->
        {#each { length: 7 } as _, d}
          {#each { length: 24 } as _, h}
            {@const val = gridMap.get(`${d}-${h}`) ?? 0}
            {@const isRec = recSet.has(`${d}-${h}`)}
            <rect
              x={labelW + h * (cellW + cellGap)}
              y={padTop + d * (cellH + cellGap)}
              width={cellW}
              height={cellH}
              rx="3"
              ry="3"
              fill="#E8833A"
              opacity={cellOpacity(val)}
            />
            {#if isRec}
              <circle
                cx={labelW + h * (cellW + cellGap) + cellW / 2}
                cy={padTop + d * (cellH + cellGap) + cellH / 2}
                r="2.5"
                fill="#4ade80"
              />
            {/if}
          {/each}
        {/each}
      </svg>
    </div>

    {#if recommendedWindows.length > 0}
      <div class="best-times">
        <span class="best-label">Best times:</span>
        <span class="best-value">{bestTimesLabel}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .bs-card {
    position: relative;
    border-radius: 14px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.035);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .card-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  .empty {
    padding: 24px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .empty-text {
    font-family: 'PP Mori', sans-serif;
    font-size: 13px;
    color: #4a4a50;
    margin: 0;
    line-height: 1.6;
  }
  .pulse-bar {
    height: 10px;
    width: 60%;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    animation: pulse 1.5s ease-in-out infinite;
  }
  .pulse-bar.short {
    width: 35%;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }

  .heatmap-container {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .heatmap-svg {
    width: 100%;
    height: auto;
    display: block;
    min-width: 400px;
  }

  .svg-day-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 8px;
    fill: #4a4a50;
    font-weight: 500;
  }

  .svg-hour-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 7px;
    fill: rgba(74, 74, 80, 0.7);
    font-weight: 400;
  }

  .best-times {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }
  .best-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4ade80;
    flex-shrink: 0;
  }
  .best-value {
    font-family: 'PP Mori', sans-serif;
    font-size: 12px;
    color: rgba(237, 237, 239, 0.7);
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .heatmap-svg {
      min-width: 360px;
    }
  }
</style>
