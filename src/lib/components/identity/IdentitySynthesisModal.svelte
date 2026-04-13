<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';

  export let open = false;
  export let title = '';
  export let body = '';

  const dispatch = createEventDispatcher<{ close: void }>();

  function close() {
    dispatch('close');
  }

  function onKey(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') close();
  }

  $: if (open && typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden';
  } else if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }

  onDestroy(() => {
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  });
</script>

<svelte:window on:keydown={onKey} />

{#if open}
  <div class="iv-modal" role="dialog" aria-modal="true" aria-labelledby="iv-modal-title">
    <button type="button" class="iv-modal__backdrop" aria-label="Close" on:click={close}></button>
    <div class="iv-modal__panel">
      <header class="iv-modal__head">
        <h2 id="iv-modal-title" class="iv-modal__title">{title}</h2>
        <button type="button" class="iv-modal__x" on:click={close} aria-label="Close dialog">×</button>
      </header>
      <div class="iv-modal__body">{body}</div>
    </div>
  </div>
{/if}

<style>
  .iv-modal {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .iv-modal__backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgba(12, 12, 14, 0.55);
    backdrop-filter: blur(6px);
    cursor: pointer;
  }

  .iv-modal__panel {
    position: relative;
    z-index: 1;
    width: min(520px, 100%);
    max-height: min(72vh, 560px);
    overflow: auto;
    border-radius: 18px;
    background: var(--iv-surface, #faf8f5);
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.08));
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18);
    color: var(--iv-text, #1a1a1a);
  }

  .iv-modal__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 18px 0;
  }

  .iv-modal__title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .iv-modal__x {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.05);
    font-size: 1.35rem;
    line-height: 1;
    cursor: pointer;
    color: inherit;
  }

  .iv-modal__body {
    padding: 12px 18px 20px;
    font-size: 0.92rem;
    line-height: 1.55;
    white-space: pre-wrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .iv-modal__backdrop {
      backdrop-filter: none;
    }
  }
</style>
