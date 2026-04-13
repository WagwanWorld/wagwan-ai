<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import Microphone from 'phosphor-svelte/lib/Microphone';

  export let placeholder: string = 'Ask about yourself...';
  export let micSupported: boolean = false;

  const dispatch = createEventDispatcher<{
    submit: { query: string };
    mic: void;
  }>();

  let mounted = false;

  onMount(() => {
    mounted = true;
  });

  function handleBarClick() {
    dispatch('submit', { query: '' });
  }

  function handleMicClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch('mic');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleBarClick();
    }
  }
</script>

<div class="quickask" class:quickask--visible={mounted}>
  <div
    class="quickask__bar"
    role="button"
    tabindex="0"
    aria-label={placeholder}
    on:click={handleBarClick}
    on:keydown={handleKeydown}
  >
    {#if micSupported}
      <button
        type="button"
        class="quickask__mic"
        aria-label="Voice input"
        on:click={handleMicClick}
      >
        <Microphone size={20} weight="light" />
      </button>
    {/if}

    <span class="quickask__placeholder">{placeholder}</span>
  </div>
</div>

<style>
  .quickask {
    padding: 0 16px;
    width: 100%;
    opacity: 0;
    transform: translateY(20px);
  }

  .quickask--visible {
    animation: quickask-enter 400ms var(--ease-entrance, cubic-bezier(0.16, 1, 0.3, 1)) 500ms forwards;
  }

  @keyframes quickask-enter {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .quickask {
      opacity: 1;
      transform: none;
    }
    .quickask--visible {
      animation: none;
    }
  }

  .quickask__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 48px;
    padding: 6px 6px 6px 18px;
    border-radius: 24px;
    background: var(--glass-strong, rgba(255, 255, 255, 0.12));
    backdrop-filter: blur(20px) saturate(1.05);
    -webkit-backdrop-filter: blur(20px) saturate(1.05);
    border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.12));
    box-shadow: 0 -4px 20px oklch(8% 0.008 260 / 0.3);
    cursor: pointer;
    transition: box-shadow 200ms var(--ease-premium, ease);
  }

  .quickask__bar:hover {
    box-shadow:
      0 -4px 20px oklch(8% 0.008 260 / 0.3),
      0 0 0 1px color-mix(in srgb, var(--accent-primary, #a78bfa) 18%, transparent);
  }

  .quickask__mic {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted, #666);
    cursor: pointer;
    transition: color 200ms ease;
  }

  .quickask__mic:hover {
    color: var(--accent-primary, #a78bfa);
  }

  .quickask__placeholder {
    flex: 1;
    font-size: 14px;
    font-style: italic;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    color: var(--text-muted, #666);
    user-select: none;
    pointer-events: none;
  }
</style>
