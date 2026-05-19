<script lang="ts">
  import type { CreatorCardView } from '$lib/utils/creatorCardView';

  export let creator: CreatorCardView;
  export let barMetric: 'strength' | 'fit' = 'strength';
  export let compact = false;

  $: barPct = Math.min(
    100,
    Math.max(
      0,
      barMetric === 'fit' && creator.fitScore != null ? creator.fitScore : creator.strength,
    ),
  );
  $: barLabel =
    barMetric === 'fit' && creator.fitLabel ? creator.fitLabel : `${creator.strengthLabel} signal`;

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
    return n > 0 ? n.toLocaleString('en-US') : '—';
  }
</script>

<section class="cfc" class:cfc--compact={compact}>
  <div class="cfc-edge"></div>
  <div class="cfc-inner">
    <div class="cfc-avatar">
      {#if creator.profilePicture}
        <img src={creator.profilePicture} alt={creator.name} class="cfc-img" />
      {:else}
        <div class="cfc-gradient" style="background: {avatarGradient(creator.name)}">
          <span class="cfc-initial">{creator.initial}</span>
        </div>
      {/if}
    </div>

    <div class="cfc-body">
      {#if creator.label}
        <span class="cfc-label">{creator.label}</span>
      {/if}
      <h2 class="cfc-name">{creator.name}</h2>
      <div class="cfc-meta">
        {#if creator.handle}<span class="cfc-handle">@{creator.handle}</span>{/if}
        {#if creator.location}<span class="cfc-loc">{creator.location}</span>{/if}
        {#if creator.creatorTier}<span class="cfc-tier">{creator.creatorTier}</span>{/if}
        {#if creator.fitLabel && barMetric === 'fit'}
          <span class="cfc-fit-pill">{creator.fitLabel}</span>
        {/if}
      </div>

      <div class="cfc-stats">
        <div class="cfc-stat">
          <span class="cfc-stat-num">{formatFollowers(creator.followers)}</span>
          <span class="cfc-label">Followers</span>
        </div>
        <div class="cfc-stat">
          <span class="cfc-stat-num"
            >{creator.mediaCount > 0
              ? creator.mediaCount.toLocaleString()
              : creator.postsDisplay}</span
          >
          <span class="cfc-label">Posts</span>
        </div>
        <div class="cfc-stat">
          <span class="cfc-stat-num">{Math.round(creator.strength)}</span>
          <span class="cfc-label">Signal</span>
        </div>
        {#if creator.engagementTier}
          <div class="cfc-stat">
            <span
              class="cfc-stat-num cfc-stat-num--tier"
              data-tier={creator.engagementTier.toLowerCase()}
            >
              {creator.engagementTier}
            </span>
            <span class="cfc-label">Engagement</span>
          </div>
        {:else if creator.fitScore != null}
          <div class="cfc-stat">
            <span class="cfc-stat-num">{creator.fitScore}</span>
            <span class="cfc-label">Fit</span>
          </div>
        {/if}
      </div>

      <div class="cfc-strength">
        <div class="cfc-strength-track">
          <span class="cfc-strength-fill" style="width: {barPct}%"></span>
        </div>
        <span class="cfc-strength-label">{barLabel}</span>
      </div>

      {#if creator.feedSummary}
        <p class="cfc-feed">{creator.feedSummary}</p>
      {/if}

      {#if creator.bio}
        <p class="cfc-bio">{creator.bio}</p>
      {:else if creator.archetype}
        <p class="cfc-archetype">&ldquo;{creator.archetype}&rdquo;</p>
      {/if}

      <div class="cfc-tags">
        {#if creator.aesthetic}
          <span class="cfc-pill cfc-pill--accent">{creator.aesthetic}</span>
        {/if}
        {#if creator.lifestyle}
          <span class="cfc-pill cfc-pill--accent">{creator.lifestyle}</span>
        {/if}
        {#each creator.vibeTags.slice(0, 3) as tag}
          <span class="cfc-pill cfc-pill--lime">{tag}</span>
        {/each}
        {#each creator.interests.slice(0, 5) as interest}
          <span class="cfc-pill">{interest}</span>
        {/each}
        {#each creator.contentTags.slice(0, 5) as tag}
          <span class="cfc-pill">{tag}</span>
        {/each}
      </div>

      {#if creator.archetype && creator.bio}
        <p class="cfc-archetype cfc-archetype--block">&ldquo;{creator.archetype}&rdquo;</p>
      {/if}

      {#if creator.colorPalette.length > 0}
        <div class="cfc-palette-row">
          <span class="cfc-label">Visual Palette</span>
          <div class="cfc-palette-dots">
            {#each creator.colorPalette as color}
              <span class="cfc-palette-dot" style="background: {color}"></span>
            {/each}
          </div>
        </div>
      {/if}

      {#if $$slots.actions}
        <div class="cfc-actions">
          <slot name="actions" />
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .cfc {
    position: relative;
    overflow: hidden;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    box-shadow:
      0 1px 0 0 rgba(255, 255, 255, 0.03) inset,
      0 4px 16px rgba(0, 0, 0, 0.12);
    margin-bottom: 0;
  }

  .cfc-edge {
    position: absolute;
    top: 0;
    left: 16px;
    right: 16px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
    pointer-events: none;
  }

  .cfc-inner {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 28px;
    padding: 28px 32px;
  }

  .cfc--compact .cfc-inner {
    grid-template-columns: 140px 1fr;
    gap: 20px;
    padding: 20px 24px;
  }

  .cfc--compact .cfc-avatar {
    width: 140px;
    height: 140px;
  }

  @media (max-width: 720px) {
    .cfc-inner {
      grid-template-columns: 1fr;
    }
    .cfc-avatar {
      width: 100%;
      max-width: 200px;
      height: 200px;
    }
  }

  .cfc-avatar {
    width: 200px;
    height: 200px;
    border-radius: 16px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .cfc-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cfc-gradient {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cfc-initial {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 4rem;
    font-weight: 300;
    color: rgba(255, 255, 255, 0.08);
  }

  .cfc--compact .cfc-initial {
    font-size: 3rem;
  }

  .cfc-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .cfc-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  .cfc-name {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.03em;
    color: #ededef;
    margin: 0;
    line-height: 1.1;
  }

  .cfc--compact .cfc-name {
    font-size: 22px;
  }

  .cfc-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .cfc-handle {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 12px;
    color: #4a4a50;
  }

  .cfc-loc {
    font-size: 12px;
    color: #3a3a40;
    font-style: italic;
  }

  .cfc-tier {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #e8833a;
  }

  .cfc-fit-pill {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #c9b896;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(201, 184, 150, 0.12);
  }

  .cfc-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 28px;
    padding: 12px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.03);
  }

  .cfc-stat {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .cfc-stat-num {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 22px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: #ededef;
    line-height: 1;
  }

  .cfc-stat-num--tier {
    font-size: 14px;
    text-transform: uppercase;
    color: rgba(110, 231, 183, 0.85);
  }

  .cfc-strength {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cfc-strength-track {
    flex: 1;
    height: 2px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 1px;
    overflow: hidden;
  }

  .cfc-strength-fill {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #65ec7a, #c4f24a 58%, #ffbe1b);
    border-radius: 1px;
    transition: width 0.7s ease;
  }

  .cfc-strength-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 500;
    color: #3a3a40;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  .cfc-feed {
    font-size: 12px;
    color: #8b8b94;
    line-height: 1.5;
    margin: 0;
    font-style: italic;
  }

  .cfc-bio {
    font-size: 13px;
    color: #4a4a50;
    line-height: 1.55;
    margin: 0;
  }

  .cfc-archetype {
    font-style: italic;
    font-size: 15px;
    font-weight: 300;
    color: #8a8a92;
    margin: 0;
    line-height: 1.4;
  }

  .cfc-archetype--block {
    font-size: 13px;
    color: #c4f24a;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    font-style: normal;
  }

  .cfc-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .cfc-pill {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 4px 11px;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.03);
    background: rgba(255, 255, 255, 0.025);
    color: #4a4a50;
  }

  .cfc-pill--accent {
    border-color: rgba(255, 64, 64, 0.15);
    color: rgba(255, 125, 125, 0.85);
  }

  .cfc-pill--lime {
    background: rgba(196, 242, 74, 0.1);
    color: #c4f24a;
    border-color: rgba(196, 242, 74, 0.2);
  }

  .cfc-palette-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .cfc-palette-dots {
    display: flex;
    gap: 6px;
  }

  .cfc-palette-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .cfc-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }
</style>
