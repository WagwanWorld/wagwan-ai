<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { IdentitySnapshotWrapper } from '$lib/types/identitySnapshot';

  export let snapshot: IdentitySnapshotWrapper;
  export let photoUrl: string | null | undefined = null;

  const dispatch = createEventDispatcher<{ close: void }>();

  let copying = false;
  let copyDone = false;
  let sharing = false;
  let shareError = '';

  const MAX_VIBE_TAGS = 5;

  $: p = snapshot.payload;
  $: vibeTags = p.vibe.slice(0, MAX_VIBE_TAGS);

  /** Parse core_contradiction into two sides for share card. */
  $: contradictionParts = (() => {
    const separators = [' ↔ ', ' vs ', ' but ', ' — '];
    for (const sep of separators) {
      if (p.core_contradiction.includes(sep)) {
        const [a, b] = p.core_contradiction.split(sep);
        return [a.trim(), b.trim()];
      }
    }
    return [p.core_contradiction, ''];
  })();

  function closeOnBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('share-modal-backdrop')) {
      dispatch('close');
    }
  }

  function closeOnKey(e: KeyboardEvent) {
    if (e.key === 'Escape') dispatch('close');
  }

  async function copyText() {
    const text = [
      p.one_liner,
      '',
      vibeTags.join(' · '),
      p.core_contradiction,
      '',
      'wagwanworld.vercel.app',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      copyDone = true;
      setTimeout(() => (copyDone = false), 2000);
    } catch {
      copying = false;
    }
  }

  function canNativeShare(): boolean {
    try { return 'share' in navigator; } catch { return false; }
  }

  async function shareNative() {
    const text = [
      p.one_liner,
      '',
      vibeTags.join(' · '),
      p.core_contradiction,
      '',
      'wagwanworld.vercel.app',
    ].join('\n');
    if (canNativeShare()) {
      sharing = true;
      try {
        await navigator.share({ text });
      } catch {
        /* user cancelled */
      } finally {
        sharing = false;
      }
    } else {
      await copyText();
    }
  }

  onMount(() => {
    document.addEventListener('keydown', closeOnKey);
    return () => document.removeEventListener('keydown', closeOnKey);
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="share-modal-backdrop" on:click={closeOnBackdrop}>
  <div class="share-modal" role="dialog" aria-modal="true" aria-label="Share your persona">

    <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">✕</button>

    <!-- Printable card -->
    <div class="share-card" id="share-card">
      {#if photoUrl}
        <img src={photoUrl} alt="" class="share-card__photo" referrerpolicy="no-referrer" />
      {/if}
      <div class="share-card__gradient"></div>
      <div class="share-card__content">
        <span class="share-card__wordmark">WagwanAI</span>
        <div class="share-card__body">
          <span class="share-card__archetype">{p.archetype}</span>
          <p class="share-card__one-liner">{p.one_liner}</p>
          {#if vibeTags.length}
            <div class="share-card__tags">
              {#each vibeTags as tag}
                <span class="share-card__tag">{tag}</span>
              {/each}
            </div>
          {/if}
          {#if contradictionParts[1]}
            <p class="share-card__contradiction">
              {contradictionParts[0]} ↔ {contradictionParts[1]}
            </p>
          {:else}
            <p class="share-card__contradiction">{contradictionParts[0]}</p>
          {/if}
        </div>
        <div class="share-card__footer">
          <span class="share-card__footer-url">wagwanworld.vercel.app</span>
        </div>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="share-actions">
      <button class="share-btn share-btn--primary" on:click={shareNative} disabled={sharing}>
        {sharing ? 'Sharing…' : (canNativeShare() ? 'Share' : 'Copy to clipboard')}
      </button>
      {#if canNativeShare()}
        <button class="share-btn share-btn--ghost" on:click={copyText}>
          {copyDone ? 'Copied!' : 'Copy text'}
        </button>
      {/if}
      {#if shareError}
        <p class="share-err">{shareError}</p>
      {/if}
    </div>

  </div>
</div>

<style>
  .share-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .share-modal {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    max-width: 360px;
    width: 100%;
  }

  .close-btn {
    position: absolute;
    top: -12px;
    right: -12px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.80);
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transition: background 0.15s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.20);
  }

  /* ─── Share card ────────────────────────────── */
  .share-card {
    position: relative;
    width: 320px;
    min-height: 460px;
    border-radius: 24px;
    overflow: hidden;
    background: #0a0a0c;
    display: flex;
    flex-direction: column;
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.70);
  }

  .share-card__photo {
    position: absolute;
    inset: -10%;
    width: 120%;
    height: 120%;
    object-fit: cover;
    object-position: center top;
    filter: blur(60px) saturate(1.4);
    opacity: 0.35;
  }

  .share-card__gradient {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 120% 80% at 50% 0%, var(--accent-glow, rgba(99,102,241,0.40)) 0%, transparent 65%),
      linear-gradient(to bottom, transparent 40%, rgba(0, 0, 0, 0.65) 100%);
  }

  .share-card__content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 460px;
    padding: 24px;
  }

  .share-card__wordmark {
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.20em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
  }

  .share-card__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 14px;
    padding: 20px 0;
  }

  .share-card__archetype {
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent-primary, #818cf8);
  }

  .share-card__one-liner {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.22;
    color: rgba(255, 255, 255, 0.97);
  }

  .share-card__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .share-card__tag {
    font-size: 0.68rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.65);
    letter-spacing: 0.06em;
  }

  .share-card__tag::after {
    content: ' ·';
  }

  .share-card__tag:last-child::after {
    content: '';
  }

  .share-card__contradiction {
    margin: 0;
    font-size: 0.80rem;
    color: rgba(255, 255, 255, 0.52);
    line-height: 1.45;
    font-style: italic;
  }

  .share-card__footer {
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .share-card__footer-url {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: rgba(255, 255, 255, 0.28);
  }

  /* ─── Action buttons ────────────────────────── */
  .share-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .share-btn {
    width: 100%;
    padding: 11px 20px;
    border-radius: 12px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
    border: none;
  }

  .share-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .share-btn--primary {
    background: var(--accent-primary, #818cf8);
    color: #fff;
  }

  .share-btn--primary:hover:not(:disabled) {
    opacity: 0.85;
  }

  .share-btn--ghost {
    background: rgba(255, 255, 255, 0.09);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.70);
  }

  .share-btn--ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.90);
  }

  .share-err {
    font-size: 0.78rem;
    color: rgba(251, 113, 133, 0.90);
    margin: 0;
  }
</style>
