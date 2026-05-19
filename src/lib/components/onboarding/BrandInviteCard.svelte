<script lang="ts">
  import type { BrandInviteContext } from '$lib/types/brand-invite';

  export let context: BrandInviteContext | null = null;
  export let loading = false;
  export let compact = false;
  export let returnPath = '/onboarding';

  function avatarGradient(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    const h2 = (hue + 35) % 360;
    return `linear-gradient(160deg, hsl(${hue}, 40%, 88%), hsl(${h2}, 35%, 78%))`;
  }

  function formatFollowers(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n > 0 ? n.toLocaleString('en-US') : '';
  }

  $: profileHref = context ? `${context.profileUrl}?return=${encodeURIComponent(returnPath)}` : '#';
</script>

{#if loading}
  <div class="bic bic--loading" class:bic--compact={compact} aria-busy="true">
    <div class="bic-sk-avatar"></div>
    <div class="bic-sk-body">
      <div class="bic-sk-line bic-sk-line--lg"></div>
      <div class="bic-sk-line"></div>
      <div class="bic-sk-line bic-sk-line--sm"></div>
    </div>
  </div>
{:else if context}
  <section class="bic" class:bic--compact={compact} aria-label="Brand invitation">
    <div class="bic-main">
      <div class="bic-avatar">
        {#if context.profilePicture}
          <img src={context.profilePicture} alt={context.name} class="bic-img" />
        {:else}
          <div class="bic-gradient" style="background: {avatarGradient(context.name)}">
            <span class="bic-initials">{context.initials}</span>
          </div>
        {/if}
      </div>

      <div class="bic-copy">
        <p class="bic-kicker">Brand invite</p>
        <p class="bic-title">
          <strong>{context.name}</strong> invited you to join Wagwan as a creator
        </p>
        {#if context.handle}
          <p class="bic-handle">
            @{context.handle}{#if context.followers > 0}
              · {formatFollowers(context.followers)} followers{/if}
          </p>
        {/if}
        {#if context.brandPitch}
          <p class="bic-invite-line">{context.brandPitch}</p>
        {:else if context.bio}
          <p class="bic-bio">{context.bio}</p>
        {:else if context.aesthetic}
          <p class="bic-bio">
            {context.aesthetic}{#if context.lifestyle}
              · {context.lifestyle}{/if}
          </p>
        {/if}
        {#if context.tags.length > 0}
          <div class="bic-tags">
            {#each context.tags.slice(0, compact ? 2 : 3) as tag}
              <span class="bic-tag">{tag}</span>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="bic-actions">
      <a href={profileHref} class="bic-btn bic-btn--primary">View brand profile</a>
      {#if context.instagramUrl}
        <a
          href={context.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="bic-btn bic-btn--ghost"
        >
          Instagram
        </a>
      {/if}
    </div>
  </section>
{/if}

<style>
  .bic {
    margin-bottom: 20px;
    padding: 16px 18px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
  }

  .bic--compact {
    padding: 12px 14px;
    margin-bottom: 14px;
  }

  .bic--loading {
    display: flex;
    gap: 14px;
    align-items: center;
  }

  .bic-main {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .bic--compact .bic-main {
    gap: 10px;
  }

  .bic-avatar {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .bic--compact .bic-avatar {
    width: 44px;
    height: 44px;
  }

  .bic-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .bic-gradient {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bic-initials {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.15);
  }

  .bic-copy {
    flex: 1;
    min-width: 0;
  }

  .bic-kicker {
    margin: 0 0 4px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6b6b72;
  }

  .bic-title {
    margin: 0 0 6px;
    font-size: 14px;
    line-height: 1.45;
    color: #b8b8be;
  }

  .bic--compact .bic-title {
    font-size: 13px;
  }

  .bic-title strong {
    color: #ededef;
    font-weight: 600;
  }

  .bic-handle {
    margin: 0 0 6px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 11px;
    color: #4a4a50;
  }

  .bic-invite-line,
  .bic-bio {
    margin: 0 0 8px;
    font-size: 12px;
    line-height: 1.5;
    color: #8b8b94;
    font-style: italic;
  }

  .bic-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .bic-tag {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    color: #8b8b94;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .bic-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .bic--compact .bic-actions {
    margin-top: 10px;
    padding-top: 10px;
  }

  .bic-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 0 14px;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .bic-btn--primary {
    background: #ededef;
    color: #0a0a0b;
    border: none;
  }

  .bic-btn--ghost {
    background: transparent;
    color: #8b8b94;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .bic-btn:hover {
    opacity: 0.9;
  }

  .bic-sk-avatar {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    animation: bic-pulse 1.2s ease-in-out infinite;
  }

  .bic-sk-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bic-sk-line {
    height: 10px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    animation: bic-pulse 1.2s ease-in-out infinite;
  }

  .bic-sk-line--lg {
    width: 85%;
    height: 14px;
  }

  .bic-sk-line--sm {
    width: 45%;
  }

  @keyframes bic-pulse {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 1;
    }
  }
</style>
