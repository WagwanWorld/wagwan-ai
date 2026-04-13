<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Mic, Send } from '@lucide/svelte';
  import { isSpeechRecognitionSupported } from '$lib/voice/speech';

  export let value = '';
  export let placeholderRotate: string[] = [
    'What do you feel like doing?',
    'Find me something fun',
    'Where should I eat?',
    'Plan my evening',
    'Something chill nearby?',
  ];
  export let disabled = false;
  export let listening = false;
  export let showMic = true;

  const dispatch = createEventDispatcher<{ submit: void; togglemic: void }>();

  let focused = false;
  let inputEl: HTMLTextAreaElement;

  export function focusField() {
    inputEl?.focus();
  }
  let phIndex = 0;
  let phTimer: ReturnType<typeof setInterval> | undefined;

  $: displayPlaceholder = placeholderRotate[phIndex % placeholderRotate.length] ?? '';

  onMount(() => {
    phTimer = setInterval(() => {
      if (!focused && !value.trim()) phIndex += 1;
    }, 4200);
  });

  onDestroy(() => {
    if (phTimer) clearInterval(phTimer);
  });

  function autoResize() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) dispatch('submit');
    }
  }
</script>

<div class="home-input-shell" class:home-input-shell--focused={focused} class:home-input-shell--pulse={!focused && !value}>
  {#if showMic && isSpeechRecognitionSupported()}
    <button
      type="button"
      class="home-input-icon"
      class:home-input-icon--live={listening}
      aria-label={listening ? 'Stop listening' : 'Voice input'}
      aria-pressed={listening}
      {disabled}
      on:click={() => dispatch('togglemic')}
    >
      <Mic size={22} strokeWidth={2} />
    </button>
  {/if}
  <textarea
    bind:this={inputEl}
    bind:value
    rows="1"
    class="home-input-field"
    placeholder={displayPlaceholder}
    {disabled}
    on:focus={() => (focused = true)}
    on:blur={() => (focused = false)}
    on:input={autoResize}
    on:keydown={onKey}
  ></textarea>
  <button
    type="button"
    class="home-input-send"
    class:home-input-send--on={!!value.trim() && !disabled}
    aria-label="Send"
    disabled={disabled || !value.trim()}
    on:click={() => dispatch('submit')}
  >
    <Send size={20} strokeWidth={2.25} />
  </button>
</div>

<style>
  .home-input-shell {
    --home-input-glow: var(--accent-glow);
    display: flex;
    align-items: flex-end;
    gap: 10px;
    width: 100%;
    max-width: min(680px, 100%);
    margin: 0 auto;
    padding: 12px 14px;
    border-radius: 24px;
    background: color-mix(in srgb, var(--glass-medium) 88%, transparent);
    border: 1px solid color-mix(in srgb, var(--border-subtle) 70%, transparent);
    box-shadow:
      0 4px 24px color-mix(in srgb, var(--text-primary) 6%, transparent),
      0 0 0 1px color-mix(in srgb, var(--accent-primary) 8%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    transition:
      box-shadow 0.25s ease,
      border-color 0.25s ease,
      background 0.25s ease;
  }

  .home-input-shell--focused {
    background: color-mix(in srgb, var(--glass-strong) 92%, transparent);
    border-color: color-mix(in srgb, var(--accent-primary) 22%, transparent);
    box-shadow:
      0 8px 32px color-mix(in srgb, var(--text-primary) 8%, transparent),
      0 0 0 1px color-mix(in srgb, var(--accent-primary) 18%, transparent),
      0 0 48px var(--home-input-glow);
  }

  .home-input-shell--pulse {
    animation: home-input-idle-glow 4.5s ease-in-out infinite;
  }

  @keyframes home-input-idle-glow {
    0%,
    100% {
      box-shadow:
        0 4px 24px color-mix(in srgb, var(--text-primary) 5%, transparent),
        0 0 0 1px color-mix(in srgb, var(--accent-primary) 6%, transparent);
    }
    50% {
      box-shadow:
        0 6px 28px color-mix(in srgb, var(--text-primary) 7%, transparent),
        0 0 0 1px color-mix(in srgb, var(--accent-primary) 12%, transparent),
        0 0 36px color-mix(in srgb, var(--accent-glow) 45%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .home-input-shell--pulse {
      animation: none;
    }
  }

  .home-input-icon,
  .home-input-send {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    border: 1px solid var(--border-subtle);
    background: var(--panel-surface-soft);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      background 0.2s,
      color 0.2s,
      border-color 0.2s,
      transform 0.15s;
  }

  .home-input-icon:hover,
  .home-input-send:hover:not(:disabled) {
    background: var(--panel-hover);
    color: var(--text-primary);
    border-color: var(--panel-border-strong);
  }

  .home-input-icon:active,
  .home-input-send:active:not(:disabled) {
    transform: scale(0.96);
  }

  .home-input-icon--live {
    color: var(--accent-primary);
    border-color: var(--accent-glow);
    background: var(--accent-soft);
  }

  .home-input-send:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .home-input-send--on {
    color: var(--accent-primary);
    border-color: color-mix(in srgb, var(--accent-primary) 35%, transparent);
  }

  .home-input-field {
    flex: 1;
    min-height: 44px;
    max-height: 120px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 16px;
    line-height: 1.45;
    resize: none;
    outline: none;
    font-family: var(--font-sans);
    padding: 10px 4px;
  }

  .home-input-field::placeholder {
    color: var(--text-muted);
  }
</style>
