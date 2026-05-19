<script lang="ts">
  import { onMount } from 'svelte';
  import { profile } from '$lib/stores/profile';
  import { Briefcase, Lightning } from 'phosphor-svelte';

  type Brief = {
    campaign_id: string;
    brand_name: string;
    title: string;
    creative_text: string;
    reward_inr: number;
    match_score?: number;
    match_reason?: string;
    brief_status: string;
    created_at: string;
    creatives?: Array<{
      id: string;
      media_type: 'image' | 'video';
      url: string;
      thumb_url?: string | null;
      caption?: string | null;
    }>;
  };

  type DiscoverBrief = {
    id: string;
    brand_name: string;
    title: string;
    creative_text: string;
    reward_inr: number;
    created_at: string;
    creatives?: Array<{
      id: string;
      media_type: 'image' | 'video';
      url: string;
      thumb_url?: string | null;
      caption?: string | null;
    }>;
  };

  let targeted: Brief[] = [];
  let discover: DiscoverBrief[] = [];
  let loading = true;
  let filter: 'all' | 'sent' | 'accepted' | 'completed' = 'all';

  $: filtered = filter === 'all' ? targeted : targeted.filter((b) => b.brief_status === filter);

  function formatInr(amount: number): string {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  onMount(async () => {
    const sub = $profile?.googleSub;
    if (!sub) {
      loading = false;
      return;
    }

    try {
      const [targRes, discRes] = await Promise.all([
        fetch(`/api/user/campaigns?sub=${sub}`),
        fetch(`/api/user/campaigns/discover?sub=${sub}`),
      ]);
      const [targData, discData] = await Promise.all([targRes.json(), discRes.json()]);
      if (targData.ok) targeted = targData.campaigns ?? [];
      if (discData.ok) discover = discData.campaigns ?? [];
    } catch (e) {
      console.error('Failed to load briefs', e);
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Briefs | Wagwan</title>
</svelte:head>

<div class="briefs-page">
  <div class="briefs-header">
    <h1 class="briefs-title">Briefs</h1>
    <div class="briefs-tabs" role="tablist">
      {#each ['all', 'sent', 'accepted', 'completed'] as const as tab}
        <button
          class="briefs-tab"
          class:active={filter === tab}
          role="tab"
          aria-selected={filter === tab}
          on:click={() => (filter = tab)}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      {/each}
    </div>
  </div>

  {#if loading}
    <div class="briefs-loading">
      <span class="loading-dot" />
      <span class="loading-dot" />
      <span class="loading-dot" />
      <p>Loading briefs…</p>
    </div>
  {:else}
    <section class="briefs-section">
      <h2 class="section-label">Your briefs</h2>

      {#if filtered.length === 0}
        <div class="briefs-empty">
          <Briefcase size={40} weight="thin" />
          <p>No briefs here yet. Brands will send you targeted campaigns based on your profile.</p>
        </div>
      {:else}
        <div class="briefs-grid">
          {#each filtered as brief}
            <a href="/briefs/{brief.campaign_id}" class="brief-card">
              <div class="brief-card-top">
                <div class="brief-brand-circle">
                  {brief.brand_name.charAt(0).toUpperCase()}
                </div>
                <div class="brief-meta">
                  <span class="brief-brand-name">{brief.brand_name}</span>
                  <span class="brief-status brief-status--{brief.brief_status}"
                    >{brief.brief_status}</span
                  >
                </div>
                <span class="brief-reward">{formatInr(brief.reward_inr)}</span>
              </div>
              <h3 class="brief-title">{brief.title}</h3>
              <p class="brief-snippet">
                {brief.creative_text.slice(0, 100)}{brief.creative_text.length > 100 ? '…' : ''}
              </p>
              {#if brief.creatives?.[0]}
                <div class="brief-creative-preview">
                  {#if brief.creatives[0].media_type === 'video'}
                    <video src={brief.creatives[0].url} muted preload="metadata"></video>
                  {:else}
                    <img
                      src={brief.creatives[0].thumb_url || brief.creatives[0].url}
                      alt="Brief creative preview"
                    />
                  {/if}
                </div>
              {/if}
              {#if brief.match_score != null}
                <div class="brief-match">
                  <Lightning size={12} weight="fill" />
                  {Math.round(brief.match_score * 100)}% match
                </div>
              {/if}
            </a>
          {/each}
        </div>
      {/if}
    </section>

    {#if discover.length > 0}
      <section class="briefs-section briefs-section--discover">
        <h2 class="section-label">Discover</h2>
        <div class="briefs-grid">
          {#each discover as brief}
            <a href="/briefs/{brief.id}" class="brief-card brief-card--discover">
              <div class="brief-card-top">
                <div class="brief-brand-circle">
                  {brief.brand_name.charAt(0).toUpperCase()}
                </div>
                <div class="brief-meta">
                  <span class="brief-brand-name">{brief.brand_name}</span>
                  <span class="brief-explore">Open</span>
                </div>
                <span class="brief-reward">{formatInr(brief.reward_inr)}</span>
              </div>
              <h3 class="brief-title">{brief.title}</h3>
              <p class="brief-snippet">
                {brief.creative_text.slice(0, 100)}{brief.creative_text.length > 100 ? '…' : ''}
              </p>
              {#if brief.creatives?.[0]}
                <div class="brief-creative-preview">
                  {#if brief.creatives[0].media_type === 'video'}
                    <video src={brief.creatives[0].url} muted preload="metadata"></video>
                  {:else}
                    <img
                      src={brief.creatives[0].thumb_url || brief.creatives[0].url}
                      alt="Brief creative preview"
                    />
                  {/if}
                </div>
              {/if}
              <div class="brief-cta">Explore →</div>
            </a>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .briefs-page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
    font-family: 'Geist', sans-serif;
    color: #ededef;
  }

  .briefs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 2.5rem;
  }

  .briefs-title {
    font-family: 'Bodoni Moda', serif;
    font-size: 2rem;
    font-weight: 600;
    margin: 0;
    color: #ededef;
  }

  .briefs-tabs {
    display: flex;
    gap: 2px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 999px;
    padding: 3px;
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  .briefs-tab {
    background: transparent;
    border: none;
    color: rgba(237, 237, 239, 0.5);
    font-family: 'Geist Mono', monospace;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.35rem 0.9rem;
    border-radius: 999px;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .briefs-tab:hover {
    color: #ededef;
    background: rgba(255, 255, 255, 0.06);
  }

  .briefs-tab.active {
    background: #c4f24a;
    color: #0a0a0a;
  }

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

  .briefs-loading > span {
    display: inline-block;
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

  .briefs-section {
    margin-bottom: 3rem;
  }

  .section-label {
    font-family: 'Geist Mono', monospace;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #9cec7b;
    margin: 0 0 1.25rem;
  }

  .briefs-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem 2rem;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 20px;
    border: 1px dashed rgba(255, 255, 255, 0.08);
    text-align: center;
    color: rgba(237, 237, 239, 0.35);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .briefs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }

  .brief-card {
    display: block;
    text-decoration: none;
    color: inherit;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    padding: 1.25rem 1.4rem;
    transition:
      border-color 0.2s,
      box-shadow 0.2s,
      transform 0.15s;
    cursor: pointer;
  }

  .brief-card:hover {
    border-color: #c4f24a;
    box-shadow:
      0 0 0 1px #c4f24a,
      0 8px 32px rgba(196, 242, 74, 0.08);
    transform: translateY(-2px);
  }

  .brief-card--discover {
    opacity: 0.85;
  }

  .brief-card--discover:hover {
    opacity: 1;
  }

  .brief-card-top {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.9rem;
  }

  .brief-brand-circle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #c4f24a;
    color: #0a0a0a;
    font-family: 'Geist Mono', monospace;
    font-size: 0.85rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .brief-meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1;
    min-width: 0;
  }

  .brief-brand-name {
    font-size: 0.8rem;
    font-weight: 500;
    color: rgba(237, 237, 239, 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .brief-status {
    font-family: 'Geist Mono', monospace;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.15rem 0.5rem;
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

  .brief-status--sent {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(237, 237, 239, 0.5);
  }

  .brief-explore {
    font-family: 'Geist Mono', monospace;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(237, 237, 239, 0.35);
    width: fit-content;
  }

  .brief-reward {
    font-family: 'Bodoni Moda', serif;
    font-size: 1.3rem;
    font-weight: 600;
    color: #c4f24a;
    white-space: nowrap;
    margin-left: auto;
    flex-shrink: 0;
  }

  .brief-title {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    color: #ededef;
    line-height: 1.4;
  }

  .brief-snippet {
    font-size: 0.82rem;
    color: rgba(237, 237, 239, 0.45);
    line-height: 1.6;
    margin: 0 0 0.75rem;
  }

  .brief-match {
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

  .brief-creative-preview {
    margin: 0.6rem 0 0.8rem;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    height: 120px;
  }
  .brief-creative-preview img,
  .brief-creative-preview video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .brief-cta {
    font-family: 'Geist Mono', monospace;
    font-size: 0.72rem;
    color: rgba(237, 237, 239, 0.35);
    letter-spacing: 0.04em;
    transition: color 0.15s;
  }

  .brief-card:hover .brief-cta {
    color: #c4f24a;
  }

  @media (max-width: 640px) {
    .briefs-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .briefs-grid {
      grid-template-columns: 1fr;
    }

    .briefs-title {
      font-size: 1.6rem;
    }
  }
</style>
