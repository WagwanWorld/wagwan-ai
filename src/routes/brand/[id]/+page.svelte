<script lang="ts">
  import type { BrandInviteContext } from '$lib/types/brand-invite';

  export let data: { context: BrandInviteContext; returnPath: string | null };

  $: ctx = data.context;
  $: returnPath = data.returnPath;

  function formatFollowers(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n > 0 ? n.toLocaleString('en-US') : '—';
  }

  function formatReward(inr: number | null): string {
    if (!inr || inr <= 0) return 'Brief-led';
    return inr >= 1000 ? `₹${Math.round(inr / 1000)}K` : `₹${inr.toLocaleString('en-IN')}`;
  }

  function avatarGradient(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    const h2 = (hue + 35) % 360;
    return `linear-gradient(160deg, hsl(${hue}, 40%, 88%), hsl(${h2}, 35%, 78%))`;
  }
</script>

<svelte:head>
  <title>{ctx.name} · Wagwan</title>
</svelte:head>

<div class="bp-root">
  <div class="bp-grad" aria-hidden="true"></div>

  <div class="bp-content">
    <header class="bp-hero">
      <div class="bp-avatar">
        {#if ctx.profilePicture}
          <img src={ctx.profilePicture} alt={ctx.name} class="bp-img" />
        {:else}
          <div class="bp-gradient" style="background: {avatarGradient(ctx.name)}">
            <span class="bp-initials">{ctx.initials}</span>
          </div>
        {/if}
      </div>

      <div class="bp-intro">
        <p class="bp-kicker">Brand on Wagwan</p>
        <h1 class="bp-name">{ctx.name}</h1>
        {#if ctx.handle}
          <p class="bp-handle">@{ctx.handle}</p>
        {/if}
        {#if ctx.followers > 0}
          <p class="bp-stat">{formatFollowers(ctx.followers)} followers</p>
        {/if}
        {#if ctx.bio}
          <p class="bp-bio">{ctx.bio}</p>
        {/if}
      </div>
    </header>

    {#if ctx.aesthetic || ctx.lifestyle}
      <section class="bp-signals">
        {#if ctx.aesthetic}
          <div class="bp-signal">
            <span class="bp-label">Aesthetic</span>
            <span class="bp-signal-val">{ctx.aesthetic}</span>
          </div>
        {/if}
        {#if ctx.lifestyle}
          <div class="bp-signal">
            <span class="bp-label">Lifestyle</span>
            <span class="bp-signal-val">{ctx.lifestyle}</span>
          </div>
        {/if}
        {#if ctx.colorPalette.length > 0}
          <div class="bp-signal bp-signal--palette">
            <span class="bp-label">Visual palette</span>
            <div class="bp-palette">
              {#each ctx.colorPalette as color}
                <span class="bp-dot" style="background: {color}"></span>
              {/each}
            </div>
          </div>
        {/if}
      </section>
    {/if}

    {#if ctx.tags.length > 0}
      <section class="bp-section">
        <span class="bp-label">Focus</span>
        <div class="bp-tags">
          {#each ctx.tags as tag}
            <span class="bp-tag">{tag}</span>
          {/each}
        </div>
      </section>
    {/if}

    <section class="bp-section bp-match">
      <p class="bp-match-line">{ctx.matchLine}</p>
      <p class="bp-reward">{ctx.rewardRange}</p>
    </section>

    {#if ctx.campaigns.length > 0}
      <section class="bp-section">
        <div class="bp-section-head">
          <span class="bp-label">Active campaigns</span>
          <span class="bp-count">{ctx.activeCampaignCount}</span>
        </div>
        <ul class="bp-campaigns">
          {#each ctx.campaigns as campaign}
            <li class="bp-campaign">
              <div class="bp-campaign-top">
                <h2 class="bp-campaign-title">{campaign.title}</h2>
                <span class="bp-campaign-reward">{formatReward(campaign.rewardInr)}</span>
              </div>
              {#if campaign.creativeText}
                <p class="bp-campaign-text">{campaign.creativeText}</p>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {:else if ctx.latestBrief}
      <section class="bp-section">
        <span class="bp-label">Latest brief</span>
        <p class="bp-brief">{ctx.latestBrief}</p>
      </section>
    {/if}

    <footer class="bp-footer">
      {#if returnPath}
        <a href={returnPath} class="bp-cta bp-cta--primary">Continue invite</a>
      {/if}
      {#if ctx.instagramUrl}
        <a
          href={ctx.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="bp-cta bp-cta--ghost"
        >
          Open on Instagram
        </a>
      {/if}
      <a href="/" class="bp-cta bp-cta--ghost">Wagwan home</a>
    </footer>
  </div>
</div>

<style>
  .bp-root {
    min-height: 100dvh;
    position: relative;
    background: #0a0a0b;
    color: #ededef;
  }

  .bp-grad {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(120, 80, 200, 0.12), transparent),
      radial-gradient(ellipse 60% 40% at 100% 100%, rgba(200, 100, 80, 0.08), transparent);
    pointer-events: none;
  }

  .bp-content {
    position: relative;
    z-index: 1;
    max-width: 32rem;
    margin: 0 auto;
    padding: 2.5rem 1.25rem 4rem;
  }

  .bp-hero {
    display: flex;
    gap: 1.25rem;
    align-items: flex-start;
    margin-bottom: 1.75rem;
  }

  .bp-avatar {
    width: 88px;
    height: 88px;
    border-radius: 16px;
    overflow: hidden;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .bp-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .bp-gradient {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bp-initials {
    font-size: 2rem;
    font-weight: 300;
    color: rgba(255, 255, 255, 0.1);
  }

  .bp-kicker {
    margin: 0 0 6px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  .bp-name {
    margin: 0 0 4px;
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }

  .bp-handle {
    margin: 0 0 6px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 12px;
    color: #6b6b72;
  }

  .bp-stat {
    margin: 0 0 10px;
    font-size: 13px;
    color: #8b8b94;
  }

  .bp-bio {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: #6b6b72;
  }

  .bp-signals {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    margin-bottom: 1.25rem;
  }

  .bp-signal {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bp-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  .bp-signal-val {
    font-size: 14px;
    color: #b8b8be;
  }

  .bp-palette {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .bp-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .bp-section {
    margin-bottom: 1.5rem;
  }

  .bp-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .bp-tag {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #8b8b94;
  }

  .bp-match {
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid rgba(201, 184, 150, 0.15);
    background: rgba(201, 184, 150, 0.06);
  }

  .bp-match-line {
    margin: 0 0 6px;
    font-size: 13px;
    line-height: 1.5;
    color: #c9b896;
  }

  .bp-reward {
    margin: 0;
    font-size: 12px;
    color: #6b6b72;
  }

  .bp-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .bp-count {
    font-size: 11px;
    color: #6b6b72;
  }

  .bp-campaigns {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bp-campaign {
    padding: 14px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.2);
  }

  .bp-campaign-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
  }

  .bp-campaign-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #ededef;
    line-height: 1.3;
  }

  .bp-campaign-reward {
    font-size: 11px;
    font-weight: 600;
    color: #c9b896;
    flex-shrink: 0;
  }

  .bp-campaign-text {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #6b6b72;
  }

  .bp-brief {
    margin: 8px 0 0;
    font-size: 14px;
    color: #b8b8be;
  }

  .bp-footer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .bp-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    text-align: center;
  }

  .bp-cta--primary {
    background: #ededef;
    color: #0a0a0b;
  }

  .bp-cta--ghost {
    background: transparent;
    color: #8b8b94;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
</style>
