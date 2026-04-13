<script lang="ts">
  export let illustrationSrc: string;
  export let illustrationAlt = '';
  export let headline: string;
  export let body: string;
  export let primaryLabel: string;
  /** Called when primary CTA is activated */
  export let onPrimary: () => void = () => {};
  export let secondaryLabel: string | undefined = undefined;
  export let onSecondary: (() => void) | undefined = undefined;
</script>

<div class="empty-state-root">
  <img
    class="empty-state-root__img"
    src={illustrationSrc}
    alt={illustrationAlt}
    loading="lazy"
    decoding="async"
    referrerpolicy="no-referrer"
  />
  <h2 class="empty-state-root__headline">{headline}</h2>
  <p class="empty-state-root__body">{body}</p>
  <div class="empty-state-root__actions">
    <button type="button" class="btn-primary btn-primary--sm" on:click={onPrimary}>{primaryLabel}</button>
    {#if secondaryLabel && onSecondary}
      <button type="button" class="btn-secondary btn-secondary--sm" on:click={onSecondary}>{secondaryLabel}</button>
    {/if}
  </div>
</div>

<style>
  .empty-state-root {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px 20px 32px;
    max-width: 22rem;
    margin: 0 auto;
  }

  .empty-state-root__img {
    width: 100%;
    max-width: 280px;
    aspect-ratio: 16 / 10;
    object-fit: cover;
    border-radius: 16px;
    border: 1px solid var(--border-subtle);
    margin-bottom: 20px;
    box-shadow: var(--shadow-tall-card);
  }

  .empty-state-root__headline {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .empty-state-root__body {
    margin: 10px 0 20px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-secondary);
  }

  .empty-state-root__actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }
</style>
