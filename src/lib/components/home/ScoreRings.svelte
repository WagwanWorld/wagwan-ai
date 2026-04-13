<script lang="ts">
  export let scores: { label: string; emoji: string; value: number; color: string }[] = [];

  const size = 64;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
</script>

<div class="rings-wrap">
  {#each scores as score}
    <div class="ring-item">
      <svg viewBox="0 0 {size} {size}" width="{size}" height="{size}">
        <circle cx="{size/2}" cy="{size/2}" r="{radius}" fill="none" stroke="var(--glass-medium)" stroke-width="{strokeWidth}" />
        <circle
          cx="{size/2}" cy="{size/2}" r="{radius}"
          fill="none"
          stroke="{score.color}"
          stroke-width="{strokeWidth}"
          stroke-dasharray="{(score.value / 100) * circumference} {circumference}"
          stroke-linecap="round"
          transform="rotate(-90 {size/2} {size/2})"
          style="transition: stroke-dasharray 0.8s ease;"
        />
        <text x="{size/2}" y="{size/2 + 1}" text-anchor="middle" dominant-baseline="central" fill="var(--text-primary)" font-size="16" font-weight="800" font-family="var(--font-mono)">{score.value}</text>
      </svg>
      <span class="ring-emoji">{score.emoji}</span>
      <span class="ring-label">{score.label}</span>
    </div>
  {/each}
</div>

<style>
  .rings-wrap { display: flex; justify-content: center; gap: 24px; }
  .ring-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .ring-emoji { font-size: 14px; }
  .ring-label { font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
</style>
