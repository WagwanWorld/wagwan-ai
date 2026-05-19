<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { profile } from '$lib/stores/profile';
  import { ArrowLeft, CheckCircle, InstagramLogo, Lightning } from 'phosphor-svelte';

  let campaign: any = null;
  let briefResponse: any = null;
  let match: any = null;
  let creatives: Array<{
    id: string;
    media_type: 'image' | 'video';
    url: string;
    thumb_url?: string | null;
    caption?: string | null;
  }> = [];
  let personalizedText = '';
  let personalizing = false;
  let loading = true;
  let acting = false;
  let igPostUrl = '';

  function formatInr(amount: number): string {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  async function loadBrief() {
    const sub = $profile?.googleSub;
    if (!sub) {
      loading = false;
      return;
    }

    try {
      const res = await fetch(`/api/user/campaigns/${$page.params.id}?sub=${sub}`);
      const data = await res.json();

      if (data.ok) {
        campaign = data.campaign ?? null;
        briefResponse = data.briefResponse ?? null;
        match = data.match ?? null;
        creatives = data.creatives ?? [];
      }

      if (match) {
        personalizing = true;
        try {
          const pbRes = await fetch('/api/brand/member-brief', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sub,
              campaignId: $page.params.id,
              brandName: campaign?.brand_name ?? '',
            }),
          });
          const pbData = await pbRes.json();
          if (pbData.ok) personalizedText = pbData.brief ?? '';
        } catch (e) {
          console.error('Failed to load personalized brief', e);
        } finally {
          personalizing = false;
        }
      }
    } catch (e) {
      console.error('Failed to load brief', e);
    } finally {
      loading = false;
    }
  }

  async function respond(action: 'accept' | 'decline' | 'request_changes') {
    if (acting) return;
    const sub = $profile?.googleSub;
    if (!sub) return;
    acting = true;
    try {
      const res = await fetch('/api/creator/brief-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub, campaignId: $page.params.id, action }),
      });
      const data = await res.json();
      if (data.ok)
        briefResponse = {
          ...briefResponse,
          ...data.brief,
          status: action === 'accept' ? 'accepted' : 'declined',
        };
    } catch (e) {
      console.error('Failed to respond to brief', e);
    } finally {
      acting = false;
    }
  }

  async function submitProof() {
    if (acting || !igPostUrl.trim()) return;
    const sub = $profile?.googleSub;
    if (!sub) return;
    acting = true;
    try {
      const res = await fetch('/api/creator/brief-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub,
          campaignId: $page.params.id,
          action: 'complete',
          igPostUrl: igPostUrl.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok)
        briefResponse = {
          ...briefResponse,
          ...data.brief,
          status: 'completed',
          ig_post_url: igPostUrl.trim(),
        };
    } catch (e) {
      console.error('Failed to submit proof', e);
    } finally {
      acting = false;
    }
  }

  onMount(() => {
    loadBrief();
  });
</script>

<svelte:head>
  <title>{campaign?.title ?? 'Brief'} | Wagwan</title>
</svelte:head>

<div class="brief-detail">
  <a href="/briefs" class="brief-back">
    <ArrowLeft size={14} weight="bold" />
    All briefs
  </a>

  {#if loading}
    <div class="briefs-loading">
      <span class="loading-dot" />
      <span class="loading-dot" />
      <span class="loading-dot" />
      <p>Loading brief…</p>
    </div>
  {:else if !campaign}
    <div class="brief-not-found">
      <p>Brief not found.</p>
    </div>
  {:else}
    <!-- Hero -->
    <div class="brief-hero">
      <div class="brief-hero-top">
        <div class="brief-brand-circle">
          {campaign.brand_name?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div class="brief-hero-meta">
          <span class="brief-hero-brand">{campaign.brand_name}</span>
          {#if briefResponse?.status}
            <span class="brief-status brief-status--{briefResponse.status}"
              >{briefResponse.status}</span
            >
          {/if}
        </div>
      </div>

      <h1 class="brief-hero-title">{campaign.title}</h1>
      <div class="brief-hero-reward">{formatInr(campaign.reward_inr)}</div>

      {#if match}
        <div class="brief-match-row">
          <span class="brief-match-score">
            <Lightning size={12} weight="fill" />
            {Math.round((match.score ?? 0) * 100)}% match
          </span>
          {#if match.reason}
            <span class="brief-match-reason">{match.reason}</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Campaign details -->
    <div class="brief-section">
      <p class="brief-section-label">Campaign Details</p>
      <p class="brief-body">{campaign.creative_text}</p>

      {#if campaign.channels?.length}
        <div class="brief-channels">
          {#each campaign.channels as ch}
            <span class="brief-channel-pill">{ch}</span>
          {/each}
        </div>
      {/if}
    </div>

    {#if creatives.length > 0}
      <div class="brief-section">
        <p class="brief-section-label">Attached Creatives</p>
        <div class="brief-creative-grid">
          {#each creatives as creative}
            <article class="brief-creative-card">
              {#if creative.media_type === 'video'}
                <video class="brief-creative-media" src={creative.url} controls preload="metadata"
                ></video>
              {:else}
                <img
                  class="brief-creative-media"
                  src={creative.thumb_url || creative.url}
                  alt={creative.caption || 'Brief creative'}
                />
              {/if}
              {#if creative.caption}
                <p class="brief-creative-caption">{creative.caption}</p>
              {/if}
            </article>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Personalized section -->
    {#if match}
      <div class="brief-section">
        <p class="brief-section-label">Personalized for You</p>
        {#if personalizing}
          <div class="brief-shimmer">
            <div class="shimmer-line shimmer-line--lg"></div>
            <div class="shimmer-line"></div>
            <div class="shimmer-line shimmer-line--sm"></div>
          </div>
        {:else if personalizedText}
          <div class="brief-body brief-body--personalized">
            {personalizedText}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Actions -->
    <div class="brief-action-section">
      {#if !match && !briefResponse}
        <p class="brief-discover-note">
          This brief wasn't sent to you — you're viewing it as a discovery.
        </p>
      {:else if briefResponse?.status === 'sent' || (!briefResponse?.status && match)}
        <div class="brief-action-btns">
          <button
            class="brief-btn brief-btn--accept"
            disabled={acting}
            on:click={() => respond('accept')}
          >
            <CheckCircle size={16} weight="fill" />
            Accept Brief
          </button>
          <button
            class="brief-btn brief-btn--decline"
            disabled={acting}
            on:click={() => respond('decline')}
          >
            Decline
          </button>
          <button
            class="brief-btn brief-btn--secondary"
            disabled={acting}
            on:click={() => respond('request_changes')}
          >
            Request changes
          </button>
        </div>
      {:else if briefResponse?.status === 'accepted'}
        <div class="brief-info-msg">
          <p>You've accepted this brief. Waiting for the brand to mark it live.</p>
        </div>
      {:else if briefResponse?.status === 'live'}
        <div class="brief-proof-form">
          <p class="brief-section-label">Submit Proof</p>
          <p class="brief-proof-hint">Post on Instagram and paste the link below.</p>
          <div class="brief-proof-row">
            <div class="brief-input-wrapper">
              <InstagramLogo size={16} weight="fill" class="brief-input-icon" />
              <input
                type="url"
                class="brief-proof-input"
                placeholder="https://www.instagram.com/p/…"
                bind:value={igPostUrl}
              />
            </div>
            <button
              class="brief-btn brief-btn--accept"
              disabled={acting || !igPostUrl.trim()}
              on:click={submitProof}
            >
              Submit Proof
            </button>
          </div>
        </div>
      {:else if briefResponse?.status === 'completed'}
        <div class="brief-completed">
          <CheckCircle size={24} weight="fill" color="#9cec7b" />
          <div class="brief-completed-info">
            <p class="brief-completed-title">Campaign complete</p>
            <p class="brief-completed-earned">You earned {formatInr(campaign.reward_inr)}</p>
          </div>
          {#if briefResponse.ig_post_url}
            <a
              href={briefResponse.ig_post_url}
              target="_blank"
              rel="noopener noreferrer"
              class="brief-view-post"
            >
              View post →
            </a>
          {/if}
        </div>
      {:else if briefResponse?.status === 'declined'}
        <p class="brief-declined-note">You declined this brief.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .brief-detail {
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem 1.5rem 6rem;
    font-family: 'Geist', sans-serif;
    color: #ededef;
  }

  /* Back link */
  .brief-back {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: 'Geist Mono', monospace;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(237, 237, 239, 0.4);
    text-decoration: none;
    margin-bottom: 2.5rem;
    transition: color 0.15s;
  }

  .brief-back:hover {
    color: #c4f24a;
  }

  /* Loading */
  .briefs-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 4rem 0;
    color: rgba(237, 237, 239, 0.4);
    font-family: 'Geist Mono', monospace;
    font-size: 0.8rem;
  }

  .loading-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #c4f24a;
    display: inline-block;
    margin: 0 3px;
    animation: pulse 1.2s ease-in-out infinite;
  }

  .loading-dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  .loading-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse {
    0%,
    80%,
    100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    40% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .brief-not-found {
    padding: 3rem 0;
    color: rgba(237, 237, 239, 0.4);
    font-size: 0.9rem;
  }

  /* Hero */
  .brief-hero {
    margin-bottom: 48px;
  }

  .brief-hero-top {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .brief-brand-circle {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #c4f24a;
    color: #0a0a0a;
    font-family: 'Geist Mono', monospace;
    font-size: 1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .brief-hero-meta {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .brief-hero-brand {
    font-size: 0.85rem;
    font-weight: 500;
    color: rgba(237, 237, 239, 0.65);
  }

  .brief-status {
    font-family: 'Geist Mono', monospace;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    width: fit-content;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(237, 237, 239, 0.5);
  }

  .brief-status--accepted {
    background: rgba(156, 236, 123, 0.12);
    color: #9cec7b;
  }

  .brief-status--completed {
    background: rgba(196, 242, 74, 0.12);
    color: #c4f24a;
  }

  .brief-status--live {
    background: rgba(196, 242, 74, 0.16);
    color: #c4f24a;
  }

  .brief-status--sent {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(237, 237, 239, 0.5);
  }

  .brief-status--declined {
    background: rgba(255, 80, 80, 0.08);
    color: rgba(255, 130, 130, 0.7);
  }

  .brief-hero-title {
    font-family: 'Bodoni Moda', serif;
    font-size: clamp(1.6rem, 3.2vw, 2.4rem);
    font-weight: 600;
    margin: 0 0 0.6rem;
    color: #ededef;
    line-height: 1.2;
  }

  .brief-hero-reward {
    font-family: 'Bodoni Moda', serif;
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 600;
    color: #c4f24a;
    margin-bottom: 1rem;
    line-height: 1;
  }

  .brief-match-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .brief-match-score {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: 'Geist Mono', monospace;
    font-size: 0.68rem;
    color: #c4f24a;
    background: rgba(196, 242, 74, 0.1);
    border: 1px solid rgba(196, 242, 74, 0.2);
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
  }

  .brief-match-reason {
    font-size: 0.82rem;
    color: rgba(237, 237, 239, 0.5);
    line-height: 1.5;
  }

  /* Sections */
  .brief-section {
    margin-bottom: 48px;
    padding-bottom: 48px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .brief-section:last-child {
    border-bottom: none;
  }

  .brief-section-label {
    font-family: 'Geist Mono', monospace;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #9cec7b;
    margin: 0 0 1rem;
  }

  .brief-body {
    font-size: 15px;
    line-height: 1.7;
    color: rgba(237, 237, 239, 0.8);
    max-width: 65ch;
    margin: 0;
    white-space: pre-line;
  }

  .brief-body--personalized {
    background: rgba(196, 242, 74, 0.04);
    border: 1px solid rgba(196, 242, 74, 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    max-width: none;
  }

  /* Channels */
  .brief-channels {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1.25rem;
  }

  .brief-channel-pill {
    font-family: 'Geist Mono', monospace;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 0.25rem 0.7rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: rgba(237, 237, 239, 0.55);
  }

  /* Shimmer */
  .brief-shimmer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    background: rgba(196, 242, 74, 0.03);
    border: 1px solid rgba(196, 242, 74, 0.08);
    border-radius: 16px;
  }

  .shimmer-line {
    height: 14px;
    border-radius: 6px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.04) 0%,
      rgba(196, 242, 74, 0.1) 50%,
      rgba(255, 255, 255, 0.04) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.6s linear infinite;
    width: 100%;
  }

  .shimmer-line--lg {
    height: 16px;
  }
  .shimmer-line--sm {
    width: 60%;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% center;
    }
    100% {
      background-position: -200% center;
    }
  }

  /* Action section */
  .brief-action-section {
    padding-top: 0.5rem;
  }

  .brief-action-btns {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .brief-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: 'Geist', sans-serif;
    font-size: 0.88rem;
    font-weight: 600;
    padding: 0.65rem 1.5rem;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    transition:
      transform 0.15s,
      box-shadow 0.15s,
      background 0.15s,
      border-color 0.15s;
  }

  .brief-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .brief-btn--accept {
    background: #c4f24a;
    color: #0a0a0a;
  }

  .brief-btn--accept:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(196, 242, 74, 0.3);
  }

  .brief-btn--decline {
    background: transparent;
    color: rgba(237, 237, 239, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .brief-btn--decline:hover:not(:disabled) {
    border-color: #e040fb;
    color: #e040fb;
  }
  .brief-btn--secondary {
    background: rgba(77, 124, 255, 0.12);
    color: #9eb8ff;
    border: 1px solid rgba(77, 124, 255, 0.35);
  }
  .brief-btn--secondary:hover:not(:disabled) {
    background: rgba(77, 124, 255, 0.2);
  }

  /* Info message */
  .brief-info-msg {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 1rem 1.25rem;
  }

  .brief-info-msg p {
    margin: 0;
    font-size: 0.88rem;
    color: rgba(237, 237, 239, 0.55);
    line-height: 1.5;
  }

  /* Proof form */
  .brief-proof-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .brief-proof-hint {
    font-size: 0.82rem;
    color: rgba(237, 237, 239, 0.45);
    margin: 0;
    line-height: 1.5;
  }

  .brief-proof-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .brief-input-wrapper {
    position: relative;
    flex: 1;
    min-width: 220px;
  }

  .brief-input-wrapper :global(.brief-input-icon) {
    position: absolute;
    left: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(237, 237, 239, 0.3);
    pointer-events: none;
  }

  .brief-proof-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    padding: 0.65rem 1rem 0.65rem 2.4rem;
    font-family: 'Geist', sans-serif;
    font-size: 0.85rem;
    color: #ededef;
    outline: none;
    box-sizing: border-box;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .brief-proof-input::placeholder {
    color: rgba(237, 237, 239, 0.3);
  }

  .brief-proof-input:focus {
    border-color: #c4f24a;
    box-shadow: 0 0 0 3px rgba(196, 242, 74, 0.1);
  }

  /* Completed */
  .brief-completed {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: rgba(156, 236, 123, 0.06);
    border: 1px solid rgba(156, 236, 123, 0.15);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 18px;
    padding: 1.25rem 1.5rem;
    flex-wrap: wrap;
  }

  .brief-completed-info {
    flex: 1;
    min-width: 0;
  }

  .brief-completed-title {
    font-size: 0.88rem;
    font-weight: 600;
    margin: 0 0 0.2rem;
    color: #9cec7b;
  }

  .brief-completed-earned {
    font-family: 'Bodoni Moda', serif;
    font-size: 1.4rem;
    font-weight: 600;
    color: #c4f24a;
    margin: 0;
  }

  .brief-view-post {
    font-family: 'Geist Mono', monospace;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(237, 237, 239, 0.5);
    text-decoration: none;
    transition: color 0.15s;
    white-space: nowrap;
  }

  .brief-view-post:hover {
    color: #c4f24a;
  }

  /* Discover / declined notes */
  .brief-discover-note,
  .brief-declined-note {
    font-size: 0.85rem;
    color: rgba(237, 237, 239, 0.35);
    line-height: 1.5;
    margin: 0;
  }

  .brief-creative-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    margin-top: 1rem;
  }
  .brief-creative-card {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
  }
  .brief-creative-media {
    display: block;
    width: 100%;
    height: 180px;
    object-fit: cover;
    background: rgba(0, 0, 0, 0.3);
  }
  .brief-creative-caption {
    margin: 0;
    padding: 10px 12px;
    color: rgba(237, 237, 239, 0.65);
    font-size: 0.8rem;
    line-height: 1.4;
  }

  /* Mobile */
  @media (max-width: 640px) {
    .brief-detail {
      padding-bottom: 7rem;
    }

    .brief-action-btns {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 1rem 1.25rem calc(env(safe-area-inset-bottom) + 1rem);
      background: rgba(10, 10, 10, 0.92);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255, 255, 255, 0.07);
      flex-direction: column;
      z-index: 50;
    }

    .brief-btn {
      width: 100%;
      justify-content: center;
    }

    .brief-proof-row {
      flex-direction: column;
      align-items: stretch;
    }

    .brief-input-wrapper {
      min-width: 0;
      width: 100%;
    }
  }
</style>
