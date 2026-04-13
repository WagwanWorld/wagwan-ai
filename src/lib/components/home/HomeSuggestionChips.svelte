<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { HomeConversationChip } from '$lib/prompts/homeConversationChips';

  export let chips: HomeConversationChip[] = [];

  const dispatch = createEventDispatcher<{ select: { query: string } }>();
</script>

{#if chips.length}
  <div class="home-chips" role="group" aria-label="Suggestions">
    {#each chips as c (c.query)}
      <button
        type="button"
        class="home-chip"
        on:click={() => dispatch('select', { query: c.query })}
      >
        <span class="home-chip-emoji" aria-hidden="true">{c.emoji}</span>
        <span class="home-chip-label">{c.label}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .home-chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    width: 100%;
    max-width: min(680px, 100%);
    margin: 0 auto;
    padding: 0 4px;
  }

  .home-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 999px;
    border: 1px solid transparent;
    background:
      linear-gradient(var(--glass-light), var(--glass-light)) padding-box,
      var(--accent-border-mesh, linear-gradient(135deg, rgba(167, 139, 250, 0.5), rgba(96, 165, 250, 0.45)))
        border-box;
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.02em;
    cursor: pointer;
    font-family: var(--font-sans);
    box-shadow: 0 2px 12px color-mix(in srgb, var(--text-primary) 5%, transparent);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }

  .home-chip:hover {
    transform: translateY(-2px);
    box-shadow:
      0 8px 28px color-mix(in srgb, var(--text-primary) 10%, transparent),
      0 0 24px color-mix(in srgb, var(--accent-glow) 40%, transparent);
  }

  .home-chip:active {
    transform: translateY(0) scale(0.98);
  }

  .home-chip-emoji {
    font-size: 16px;
    line-height: 1;
  }

  .home-chip-label {
    white-space: nowrap;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (prefers-reduced-motion: reduce) {
    .home-chip {
      transition: none;
    }
    .home-chip:hover {
      transform: none;
    }
  }
</style>
