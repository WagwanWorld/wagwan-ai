<script lang="ts">
  /** User-side message bubble — same chrome everywhere (/ai, agent threads). */
  export let text: string;
  export let timeLabel = '';
  export let fadeClass = 'wagwan-chat-fade-up';
  /** Extra vertical rhythm on /ai vs compact agent threads */
  export let airy = false;
</script>

<div class="cub-root {fadeClass}" class:cub-root--airy={airy}>
  <div class="cub-text">{text}</div>
  {#if timeLabel}
    <div class="cub-meta">{timeLabel}</div>
  {/if}
</div>

<style>
  .cub-root {
    margin: 6px 16px 6px 32px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .cub-root--airy {
    margin-bottom: 20px;
    margin-top: 8px;
  }

  .cub-text {
    max-width: 92%;
    padding: 10px 14px;
    border-radius: 16px 16px 4px 16px;
    background: color-mix(in srgb, var(--accent-primary) 22%, var(--panel-surface));
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.45;
    white-space: pre-wrap;
  }

  .cub-meta {
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 4px;
    padding: 0 2px;
  }

  :global(.wagwan-chat-fade-up) {
    animation: wagwanChatFadeUp 0.28s ease both;
  }

  @keyframes wagwanChatFadeUp {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>
