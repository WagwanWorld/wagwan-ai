<script lang="ts">
  export let score = 0;
  export let label = '';
  export let breakdown: { name: string; connected: boolean }[] = [];

  const size = 96;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
</script>

<div class="integrity-wrap">
  <div class="integrity-ring-area">
    <svg viewBox="0 0 {size} {size}" width="{size}" height="{size}">
      <defs>
        <linearGradient id="integrity-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF4D4D" />
          <stop offset="50%" stop-color="#4D7CFF" />
          <stop offset="100%" stop-color="#FFB84D" />
        </linearGradient>
      </defs>
      <circle cx="{size/2}" cy="{size/2}" r="{radius}" fill="none" stroke="var(--glass-medium)" stroke-width="{strokeWidth}" />
      <circle
        cx="{size/2}" cy="{size/2}" r="{radius}"
        fill="none"
        stroke="url(#integrity-grad)"
        stroke-width="{strokeWidth}"
        stroke-dasharray="{(score / 100) * circumference} {circumference}"
        stroke-linecap="round"
        transform="rotate(-90 {size/2} {size/2})"
        style="transition: stroke-dasharray 0.8s ease;"
      />
      <text x="{size/2}" y="{size/2 - 2}" text-anchor="middle" dominant-baseline="central"
        fill="var(--text-primary)" font-size="22" font-weight="800" font-family="var(--font-mono)">{score}</text>
      <text x="{size/2}" y="{size/2 + 14}" text-anchor="middle"
        fill="var(--text-muted)" font-size="9" font-weight="600" text-transform="uppercase" letter-spacing="0.08em"
        font-family="var(--font-sans)">PORTRAIT</text>
    </svg>
  </div>
  {#if label}
    <span class="integrity-label">{label}</span>
  {/if}
  {#if breakdown.length}
    <div class="integrity-pills">
      {#each breakdown as item}
        <span class="integrity-pill" class:connected={item.connected}>{item.name}</span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .integrity-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .integrity-ring-area { position: relative; }
  .integrity-label {
    font-size: 12px; font-weight: 600; color: var(--text-secondary);
    text-transform: capitalize;
  }
  .integrity-pills { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .integrity-pill {
    font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 100px;
    background: var(--glass-light); color: var(--text-muted);
    border: 1px solid var(--border-subtle);
  }
  .integrity-pill.connected {
    background: rgba(77, 124, 255, 0.12); color: #6B9AFF;
    border-color: rgba(77, 124, 255, 0.25);
  }
</style>
