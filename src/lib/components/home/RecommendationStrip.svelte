<script lang="ts">
  import { onMount } from 'svelte';

  export let title = '';
  export let emoji = '';
  export let variant: 'tall' | 'square' | 'wide' = 'wide';
  export let items: Array<{
    image: string;
    title: string;
    subtitle: string;
    tag: string;
    matchReason: string;
    ctaLabel: string;
    ctaUrl: string;
  }> = [];

  let visible = false;
  let sectionEl: HTMLElement;

  onMount(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { visible = true; observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(sectionEl);
    return () => observer.disconnect();
  });
</script>

<section class="rec-section" class:visible bind:this={sectionEl}>
  <div class="rec-header">
    {#if emoji}<span class="rec-emoji">{emoji}</span>{/if}
    <span class="rec-label">{title}</span>
  </div>
  <div class="rec-scroll">
    {#each items as item, i}
      <a
        href={item.ctaUrl}
        target="_blank"
        rel="noopener"
        class="rec-card"
        class:rec-card--tall={variant === 'tall'}
        class:rec-card--square={variant === 'square'}
        class:rec-card--wide={variant === 'wide'}
        style="--index: {i}"
      >
        <div class="rec-img-wrap">
          {#if item.image}
            <img class="rec-img" src={item.image} alt={item.title} loading="lazy" />
          {:else}
            <div class="rec-img-fallback" style="--fallback-hue: {(item.title.charCodeAt(0) * 37) % 360}">
              <span class="rec-fallback-icon">{
                item.tag === 'Movie' ? '🎬' :
                item.tag === 'Book' ? '📖' :
                item.tag === 'Track' || item.tag === 'Artist' ? '🎵' :
                item.tag === 'Restaurant' ? '🍽️' : '✨'
              }</span>
              <span class="rec-fallback-title">{item.title}</span>
            </div>
          {/if}
          {#if item.tag}
            <span class="rec-tag">{item.tag}</span>
          {/if}
        </div>
        <div class="rec-body">
          <h4 class="rec-title">{item.title}</h4>
          {#if item.subtitle}<p class="rec-subtitle">{item.subtitle}</p>{/if}
          {#if item.matchReason}<p class="rec-reason">{item.matchReason}</p>{/if}
          <span class="rec-cta">
            {item.ctaLabel}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </div>
      </a>
    {/each}
  </div>
</section>

<style>
  .rec-section {
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1), transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    margin-bottom: 32px;
  }
  .rec-section.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .rec-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 24px;
    margin-bottom: 14px;
  }
  .rec-emoji { font-size: 16px; }
  .rec-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .rec-scroll {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    padding: 0 24px;
    -ms-overflow-style: none;
  }
  .rec-scroll::-webkit-scrollbar { display: none; }

  .rec-card {
    scroll-snap-align: start;
    flex-shrink: 0;
    border-radius: 14px;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    opacity: 0;
    animation: rec-enter 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    animation-delay: calc(var(--index) * 0.08s);
    transition: border-color 0.25s cubic-bezier(0.32, 0.72, 0, 1), transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .rec-card:hover {
    border-color: rgba(77, 124, 255, 0.25);
    transform: translateY(-3px);
  }

  @keyframes rec-enter {
    to { opacity: 1; }
  }

  /* Variants */
  .rec-card--tall { width: 160px; }
  .rec-card--square { width: 180px; }
  .rec-card--wide { width: 260px; }

  .rec-img-wrap {
    position: relative;
    overflow: hidden;
  }

  .rec-card--tall .rec-img-wrap { aspect-ratio: 2/3; }
  .rec-card--square .rec-img-wrap { aspect-ratio: 1/1; }
  .rec-card--wide .rec-img-wrap { aspect-ratio: 16/9; }

  .rec-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .rec-img-fallback {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      145deg,
      hsl(var(--fallback-hue, 220) 45% 18%),
      hsl(calc(var(--fallback-hue, 220) + 40) 35% 12%)
    );
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px 12px;
    text-align: center;
  }
  .rec-fallback-icon {
    font-size: 28px;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
  }
  .rec-fallback-title {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.7);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .rec-tag {
    position: absolute;
    top: 8px;
    left: 8px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    color: white;
  }

  .rec-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .rec-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .rec-subtitle {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0;
  }

  .rec-reason {
    font-size: 11px;
    color: var(--text-secondary);
    font-style: italic;
    margin: 0;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .rec-cta {
    margin-top: auto;
    padding-top: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--accent-secondary);
    display: flex;
    align-items: center;
    gap: 4px;
    transition: gap 0.2s;
  }
  .rec-card:hover .rec-cta { gap: 6px; }
</style>
