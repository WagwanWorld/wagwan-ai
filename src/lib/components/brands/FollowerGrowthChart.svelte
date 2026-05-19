<script lang="ts">
  export let series: Array<{ date: string; followers: number; netNew: number }> = [];
  export let range: string = '30d';

  $: hasSeries = series && series.length > 0;

  $: minFollowers = hasSeries ? Math.min(...series.map((d) => d.followers)) : 0;
  $: maxFollowers = hasSeries ? Math.max(...series.map((d) => d.followers)) : 0;
  $: maxAbsNet = hasSeries ? Math.max(...series.map((d) => Math.abs(d.netNew)), 1) : 1;

  const W = 600;
  const H = 200;
  const PAD = { top: 10, right: 10, bottom: 30, left: 0 };
  const CHART_W = W - PAD.left - PAD.right;
  const CHART_H = H - PAD.top - PAD.bottom;

  $: yRange = maxFollowers - minFollowers || 1;

  $: points = series.map((d, i) => {
    const x = PAD.left + (series.length > 1 ? (i / (series.length - 1)) * CHART_W : CHART_W / 2);
    const y = PAD.top + CHART_H - ((d.followers - minFollowers) / yRange) * CHART_H;
    return { x, y, ...d };
  });

  $: linePath = points.length > 1 ? 'M ' + points.map((p) => `${p.x},${p.y}`).join(' L ') : '';

  $: areaPath =
    points.length > 1
      ? linePath +
        ` L ${points[points.length - 1].x},${PAD.top + CHART_H} L ${points[0].x},${PAD.top + CHART_H} Z`
      : '';

  $: barWidth = series.length > 1 ? Math.max(2, (CHART_W / series.length) * 0.6) : 20;
  $: barMidY = PAD.top + CHART_H;

  let hoverIndex: number | null = null;

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function formatNum(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  function onPointEnter(i: number) {
    hoverIndex = i;
  }

  function onPointLeave() {
    hoverIndex = null;
  }

  $: xLabels = series
    .map((d, i) => ({ i, label: formatDate(d.date), x: points[i]?.x ?? 0 }))
    .filter((_, i) => i % 5 === 0);
</script>

<div class="bs-card">
  <span class="card-label">FOLLOWER GROWTH</span>
  <span class="range-badge">{range}</span>

  {#if !hasSeries}
    <div class="empty">No growth data yet</div>
  {:else}
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" class="chart-svg">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#E8833A" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#E8833A" stop-opacity="0.03" />
        </linearGradient>
      </defs>

      <!-- Y-axis labels -->
      <text x="4" y={PAD.top + 4} class="axis-label" dominant-baseline="hanging"
        >{formatNum(maxFollowers)}</text
      >
      <text x="4" y={PAD.top + CHART_H - 2} class="axis-label" dominant-baseline="auto"
        >{formatNum(minFollowers)}</text
      >

      <!-- netNew bars -->
      {#each points as p, i}
        {@const barH = (Math.abs(p.netNew) / maxAbsNet) * (CHART_H * 0.35)}
        <rect
          x={p.x - barWidth / 2}
          y={p.netNew >= 0 ? barMidY - barH : barMidY}
          width={barWidth}
          height={barH}
          fill={p.netNew >= 0 ? '#4ade80' : '#f87171'}
          opacity="0.25"
          rx="1"
        />
      {/each}

      <!-- Area fill -->
      {#if areaPath}
        <path d={areaPath} fill="url(#lineGrad)" />
      {/if}

      <!-- Line -->
      {#if linePath}
        <path
          d={linePath}
          fill="none"
          stroke="#E8833A"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      {/if}

      <!-- Data points & hover targets -->
      {#each points as p, i}
        <circle cx={p.x} cy={p.y} r="3" fill="#E8833A" opacity={hoverIndex === i ? 1 : 0} />
        <rect
          x={p.x - CHART_W / series.length / 2}
          y={PAD.top}
          width={CHART_W / series.length}
          height={CHART_H}
          fill="transparent"
          on:mouseenter={() => onPointEnter(i)}
          on:mouseleave={onPointLeave}
        />
      {/each}

      <!-- X-axis labels -->
      {#each xLabels as xl}
        <text x={xl.x} y={H - 6} class="axis-label" text-anchor="middle">{xl.label}</text>
      {/each}

      <!-- Tooltip -->
      {#if hoverIndex !== null}
        {@const tp = points[hoverIndex]}
        {@const tooltipW = 120}
        {@const tooltipH = 52}
        {@const tx = Math.min(Math.max(tp.x - tooltipW / 2, 2), W - tooltipW - 2)}
        {@const ty = Math.max(tp.y - tooltipH - 10, 2)}
        <rect
          x={tx}
          y={ty}
          width={tooltipW}
          height={tooltipH}
          rx="6"
          fill="#1a1a2e"
          stroke="rgba(255,255,255,0.12)"
          stroke-width="1"
        />
        <text x={tx + 8} y={ty + 16} class="tt-label">{formatDate(tp.date)}</text>
        <text x={tx + 8} y={ty + 31} class="tt-value">{formatNum(tp.followers)} followers</text>
        <text x={tx + 8} y={ty + 44} class="tt-net" fill={tp.netNew >= 0 ? '#4ade80' : '#f87171'}
          >{tp.netNew >= 0 ? '+' : ''}{formatNum(tp.netNew)} net new</text
        >
      {/if}
    </svg>
  {/if}
</div>

<style>
  .bs-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 18px 16px;
    position: relative;
  }

  .card-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: #4a4a50;
    text-transform: uppercase;
  }

  .range-badge {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 10px;
    color: #e8833a;
    margin-left: 8px;
    padding: 2px 6px;
    border: 1px solid rgba(232, 131, 58, 0.25);
    border-radius: 4px;
  }

  .chart-svg {
    width: 100%;
    height: auto;
    display: block;
    margin-top: 12px;
  }

  .axis-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 9px;
    fill: #4a4a50;
  }

  .tt-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 9px;
    fill: #4a4a50;
  }

  .tt-value {
    font-family:
      'Inter',
      'Geist Variable',
      -apple-system,
      sans-serif;
    font-size: 10px;
    font-weight: 800;
    fill: #ededef;
  }

  .tt-net {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 9px;
  }

  .empty {
    font-family: 'PP Mori', sans-serif;
    font-size: 13px;
    color: #4a4a50;
    text-align: center;
    padding: 40px 0;
  }
</style>
