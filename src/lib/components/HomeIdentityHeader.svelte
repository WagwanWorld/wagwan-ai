<script lang="ts">
  import type { IdentitySnapshotWrapper } from '$lib/types/identitySnapshot';
  import type { IdentityIntelligenceWrapper } from '$lib/types/identityIntelligence';
  import { createEventDispatcher } from 'svelte';
  import UserCircle from 'phosphor-svelte/lib/UserCircle';
  import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';

  export let displayName = '';
  export let photoUrl: string | null = null;
  export let avatarInitial = 'W';
  export let city = '';
  export let snapshot: IdentitySnapshotWrapper | null = null;
  export let intelligence: IdentityIntelligenceWrapper | null = null;
  /** When identity snapshot is missing but inference compact / graph has a one-liner (e.g. predictive read). */
  export let fallbackOneLiner = '';
  export let loading = false;
  export let regenerating = false;

  const dispatch = createEventDispatcher<{ share: void; refresh: void }>();

  function modeLabel(mode: string): string {
    return mode.charAt(0).toUpperCase() + mode.slice(1);
  }

  function pct(n: number): string {
    return `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`;
  }

  $: mode = snapshot ? intelligence?.payload?.snapshot?.mode ?? snapshot.payload.current_mode : '';
  $: confidence = intelligence?.payload?.snapshot?.confidence ?? null;
  let tagsExpanded = false;

  /** Heuristic buckets: vibe → personality; identity_tags split → work / thinking */
  $: allDescriptorPhrases = snapshot
    ? [...snapshot.payload.vibe, ...snapshot.payload.identity_tags, snapshot.payload.status.direction || '']
        .map(t => t.trim())
        .filter(Boolean)
    : [];
  $: vibeList = snapshot ? snapshot.payload.vibe.map(t => t.trim()).filter(Boolean) : [];
  $: idTagList = snapshot ? snapshot.payload.identity_tags.map(t => t.trim()).filter(Boolean) : [];
  $: splitAt = idTagList.length ? Math.ceil(idTagList.length / 2) : 0;
  $: tagsPersonality = vibeList.slice(0, 2);
  $: tagsWork = idTagList.slice(0, splitAt).slice(0, 2);
  $: tagsThinking = idTagList.slice(splitAt).slice(0, 2);
  $: tagOverflow = allDescriptorPhrases.length > 6;

  $: statusStrip = snapshot
    ? [snapshot.payload.status.level, snapshot.payload.status.direction].filter(Boolean).join(' · ')
    : '';

  $: intelSnap = intelligence?.payload?.snapshot ?? null;
</script>

{#if loading}
  <div class="id-header id-header--skeleton">
    <div class="id-header__sk-row">
      <div class="id-header__sk-avatar"></div>
      <div class="id-header__sk-text">
        <div class="id-header__sk-line id-header__sk-line--sm"></div>
        <div class="id-header__sk-line id-header__sk-line--lg"></div>
        <div class="id-header__sk-line id-header__sk-line--md"></div>
        <div class="id-header__sk-chips">
          {#each Array(5) as _}
            <div class="id-header__sk-chip"></div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{:else if snapshot}
  {@const p = snapshot.payload}
  <section class="id-header id-header--luxury">
    <div class="id-header__card id-header__card--glass">
      <div class="id-header__card-inner">
      <div class="id-header__actions">
        {#if regenerating}
          <span class="id-header__busy">Updating…</span>
        {/if}
        <button
          type="button"
          class="id-header__ghost"
          on:click={() => dispatch('share')}
          title="Share your persona"
        >
          Share ↗
        </button>
        <button
          type="button"
          class="id-header__ghost id-header__ghost--icon"
          on:click={() => dispatch('refresh')}
          disabled={regenerating}
          title="Regenerate"
          aria-label="Regenerate persona"
        >
          <ArrowClockwise size={16} weight="light" />
        </button>
        <a href="/profile" class="id-header__ghost id-header__ghost--icon" title="Profile" aria-label="Open profile">
          <UserCircle size={16} weight="light" />
        </a>
      </div>

      <div class="id-header__body">
        <a href="/profile" class="id-header__avatar-link" aria-label="Open profile">
          {#if photoUrl}
            <img src={photoUrl} alt="" class="id-header__avatar" referrerpolicy="no-referrer" />
          {:else}
            <span class="id-header__avatar id-header__avatar--fb">{avatarInitial}</span>
          {/if}
        </a>

        <div class="id-header__main">
          <h1 class="id-header__name">{displayName || 'You'}</h1>
          <p class="id-header__bio">{p.one_liner}</p>
          <p class="id-header__meta">
            {#if city.trim()}{city.trim()} · {/if}
            {p.archetype}
            {#if mode} · {modeLabel(mode)}{/if}
            {#if confidence !== null} · {pct(confidence)} read{/if}
          </p>
          {#if statusStrip}
            <p class="id-header__status-strip">{statusStrip}</p>
          {/if}
          {#if tagsPersonality.length || tagsWork.length || tagsThinking.length}
            <div class="id-header__tag-groups">
              {#if tagsThinking.length}
                <div class="id-header__tag-group">
                  <span class="id-header__tag-label">Thinking</span>
                  <div class="id-header__tag-row">
                    {#each tagsThinking as t}
                      <span class="id-header__chip">{t}</span>
                    {/each}
                  </div>
                </div>
              {/if}
              {#if tagsWork.length}
                <div class="id-header__tag-group">
                  <span class="id-header__tag-label">Work</span>
                  <div class="id-header__tag-row">
                    {#each tagsWork as t}
                      <span class="id-header__chip">{t}</span>
                    {/each}
                  </div>
                </div>
              {/if}
              {#if tagsPersonality.length}
                <div class="id-header__tag-group">
                  <span class="id-header__tag-label">Personality</span>
                  <div class="id-header__tag-row">
                    {#each tagsPersonality as t}
                      <span class="id-header__chip">{t}</span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
            {#if tagOverflow}
              <button
                type="button"
                class="id-header__tag-more"
                on:click={() => (tagsExpanded = !tagsExpanded)}
              >
                {tagsExpanded ? 'Show fewer' : `All tags (${allDescriptorPhrases.length})`}
              </button>
            {/if}
            {#if tagsExpanded}
              <div class="id-header__tags-cloud" aria-label="All tags">
                {#each allDescriptorPhrases as descriptor}
                  <span class="id-header__chip id-header__chip--ghost">{descriptor}</span>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      </div>
      </div>
    </div>
  </section>
{:else if intelSnap}
  <section class="id-header id-header--luxury">
    <div class="id-header__card id-header__card--glass">
      <div class="id-header__card-inner">
      <div class="id-header__actions">
        {#if regenerating}
          <span class="id-header__busy">Updating…</span>
        {/if}
        <button
          type="button"
          class="id-header__ghost id-header__ghost--icon"
          on:click={() => dispatch('refresh')}
          disabled={regenerating}
          title="Regenerate"
          aria-label="Regenerate persona"
        >
          <ArrowClockwise size={16} weight="light" />
        </button>
        <a href="/profile" class="id-header__ghost id-header__ghost--icon" title="Profile" aria-label="Open profile">
          <UserCircle size={16} weight="light" />
        </a>
      </div>
      <div class="id-header__body">
        <a href="/profile" class="id-header__avatar-link" aria-label="Open profile">
          {#if photoUrl}
            <img src={photoUrl} alt="" class="id-header__avatar" referrerpolicy="no-referrer" />
          {:else}
            <span class="id-header__avatar id-header__avatar--fb">{avatarInitial}</span>
          {/if}
        </a>
        <div class="id-header__main">
          <p class="id-header__intel-badge" aria-hidden="true">Portrait preview</p>
          <h1 class="id-header__name">{displayName || 'You'}</h1>
          <p class="id-header__bio">{intelSnap.one_line_state}</p>
          <p class="id-header__meta">
            {#if city.trim()}{city.trim()} · {/if}
            {modeLabel(intelSnap.mode)}
            {#if intelSnap.confidence !== undefined && intelSnap.confidence !== null}
              · {pct(intelSnap.confidence)} read{/if}
          </p>
        </div>
      </div>
      </div>
    </div>
  </section>
{:else if fallbackOneLiner.trim()}
  <section class="id-header id-header--luxury">
    <div class="id-header__card id-header__card--glass">
      <div class="id-header__card-inner">
      <div class="id-header__actions">
        {#if regenerating}
          <span class="id-header__busy">Updating…</span>
        {/if}
        <button
          type="button"
          class="id-header__ghost id-header__ghost--icon"
          on:click={() => dispatch('refresh')}
          disabled={regenerating}
          title="Regenerate"
          aria-label="Regenerate persona"
        >
          <ArrowClockwise size={16} weight="light" />
        </button>
        <a href="/profile" class="id-header__ghost id-header__ghost--icon" title="Profile" aria-label="Open profile">
          <UserCircle size={16} weight="light" />
        </a>
      </div>
      <div class="id-header__body">
        <a href="/profile" class="id-header__avatar-link" aria-label="Open profile">
          {#if photoUrl}
            <img src={photoUrl} alt="" class="id-header__avatar" referrerpolicy="no-referrer" />
          {:else}
            <span class="id-header__avatar id-header__avatar--fb">{avatarInitial}</span>
          {/if}
        </a>
        <div class="id-header__main">
          <p class="id-header__intel-badge" aria-hidden="true">From your signals</p>
          <h1 class="id-header__name">{displayName || 'You'}</h1>
          <p class="id-header__bio">{fallbackOneLiner.trim()}</p>
        </div>
      </div>
      </div>
    </div>
  </section>
{:else}
  <section class="id-header id-header--luxury">
    <div class="id-header__card id-header__card--empty">
      <div class="id-header__card-inner">
      <div class="id-header__body id-header__body--empty">
        <a href="/profile" class="id-header__avatar-link" aria-label="Open profile">
          {#if photoUrl}
            <img src={photoUrl} alt="" class="id-header__avatar" referrerpolicy="no-referrer" />
          {:else}
            <span class="id-header__avatar id-header__avatar--fb">{avatarInitial}</span>
          {/if}
        </a>
        <div class="id-header__main">
          <h1 class="id-header__name">{displayName || 'You'}</h1>
          <p class="id-header__empty-copy">
            Your portrait has not been generated yet. Connect accounts and refresh signals — it builds automatically.
          </p>
          <a href="/profile" class="id-header__empty-cta">Go to Profile →</a>
        </div>
      </div>
      </div>
    </div>
  </section>
{/if}

<style>
  .id-header {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    padding: max(8px, env(safe-area-inset-top)) 16px 8px;
  }

  .id-header--luxury {
    padding-left: 0;
    padding-right: 0;
    /* Match `.home-feed-pad` (20px) so the glass card isn’t cramped against “Your day” */
    padding-bottom: 20px;
  }

  .id-header__card {
    position: relative;
    padding: 6px;
    border-radius: 2rem;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    box-shadow: var(--shadow-tall-card);
    transition: box-shadow var(--dur-standard) var(--ease-premium);
  }

  .id-header__card--glass {
    backdrop-filter: blur(20px) saturate(1.08);
    -webkit-backdrop-filter: blur(20px) saturate(1.08);
  }

  .id-header--luxury .id-header__card {
    border-radius: 2rem;
  }

  .id-header__card--empty {
    padding: 6px;
  }

  .id-header__card-inner {
    border-radius: calc(2rem - 6px);
    background: var(--bg-elevated);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.08);
    padding: 20px 20px 28px;
    overflow: hidden;
  }

  .id-header__card--empty .id-header__card-inner {
    padding: 22px 20px;
  }

  .id-header__actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .id-header__busy {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-right: auto;
  }

  .id-header__intel-badge {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 6px;
  }

  .id-header__ghost {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--panel-surface-soft);
    border: 1px solid var(--panel-border);
    border-radius: 9px;
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 5px 11px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s ease, color 0.15s ease;
    line-height: 1.3;
  }

  .id-header__ghost:hover {
    background: var(--panel-hover);
    color: var(--text-primary);
  }

  .id-header__ghost:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .id-header__ghost--icon {
    padding: 6px 9px;
  }

  .id-header__body {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .id-header__body--empty {
    align-items: center;
  }

  .id-header__avatar-link {
    flex-shrink: 0;
    text-decoration: none;
  }

  .id-header__avatar {
    width: 88px;
    height: 88px;
    border-radius: 999px;
    object-fit: cover;
    object-position: center;
    border: 2px solid rgba(255, 255, 255, 0.55);
    box-shadow:
      0 0 0 8px color-mix(in srgb, var(--accent-soft) 55%, transparent),
      0 12px 34px rgba(20, 24, 32, 0.16);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .id-header--luxury .id-header__avatar {
    width: 64px;
    height: 64px;
    box-shadow:
      0 0 0 6px color-mix(in srgb, var(--accent-soft) 45%, transparent),
      0 8px 24px rgba(0, 0, 0, 0.35);
  }

  .id-header__avatar--fb {
    background: color-mix(in srgb, var(--accent-primary) 72%, #111827);
    color: #fff;
    font-size: 2rem;
    font-weight: 700;
  }

  .id-header__main {
    min-width: 0;
    flex: 1;
  }

  .id-header__name {
    margin: 0 0 4px;
    font-family: var(--font-sans);
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    line-height: 1.1;
  }

  .id-header--luxury .id-header__name {
    font-size: var(--home-font-title, clamp(1.45rem, 2.2vw, 1.75rem));
    font-weight: 650;
    letter-spacing: -0.03em;
  }

  .id-header__bio {
    margin: 0 0 10px;
    font-family: var(--font-display);
    font-size: clamp(1.1rem, 3.8vw, 1.4rem);
    font-style: italic;
    font-weight: 400;
    line-height: 1.35;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    text-wrap: balance;
  }

  .id-header--luxury .id-header__bio {
    font-size: clamp(1.05rem, 3.2vw, 1.3rem);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .id-header__meta {
    margin: 0 0 6px;
    font-size: 0.78rem;
    color: var(--text-muted);
    line-height: 1.45;
  }

  .id-header__status-strip {
    margin: 0 0 12px;
    font-size: 0.76rem;
    color: var(--text-secondary);
    line-height: 1.45;
  }

  .id-header__tag-groups {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }

  .id-header__tag-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .id-header__tag-label {
    font-size: var(--home-font-meta, 11px);
    font-weight: 600;
    font-variant-caps: small-caps;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .id-header__tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .id-header__chip {
    display: inline-block;
    padding: 5px 11px;
    border-radius: 100px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--text-secondary);
    background: var(--panel-surface);
    border: 1px solid var(--panel-border);
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease,
      border-color 0.15s ease;
  }

  .id-header__chip:hover {
    transform: translateY(-1px);
    border-color: var(--panel-hover-border);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  }

  .id-header__chip--ghost {
    background: transparent;
    border-style: dashed;
  }

  .id-header__tags-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--panel-divider);
  }

  .id-header__tag-more {
    display: inline-flex;
    align-items: center;
    border: none;
    background: transparent;
    color: var(--accent-primary);
    font-size: 0.68rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 6px;
    padding: 6px 2px 2px;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .id-header__tag-more:hover {
    opacity: 0.85;
  }

  .id-header__empty-copy {
    margin: 0 0 14px;
    font-size: 0.86rem;
    color: var(--text-secondary);
    line-height: 1.55;
  }

  .id-header__empty-cta {
    display: inline-block;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--accent-primary, #818cf8);
    text-decoration: none;
  }

  .id-header__empty-cta:hover {
    text-decoration: underline;
  }

  /* Skeleton */
  .id-header--skeleton .id-header__sk-row {
    display: flex;
    gap: 16px;
    background: var(--glass-medium);
    border: 1px solid var(--panel-border);
    border-radius: 22px;
    padding: 20px;
  }

  .id-header__sk-avatar {
    width: 88px;
    height: 88px;
    border-radius: 999px;
    background: var(--panel-surface);
    flex-shrink: 0;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  .id-header__sk-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .id-header__sk-line {
    height: 12px;
    border-radius: 6px;
    background: var(--panel-surface);
    animation: shimmer 1.4s ease-in-out infinite;
  }

  .id-header__sk-line--sm {
    width: 35%;
  }
  .id-header__sk-line--lg {
    width: 100%;
    height: 20px;
  }
  .id-header__sk-line--md {
    width: 70%;
  }

  .id-header__sk-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }

  .id-header__sk-chip {
    width: 64px;
    height: 26px;
    border-radius: 100px;
    background: var(--panel-surface);
    animation: shimmer 1.4s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% { opacity: 0.35; }
    50% { opacity: 0.75; }
    100% { opacity: 0.35; }
  }
</style>
