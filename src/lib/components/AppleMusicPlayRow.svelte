<script lang="ts">
  import type { AppleMusicTrackHint } from '$lib/utils';
  import { playAppleMusicTrack } from '$lib/client/appleMusicPlayback';

  export let hint: AppleMusicTrackHint;
  /** Catalog storefront for search fallback URLs */
  export let storefront = 'us';

  let busy = false;

  $: label = hint.artistName ? `${hint.title} — ${hint.artistName}` : hint.title;

  async function play() {
    if (busy) return;
    busy = true;
    try {
      await playAppleMusicTrack(hint, storefront);
    } finally {
      busy = false;
    }
  }
</script>

<div class="am-play-row">
  <span class="am-play-row-label">{label}</span>
  <button
    type="button"
    class="am-play-row-btn"
    disabled={busy}
    on:click={play}
    aria-label="Play in Apple Music"
  >
    {busy ? '…' : 'Play'}
  </button>
</div>

<style>
  .am-play-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 12px;
    line-height: 1.35;
  }

  .am-play-row:last-child {
    margin-bottom: 0;
  }

  .am-play-row-label {
    flex: 1;
    min-width: 0;
    color: var(--text-secondary);
  }

  .am-play-row-btn {
    flex-shrink: 0;
    margin: 0;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text-primary);
    background: var(--brand-red-soft);
    border: 1px solid var(--pill-warn-border);
    border-radius: 999px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      opacity 0.2s ease,
      transform 0.15s ease;
  }

  .am-play-row-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .am-play-row-btn:not(:disabled):active {
    transform: scale(0.97);
  }
</style>
