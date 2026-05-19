<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BrandInviteContext } from '$lib/types/brand-invite';

  export let context: BrandInviteContext | null = null;
  export let loading = false;
  export let connecting = false;
  export let error = '';

  const dispatch = createEventDispatcher<{
    connect: void;
    viewProfile: void;
  }>();

  function avatarGradient(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    const h2 = (hue + 35) % 360;
    return `linear-gradient(160deg, hsl(${hue}, 42%, 82%), hsl(${h2}, 38%, 72%))`;
  }

  function formatFollowers(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n > 0 ? n.toLocaleString('en-US') : '';
  }

  $: brandBio = context?.bio?.trim() || '';
  $: brandPitch =
    context?.brandPitch ||
    [context?.aesthetic, context?.lifestyle].filter(Boolean).join(' · ') ||
    context?.matchLine ||
    '';
</script>

<div class="bis" aria-busy={loading}>
  <div class="bis-inner">
    <img src="/logo-white.svg" alt="Wagwan" class="bis-logo" />

    {#if loading}
      <div class="bis-card bis-card--skeleton" aria-hidden="true">
        <div class="bis-sk-avatar"></div>
        <div class="bis-sk-line bis-sk-line--title"></div>
        <div class="bis-sk-line"></div>
        <div class="bis-sk-line bis-sk-line--short"></div>
      </div>
    {:else if context}
      <article class="bis-card">
        <p class="bis-kicker">You're invited</p>

        <div class="bis-hero">
          <div class="bis-avatar">
            {#if context.profilePicture}
              <img src={context.profilePicture} alt={context.name} class="bis-img" />
            {:else}
              <div class="bis-gradient" style="background: {avatarGradient(context.name)}">
                <span class="bis-initials">{context.initials}</span>
              </div>
            {/if}
          </div>

          <h1 class="bis-name">{context.name}</h1>
          {#if context.handle}
            <p class="bis-handle">
              @{context.handle}
              {#if context.followers > 0}
                <span class="bis-dot">·</span>
                {formatFollowers(context.followers)} followers
              {/if}
            </p>
          {/if}
        </div>

        {#if brandBio}
          <p class="bis-bio">{brandBio}</p>
        {:else if brandPitch}
          <p class="bis-bio">{brandPitch}</p>
        {/if}

        {#if context.aesthetic || context.lifestyle}
          <div class="bis-signals">
            {#if context.aesthetic}
              <span class="bis-signal">{context.aesthetic}</span>
            {/if}
            {#if context.lifestyle}
              <span class="bis-signal">{context.lifestyle}</span>
            {/if}
          </div>
        {/if}

        {#if context.tags.length > 0}
          <div class="bis-tags">
            {#each context.tags.slice(0, 4) as tag}
              <span class="bis-tag">{tag}</span>
            {/each}
          </div>
        {/if}

        {#if context.colorPalette.length > 0}
          <div class="bis-palette-row">
            <span class="bis-label">Visual palette</span>
            <div class="bis-palette">
              {#each context.colorPalette as color}
                <span class="bis-palette-dot" style="background: {color}"></span>
              {/each}
            </div>
          </div>
        {/if}

        {#if context.matchLine}
          <p class="bis-match">{context.matchLine}</p>
        {/if}

        {#if context.activeCampaignCount > 0 || context.latestBrief}
          <div class="bis-campaign-hint">
            {#if context.activeCampaignCount > 0}
              <span
                >{context.activeCampaignCount} active campaign{context.activeCampaignCount === 1
                  ? ''
                  : 's'}</span
              >
            {/if}
            {#if context.rewardRange}
              <span class="bis-reward">{context.rewardRange}</span>
            {/if}
          </div>
        {/if}

        <div class="bis-links">
          <button type="button" class="bis-link" on:click={() => dispatch('viewProfile')}>
            View full brand profile
          </button>
          {#if context.instagramUrl}
            <a
              href={context.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="bis-link bis-link--muted"
            >
              @{context.handle || 'instagram'}
            </a>
          {/if}
        </div>
      </article>

      {#if error}
        <p class="bis-error" role="alert">{error}</p>
      {/if}

      <div class="bis-cta-wrap">
        <button
          type="button"
          class="bis-cta"
          disabled={connecting}
          on:click={() => dispatch('connect')}
        >
          {connecting ? 'Connecting…' : 'Connect Instagram to accept'}
        </button>
        <p class="bis-hint">
          {context.name} will see your creator signal — aesthetic, audience, and content style.
        </p>
      </div>
    {:else}
      <p class="bis-fallback">Loading invite…</p>
    {/if}
  </div>
</div>

<style>
  .bis {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: min(100dvh, 100%);
    padding: 2rem 1.25rem 2.5rem;
    width: 100%;
  }

  .bis-inner {
    width: 100%;
    max-width: 26rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }

  .bis-logo {
    height: 20px;
    width: auto;
    opacity: 0.85;
  }

  .bis-card {
    width: 100%;
    padding: 1.75rem 1.5rem 1.5rem;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(16px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.04) inset,
      0 24px 48px rgba(0, 0, 0, 0.35);
    text-align: center;
  }

  .bis-card--skeleton {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .bis-kicker {
    margin: 0 0 1.25rem;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #c9b896;
  }

  .bis-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .bis-avatar {
    width: 96px;
    height: 96px;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  }

  .bis-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .bis-gradient {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bis-initials {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 2.25rem;
    font-weight: 300;
    color: rgba(255, 255, 255, 0.12);
  }

  .bis-name {
    margin: 0;
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1.1;
    color: #ededef;
  }

  .bis-handle {
    margin: 0;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 12px;
    color: #6b6b72;
  }

  .bis-dot {
    margin: 0 4px;
    opacity: 0.5;
  }

  .bis-bio {
    margin: 0 0 1rem;
    font-size: 14px;
    line-height: 1.55;
    color: #8b8b94;
  }

  .bis-signals {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-bottom: 0.75rem;
  }

  .bis-signal {
    font-size: 13px;
    font-style: italic;
    color: #b8b8be;
  }

  .bis-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin-bottom: 1rem;
  }

  .bis-tag {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #8b8b94;
  }

  .bis-palette-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-bottom: 1rem;
  }

  .bis-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  .bis-palette {
    display: flex;
    gap: 8px;
  }

  .bis-palette-dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .bis-match {
    margin: 0 0 1rem;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(201, 184, 150, 0.08);
    border: 1px solid rgba(201, 184, 150, 0.12);
    font-size: 12px;
    line-height: 1.5;
    color: #c9b896;
  }

  .bis-campaign-hint {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 1rem;
    font-size: 11px;
    color: #6b6b72;
  }

  .bis-reward {
    color: #8b8b94;
  }

  .bis-links {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .bis-link {
    padding: 0;
    border: none;
    background: none;
    font-size: 12px;
    font-weight: 600;
    color: #ededef;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .bis-link--muted {
    color: #6b6b72;
    text-decoration: none;
    font-weight: 500;
  }

  .bis-link--muted:hover {
    color: #8b8b94;
    text-decoration: underline;
  }

  .bis-cta-wrap {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .bis-cta {
    width: 100%;
    min-height: 52px;
    padding: 0 1.25rem;
    border: none;
    border-radius: 999px;
    font-size: 15px;
    font-weight: 600;
    color: #0a0a0b;
    cursor: pointer;
    background: linear-gradient(90deg, #e040fb 0%, #ff6b35 55%, #ffb347 100%);
    box-shadow: 0 8px 32px rgba(224, 64, 251, 0.25);
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }

  .bis-cta:hover:not(:disabled) {
    opacity: 0.95;
    transform: translateY(-1px);
  }

  .bis-cta:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .bis-hint {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: #4a4a50;
    text-align: center;
    max-width: 20rem;
  }

  .bis-error {
    margin: 0;
    font-size: 13px;
    color: #e88;
    text-align: center;
  }

  .bis-fallback {
    color: #6b6b72;
    font-size: 14px;
  }

  .bis-sk-avatar {
    width: 96px;
    height: 96px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.06);
    animation: bis-pulse 1.2s ease-in-out infinite;
  }

  .bis-sk-line {
    width: 70%;
    height: 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    animation: bis-pulse 1.2s ease-in-out infinite;
  }

  .bis-sk-line--title {
    width: 50%;
    height: 22px;
  }

  .bis-sk-line--short {
    width: 40%;
  }

  @keyframes bis-pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }
</style>
