<script lang="ts">
  export let heatmap: Array<{ day: number; hour: number; avg: number }> = [];
  export let bestHours: Array<{ hour: number; avgEng: number }> = [];
  export let bestDays: Array<{ day: string; avgEng: number }> = [];

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const lookup: Record<string, number> = {};
  let maxAvg = 1;
  for (const h of heatmap) {
    const key = `${h.day}-${h.hour}`;
    lookup[key] = h.avg;
    if (h.avg > maxAvg) maxAvg = h.avg;
  }

  function cellOpacity(day: number, hour: number): number {
    const val = lookup[`${day}-${hour}`] || 0;
    return val / maxAvg;
  }

  function formatHour(h: number): string {
    if (h === 0) return '12a';
    if (h < 12) return `${h}a`;
    if (h === 12) return '12p';
    return `${h - 12}p`;
  }

  const bestSlots = [...heatmap]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map(s => `${dayLabels[s.day]} ${formatHour(s.hour)}`);
</script>

<div class="heatmap">
  <p class="heatmap-sub">Darker cells = higher engagement across your last 25 posts.</p>

  {#if heatmap.length > 0}
    <div class="heatmap-grid">
      <div class="heatmap-corner"></div>
      {#each hours as h}
        {#if h % 3 === 0}
          <span class="hour-label">{formatHour(h)}</span>
        {:else}
          <span class="hour-label hour-label--minor"></span>
        {/if}
      {/each}

      {#each dayLabels as dayLabel, dayIdx}
        <span class="day-label">{dayLabel}</span>
        {#each hours as hour}
          {@const opacity = cellOpacity(dayIdx, hour)}
          <div
            class="heatmap-cell"
            style="--opacity: {opacity}"
            title="{dayLabel} {formatHour(hour)}: avg {lookup[`${dayIdx}-${hour}`] || 0} engagement"
          ></div>
        {/each}
      {/each}
    </div>

    <div class="timing-row">
      <div class="timing-card">
        <span class="label">Peak Slots</span>
        <span class="timing-val">{bestSlots.join(', ')}</span>
      </div>
      {#if bestDays.length > 0}
        <div class="timing-card">
          <span class="label">Best Day</span>
          <span class="timing-val">{bestDays[0].day}</span>
        </div>
      {/if}
      {#if bestHours.length > 0}
        <div class="timing-card">
          <span class="label">Best Hour</span>
          <span class="timing-val">{formatHour(bestHours[0].hour)}</span>
        </div>
      {/if}
    </div>
  {:else}
    <p class="no-data">Not enough posting data yet. Post at least 5 times to see patterns.</p>
  {/if}
</div>

<style>
  .heatmap {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .heatmap-sub {
    font-size: 12px;
    color: var(--g-text-4);
    margin: 0;
    line-height: 1.5;
  }

  /* Label */
  .label {
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-label-color);
  }

  /* Grid */
  .heatmap-grid {
    display: grid;
    grid-template-columns: 36px repeat(24, 1fr);
    gap: 2px;
    overflow-x: auto;
  }
  .heatmap-corner { width: 36px; }
  .hour-label {
    font-family: var(--g-font-mono, monospace);
    font-size: 8px;
    color: var(--g-text-ghost);
    text-align: center;
    padding-bottom: 3px;
  }
  .hour-label--minor { visibility: hidden; }
  .day-label {
    font-family: var(--g-font-mono, monospace);
    font-size: 9px;
    font-weight: 500;
    color: var(--g-text-3);
    display: flex;
    align-items: center;
    padding-right: 4px;
  }
  .heatmap-cell {
    aspect-ratio: 1;
    background: rgba(244,63,94, calc(var(--opacity, 0) * 0.55 + 0.02));
    border-radius: 3px;
    min-width: 10px;
    transition: background var(--g-dur) var(--g-ease);
  }
  .heatmap-cell:hover {
    outline: 1px solid rgba(255,255,255,0.15);
    outline-offset: 1px;
  }

  /* Timing insights */
  .timing-row {
    display: flex;
    gap: 0;
    border-top: 1px solid rgba(255,255,255,0.03);
    padding-top: 14px;
  }
  .timing-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 20px;
    border-right: 1px solid rgba(255,255,255,0.03);
  }
  .timing-card:first-child { padding-left: 0; }
  .timing-card:last-child { border-right: none; }
  .timing-val {
    font-size: 13px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: var(--g-text);
  }

  .no-data {
    font-size: 13px;
    color: var(--g-text-4);
    margin: 0;
  }

  @media (max-width: 600px) {
    .timing-row { flex-direction: column; gap: 12px; }
    .timing-card {
      padding: 8px 0;
      border-right: none;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }
    .timing-card:last-child { border-bottom: none; }
  }
</style>
