<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';

  /** `thread` = agent chats (/chat/:id). `twin` = main twin (/ai) glass composer. */
  export let variant: 'thread' | 'twin' = 'thread';
  export let value = '';
  export let placeholder = 'Message…';
  export let disabled = false;
  export let busy = false;
  export let rows = 1;
  /** Twin: focus ring on the glass pill */
  export let focused = false;

  let textareaEl: HTMLTextAreaElement;
  const dispatch = createEventDispatcher<{
    submit: void;
    input: void;
    focus: void;
    blur: void;
  }>();

  export async function autoResize() {
    await tick();
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, 120) + 'px';
  }

  function onInput() {
    void autoResize();
    dispatch('input');
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      dispatch('submit');
    }
  }

  $: threadSendDisabled = !value.trim() || busy || disabled;
  $: twinSendLit = busy || (!!value.trim() && !disabled);
  $: twinSendDisabled = disabled || busy || !value.trim();
</script>

{#if variant === 'twin'}
  <div
    class="ccp-twin-pill"
    class:ccp-twin-pill--focused={focused}
  >
    <slot name="leading" />
    <textarea
      bind:this={textareaEl}
      bind:value
      on:keydown={onKey}
      on:input={onInput}
      on:focus={() => dispatch('focus')}
      on:blur={() => dispatch('blur')}
      class="ccp-twin-textarea"
      {rows}
      {placeholder}
      disabled={disabled || busy}
    ></textarea>
    <slot name="before-send" />
    <button
      type="button"
      class="ccp-twin-send"
      class:ccp-twin-send--on={twinSendLit}
      disabled={twinSendDisabled}
      on:click={() => dispatch('submit')}
      aria-label="Send"
    >
      {#if busy}
        <span class="ccp-twin-spinner"></span>
      {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m22 2-7 20-4-9-9-4 20-7z" /><path d="M22 2 11 13" />
        </svg>
      {/if}
    </button>
  </div>
{:else}
  <div class="ccp-pill ui-panel ui-panel--solid ui-panel--r14">
    <slot name="leading" />
    <textarea
      bind:this={textareaEl}
      bind:value
      on:keydown={onKey}
      on:input={onInput}
      class="ccp-thread-textarea"
      {rows}
      {placeholder}
      disabled={disabled || busy}
    ></textarea>
    <slot name="before-send" />
    <button
      type="button"
      class="ccp-thread-send"
      disabled={threadSendDisabled}
      on:click={() => dispatch('submit')}
      aria-label="Send"
    >
      {#if busy}
        <span class="ccp-thread-dot"></span>
      {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m22 2-7 20-4-9-9-4 20-7z" /><path d="M22 2 11 13" />
        </svg>
      {/if}
    </button>
  </div>
{/if}

<style>
  /* ── Thread (/chat/:id) ── */
  .ccp-pill {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 8px 8px 14px;
  }

  .ccp-thread-textarea {
    flex: 1;
    min-height: 40px;
    max-height: 120px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 14px;
    font-family: inherit;
    resize: none;
    line-height: 1.4;
    padding: 8px 0;
  }

  .ccp-thread-textarea:focus {
    outline: none;
  }

  .ccp-thread-textarea:disabled {
    opacity: 0.65;
  }

  .ccp-thread-send {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--accent-primary) 85%, #000);
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
  }

  .ccp-thread-send:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .ccp-thread-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fff;
    animation: ccpPulse 1s ease-in-out infinite;
  }

  /* ── Twin (/ai) ── */
  .ccp-twin-pill {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    max-width: min(56rem, 100%);
    margin: 0 auto;
    padding: 8px 10px 8px 14px;
    background: var(--glass-strong);
    border: 1px solid var(--border-subtle);
    border-radius: 100px;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
    box-shadow: 0 2px 24px color-mix(in srgb, var(--bg-primary) 40%, transparent);
  }

  .ccp-twin-pill--focused {
    border-color: color-mix(in srgb, var(--accent-primary) 45%, var(--border-subtle));
    background: var(--glass-strong);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--accent-primary) 18%, transparent),
      0 8px 32px color-mix(in srgb, var(--bg-primary) 55%, transparent);
  }

  .ccp-twin-textarea {
    flex: 1;
    min-width: 0;
    min-height: 40px;
    max-height: 120px;
    resize: none;
    background: transparent;
    border: none;
    outline: none;
    font-size: 15px;
    line-height: 1.45;
    color: var(--text-primary);
    caret-color: var(--accent-primary);
    padding: 9px 4px;
    font-family: inherit;
  }

  .ccp-twin-textarea:disabled {
    opacity: 0.65;
  }

  .ccp-twin-send {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--glass-medium);
    color: var(--text-muted);
    cursor: default;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s, transform 0.12s;
  }

  .ccp-twin-send--on {
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    color: #fff;
    cursor: pointer;
    box-shadow: 0 4px 18px color-mix(in srgb, var(--accent-primary) 45%, transparent);
  }

  .ccp-twin-send--on:active {
    transform: scale(0.94);
  }

  .ccp-twin-send:disabled:not(.ccp-twin-send--on) {
    opacity: 0.4;
  }

  .ccp-twin-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid color-mix(in srgb, currentColor 35%, transparent);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: ccpSpin 0.8s linear infinite;
  }

  @keyframes ccpPulse {
    50% {
      opacity: 0.35;
    }
  }

  @keyframes ccpSpin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
