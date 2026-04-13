<script lang="ts">
  /** Phosphor Svelte icon component */
  export let icon: any;
  /** Category label */
  export let category: string;
  /** Bold insight statement */
  export let statement: string;
  /** Optional supporting text */
  export let supporting: string = '';
  /** Whether this card is the active/focused one in the carousel */
  export let active: boolean = false;
</script>

<div
  class="insight-card"
  class:insight-card--active={active}
  role="button"
  tabindex="0"
  on:click
  on:keydown
>
  <div class="insight-card__inner">
    <div class="insight-card__top">
      <span class="insight-card__icon">
        <svelte:component this={icon} size={24} weight="duotone" />
      </span>
      <span class="insight-card__pill">{category}</span>
    </div>

    <p class="insight-card__statement">{statement}</p>

    {#if supporting}
      <p class="insight-card__supporting">{supporting}</p>
    {/if}
  </div>
</div>

<style>
  .insight-card {
    padding: 6px;
    border-radius: 1.5rem;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    min-height: 140px;
    cursor: pointer;
    transition:
      box-shadow 200ms var(--ease-premium, ease),
      transform 200ms var(--ease-premium, ease);
  }

  .insight-card--active {
    box-shadow: 0 8px 28px oklch(75% 0.22 130 / 0.12);
  }

  .insight-card:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
  }

  @media (hover: hover) {
    .insight-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px oklch(75% 0.22 130 / 0.10);
    }
  }

  .insight-card__inner {
    border-radius: calc(1.5rem - 6px);
    background: var(--bg-elevated);
    padding: 20px 22px;
    height: 100%;
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
  }

  .insight-card__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .insight-card__icon {
    display: flex;
    align-items: center;
    color: var(--accent-primary);
    line-height: 1;
  }

  .insight-card__pill {
    font-size: 9px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.1em;
    padding: 3px 10px;
    border-radius: 100px;
    background: var(--accent-soft);
    color: var(--accent-primary);
    line-height: 1.2;
    white-space: nowrap;
  }

  .insight-card__statement {
    margin: 14px 0 0;
    font-family: var(--font-display, Georgia, serif);
    font-style: italic;
    font-weight: 400;
    font-size: 1.05rem;
    line-height: 1.4;
    color: var(--text-primary);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .insight-card__supporting {
    margin: 8px 0 0;
    font-size: 12px;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
