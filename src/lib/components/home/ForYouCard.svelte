<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title: string;
  export let imageUrl: string = '';
  export let category: string = '';
  export let emoji: string = '';
  export let matchScore: number = 0;
  export let url: string = '';
  export let price: string = '';

  const dispatch = createEventDispatcher<{
    open: { url: string };
    feedback: { vote: 'up' | 'down' };
  }>();

  function handleClick() {
    dispatch('open', { url });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  $: highMatch = matchScore >= 85;
</script>

<div
  class="foryou-card"
  class:foryou-card--no-image={!imageUrl}
  role="link"
  tabindex="0"
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  {#if imageUrl}
    <img class="foryou-card__img" src={imageUrl} alt={title} loading="lazy" />
  {/if}

  <!-- Match score badge -->
  {#if matchScore > 0}
    <span
      class="foryou-card__score"
      class:foryou-card__score--high={highMatch}
    >
      {matchScore}%
    </span>
  {/if}

  <!-- Bottom scrim + content -->
  <div class="foryou-card__scrim">
    <div class="foryou-card__content">
      <p class="foryou-card__title">
        {#if emoji}<span class="foryou-card__emoji">{emoji}</span>{/if}
        {title}
      </p>
      {#if price}
        <span class="foryou-card__price">{price}</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .foryou-card {
    position: relative;
    aspect-ratio: 3 / 4;
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition:
      transform 250ms var(--ease-premium, cubic-bezier(0.22, 1, 0.36, 1)),
      box-shadow 250ms var(--ease-premium, cubic-bezier(0.22, 1, 0.36, 1));
  }

  .foryou-card--no-image {
    background: linear-gradient(
      135deg,
      var(--bg-elevated, #1a1a2e),
      var(--accent-soft, #2d2b55)
    );
  }

  .foryou-card__img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .foryou-card__score {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 10px;
    font-weight: 700;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    padding: 2px 8px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    z-index: 2;
    line-height: 1.4;
  }

  .foryou-card__score--high {
    background: rgba(34, 197, 94, 0.85);
  }

  .foryou-card__scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.78) 0%,
      rgba(0, 0, 0, 0.1) 55%,
      transparent 100%
    );
    display: flex;
    align-items: flex-end;
    z-index: 1;
  }

  .foryou-card__content {
    padding: 14px;
    width: 100%;
  }

  .foryou-card__title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    color: white;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .foryou-card__emoji {
    font-size: 13px;
    margin-right: 4px;
  }

  .foryou-card__price {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    font-weight: 500;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    color: var(--text-on-media-muted, rgba(255, 255, 255, 0.6));
  }

  /* Hover — desktop */
  @media (hover: hover) {
    .foryou-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 24px oklch(75% 0.22 130 / 0.18);
    }
  }

  /* Active / press */
  .foryou-card:active {
    transform: scale(0.97);
    transition-duration: 100ms;
  }
</style>
