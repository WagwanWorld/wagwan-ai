<script lang="ts">
  export let data: { day: number; block: number; intensity: number }[] = [];
  export let caption = '';

  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const blocks = ['AM', 'PM', 'Eve', 'Nite'];
  const cellSize = 18;
  const gap = 3;
  const labelW = 28;
  const labelH = 16;
  const w = labelW + days.length * (cellSize + gap);
  const h = labelH + blocks.length * (cellSize + gap);

  function getIntensity(day: number, block: number): number {
    return data.find(d => d.day === day && d.block === block)?.intensity ?? 0;
  }

  function cellColor(intensity: number): string {
    if (intensity < 0.15) return 'var(--glass-light)';
    if (intensity < 0.4) return 'rgba(77, 124, 255, 0.25)';
    if (intensity < 0.7) return 'rgba(77, 124, 255, 0.50)';
    return 'rgba(77, 124, 255, 0.80)';
  }
</script>

<div class="heatmap-wrap">
  <svg viewBox="0 0 {w} {h}" width="{w}" height="{h}">
    {#each days as day, di}
      <text x="{labelW + di * (cellSize + gap) + cellSize / 2}" y="10" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-mono)">{day}</text>
    {/each}
    {#each blocks as block, bi}
      <text x="0" y="{labelH + bi * (cellSize + gap) + cellSize / 2 + 3}" fill="var(--text-muted)" font-size="8" font-family="var(--font-mono)">{block}</text>
      {#each days as _, di}
        <rect
          x="{labelW + di * (cellSize + gap)}"
          y="{labelH + bi * (cellSize + gap)}"
          width="{cellSize}"
          height="{cellSize}"
          rx="4"
          fill="{cellColor(getIntensity(di, bi))}"
          style="transition: fill 0.4s ease;"
        />
      {/each}
    {/each}
  </svg>
  {#if caption}
    <p class="heatmap-caption">{caption}</p>
  {/if}
</div>

<style>
  .heatmap-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .heatmap-caption { font-size: 12px; color: var(--text-muted); text-align: center; margin: 0; line-height: 1.4; }
</style>
