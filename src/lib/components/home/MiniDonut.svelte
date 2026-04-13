<script lang="ts">
  export let segments: { label: string; value: number; color: string }[] = [];
  export let caption = '';

  const size = 120;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  $: total = segments.reduce((a, s) => a + s.value, 0) || 1;
  $: arcs = (() => {
    let offset = 0;
    return segments.map(s => {
      const pct = s.value / total;
      const dash = pct * circumference;
      const gap = circumference - dash;
      const rotate = offset * 360 - 90;
      offset += pct;
      return { ...s, dash, gap, rotate, pct };
    });
  })();
</script>

<div class="donut-wrap">
  <svg viewBox="0 0 {size} {size}" width="{size}" height="{size}" class="donut-svg">
    <circle cx="{size/2}" cy="{size/2}" r="{radius}" fill="none" stroke="var(--glass-medium)" stroke-width="{strokeWidth}" />
    {#each arcs as arc}
      <circle
        cx="{size/2}" cy="{size/2}" r="{radius}"
        fill="none"
        stroke="{arc.color}"
        stroke-width="{strokeWidth}"
        stroke-dasharray="{arc.dash} {arc.gap}"
        stroke-linecap="round"
        transform="rotate({arc.rotate} {size/2} {size/2})"
        style="transition: stroke-dasharray 0.6s ease;"
      />
    {/each}
  </svg>
  <div class="donut-legend">
    {#each arcs as arc}
      <div class="donut-legend-item">
        <span class="donut-dot" style="background:{arc.color}"></span>
        <span class="donut-label">{arc.label}</span>
        <span class="donut-pct">{Math.round(arc.pct * 100)}%</span>
      </div>
    {/each}
  </div>
  {#if caption}
    <p class="donut-caption">{caption}</p>
  {/if}
</div>

<style>
  .donut-wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .donut-svg { display: block; }
  .donut-legend { display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .donut-legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; }
  .donut-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .donut-label { color: var(--text-secondary); flex: 1; }
  .donut-pct { color: var(--text-muted); font-family: var(--font-mono); font-size: 10px; }
  .donut-caption { font-size: 12px; color: var(--text-muted); text-align: center; margin: 0; line-height: 1.4; }
</style>
