<script lang="ts">
  import { onMount } from 'svelte';

  export let emoji = '';
  export let label = '';
  export let vertical = false;

  let sectionEl: HTMLElement;
  let visible = false;

  onMount(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { visible = true; observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(sectionEl);
    return () => observer.disconnect();
  });
</script>

<section class="narrative" class:visible bind:this={sectionEl}>
  <div class="narrative-header">
    {#if emoji}<span class="narrative-emoji">{emoji}</span>{/if}
    <span class="narrative-label">{label}</span>
  </div>
  <div class="narrative-body" class:narrative-body--vertical={vertical}>
    <slot />
  </div>
</section>

<style>
  .narrative {
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.5s var(--ease-entrance, ease), transform 0.5s var(--ease-entrance, ease);
    margin-bottom: 32px;
  }
  .narrative.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .narrative-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 24px;
    margin-bottom: 12px;
  }

  .narrative-emoji { font-size: 16px; }

  .narrative-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .narrative-body {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    padding: 0 24px;
    -ms-overflow-style: none;
  }
  .narrative-body::-webkit-scrollbar { display: none; }

  .narrative-body > :global(*) {
    scroll-snap-align: start;
    flex-shrink: 0;
    width: 280px;
  }

  .narrative-body--vertical {
    flex-direction: column;
    overflow-x: visible;
    scroll-snap-type: none;
    padding: 0 24px;
    gap: 16px;
  }
  .narrative-body--vertical > :global(*) {
    flex-shrink: unset;
    width: 100%;
  }
</style>
