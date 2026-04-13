<script lang="ts">
  /** Main page title */
  export let title: string;
  export let description: string | undefined = undefined;
</script>

<header class="page-header">
  <div class="page-header__main">
    <h1 class="page-header__title">{title}</h1>
    {#if description}
      <p class="page-header__desc">{description}</p>
    {/if}
  </div>
  {#if $$slots.actions}
    <div class="page-header__actions">
      <slot name="actions" />
    </div>
  {/if}
</header>

<style>
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }

  .page-header__title {
    margin: 0;
    font-size: clamp(1.35rem, 4vw, 1.75rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    line-height: 1.2;
  }

  .page-header__desc {
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-secondary);
    max-width: 42ch;
  }

  .page-header__actions {
    flex-shrink: 0;
  }
</style>
