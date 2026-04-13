<script lang="ts">
  export let bars: { label: string; emoji: string; value: number; color: string }[] = [];
  export let caption = '';

  $: maxVal = Math.max(...bars.map(b => b.value), 1);
</script>

<div class="bars-wrap">
  {#each bars as bar}
    <div class="bar-row">
      <span class="bar-emoji">{bar.emoji}</span>
      <div class="bar-info">
        <div class="bar-label-row">
          <span class="bar-label">{bar.label}</span>
          <span class="bar-value">{bar.value}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:{(bar.value / maxVal) * 100}%;background:{bar.color};"></div>
        </div>
      </div>
    </div>
  {/each}
  {#if caption}
    <p class="bars-caption">{caption}</p>
  {/if}
</div>

<style>
  .bars-wrap { display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .bar-row { display: flex; align-items: center; gap: 10px; }
  .bar-emoji { font-size: 18px; flex-shrink: 0; width: 24px; text-align: center; }
  .bar-info { flex: 1; min-width: 0; }
  .bar-label-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
  .bar-label { font-size: 12px; color: var(--text-secondary); }
  .bar-value { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }
  .bar-track { height: 6px; border-radius: 3px; background: var(--glass-medium); overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
  .bars-caption { font-size: 12px; color: var(--text-muted); text-align: center; margin: 4px 0 0; line-height: 1.4; }
</style>
