<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let items: { label: string; value: string }[] = [];
  export let disabled = false;
  /** twin: horizontal scroll (AI). thread: wrap (agent thread). */
  export let layout: 'twin' | 'thread' = 'thread';

  const dispatch = createEventDispatcher<{ pick: { value: string } }>();
</script>

{#if items.length}
  <div class="csc-row" class:csc-row--twin={layout === 'twin'} class:csc-row--thread={layout === 'thread'}>
    {#each items as item (item.value)}
      <button
        type="button"
        class="csc-chip"
        {disabled}
        on:click={() => dispatch('pick', { value: item.value })}
      >
        {item.label}
      </button>
    {/each}
  </div>
{/if}

<style>
  .csc-row {
    display: flex;
    gap: 8px;
  }

  .csc-row--thread {
    flex-wrap: wrap;
    margin-bottom: 8px;
    padding: 0 4px;
  }

  .csc-row--twin {
    flex-wrap: nowrap;
    gap: 6px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 2px 2px 6px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .csc-row--twin::-webkit-scrollbar {
    display: none;
  }

  .csc-chip {
    flex-shrink: 0;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    padding: 8px 12px;
    border-radius: 999px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .csc-row--twin .csc-chip {
    font-size: 11px;
    letter-spacing: 0.01em;
    padding: 6px 11px;
  }

  .csc-chip:hover:not(:disabled) {
    background: var(--glass-medium);
    color: var(--text-primary);
    border-color: color-mix(in srgb, var(--accent-primary) 35%, var(--border-subtle));
  }

  .csc-chip:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
