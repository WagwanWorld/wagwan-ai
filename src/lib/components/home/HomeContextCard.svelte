<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /** Primary line, e.g. event title + time */
  export let title = '';
  /** Secondary line, e.g. city · weekday */
  export let subtitle = '';
  export let ctaLabel = 'Plan something before this';

  const dispatch = createEventDispatcher<{ cta: void }>();
</script>

{#if title}
  <div class="home-ctx-card">
    <div class="home-ctx-card__text">
      <p class="home-ctx-card__title">{title}</p>
      {#if subtitle}
        <p class="home-ctx-card__sub">{subtitle}</p>
      {/if}
    </div>
    <button type="button" class="home-ctx-card__cta" on:click={() => dispatch('cta')}>
      {ctaLabel}
    </button>
  </div>
{/if}

<style>
  .home-ctx-card {
    width: 100%;
    max-width: min(680px, 100%);
    margin: 0 auto;
    padding: 14px 18px;
    border-radius: 18px;
    background: color-mix(in srgb, var(--glass-light) 85%, transparent);
    border: 1px solid var(--border-subtle);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--text-primary) 5%, transparent);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .home-ctx-card__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    line-height: 1.35;
  }

  .home-ctx-card__sub {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .home-ctx-card__cta {
    flex-shrink: 0;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent);
    background: var(--accent-soft);
    color: var(--accent-primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font-sans);
    transition:
      background 0.2s,
      box-shadow 0.2s;
  }

  .home-ctx-card__cta:hover {
    box-shadow: 0 0 20px color-mix(in srgb, var(--accent-glow) 35%, transparent);
  }
</style>
