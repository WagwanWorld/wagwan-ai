<script lang="ts">
  import { onMount } from 'svelte';
  import Heart from 'phosphor-svelte/lib/Heart';
  import ChatCircle from 'phosphor-svelte/lib/ChatCircle';
  import TrendUp from 'phosphor-svelte/lib/TrendUp';
  import CalendarCheck from 'phosphor-svelte/lib/CalendarCheck';
  import ImageSquare from 'phosphor-svelte/lib/ImageSquare';
  import Users from 'phosphor-svelte/lib/Users';
  import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';
  import Sparkle from 'phosphor-svelte/lib/Sparkle';
  import Eye from 'phosphor-svelte/lib/Eye';
  import Palette from 'phosphor-svelte/lib/Palette';

  let loading = true;
  let extracting = false;
  let error = '';
  let extractMsg = '';
  let profileData: {
    profile: {
      username: string; name: string; biography: string;
      profilePicture: string; followersCount: number;
      followingCount: number; mediaCount: number;
    };
    engagement: {
      avgEngagement: number; engagementRate: string;
      totalLikes: number; totalComments: number; postsPerWeek: number;
    };
    recentPosts: Array<{
      id: string; caption: string; media_type: string;
      timestamp: string; like_count: number; comments_count: number;
      permalink: string; thumbnail_url?: string; media_url?: string;
    }>;
    scheduling: { scheduled: number; published: number; total: number };
    brandIdentity: Record<string, unknown> | null;
    identityUpdatedAt: string | null;
  } | null = null;

  async function loadStats() {
    loading = true;
    error = '';
    try {
      const res = await fetch('/api/brand/profile-stats');
      const data = await res.json();
      if (data.ok) profileData = data;
      else error = data.error || 'Failed to load stats';
    } catch {
      error = 'Network error';
    } finally {
      loading = false;
    }
  }

  async function extractIdentity() {
    extracting = true;
    extractMsg = '';
    try {
      const res = await fetch('/api/brand/extract-identity', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        extractMsg = 'Brand identity extracted!';
        await loadStats();
      } else {
        extractMsg = `Failed: ${data.error || 'Unknown error'}`;
      }
    } catch {
      extractMsg = 'Network error';
    } finally {
      extracting = false;
    }
  }

  onMount(loadStats);

  $: identity = profileData?.brandIdentity;
  $: hasIdentity = identity && Object.keys(identity).length > 1;
</script>

<div class="brand-profile">
  {#if loading}
    <div class="bp-loading">Loading profile...</div>
  {:else if error}
    <div class="bp-error">{error}</div>
  {:else if profileData}
    <!-- Profile header -->
    <div class="bp-header">
      <img src={profileData.profile.profilePicture} alt="" class="bp-avatar" />
      <div class="bp-header-info">
        <h2 class="bp-username">@{profileData.profile.username}</h2>
        {#if profileData.profile.name}
          <p class="bp-name">{profileData.profile.name}</p>
        {/if}
        {#if profileData.profile.biography}
          <p class="bp-bio">{profileData.profile.biography}</p>
        {/if}
      </div>
      <button class="bp-refresh" on:click={loadStats} title="Refresh">
        <ArrowClockwise size={16} />
      </button>
    </div>

    <!-- Account stats -->
    <div class="bp-stats-row">
      <div class="bp-stat">
        <Users size={16} />
        <span class="bp-stat-value">{profileData.profile.followersCount.toLocaleString()}</span>
        <span class="bp-stat-label">Followers</span>
      </div>
      <div class="bp-stat">
        <Users size={16} />
        <span class="bp-stat-value">{profileData.profile.followingCount.toLocaleString()}</span>
        <span class="bp-stat-label">Following</span>
      </div>
      <div class="bp-stat">
        <ImageSquare size={16} />
        <span class="bp-stat-value">{profileData.profile.mediaCount.toLocaleString()}</span>
        <span class="bp-stat-label">Posts</span>
      </div>
    </div>

    <!-- Engagement stats -->
    <div class="bp-section-label">Engagement (last 10 posts)</div>
    <div class="bp-stats-row">
      <div class="bp-stat">
        <TrendUp size={16} />
        <span class="bp-stat-value">{profileData.engagement.engagementRate}%</span>
        <span class="bp-stat-label">Engagement rate</span>
      </div>
      <div class="bp-stat">
        <Heart size={16} />
        <span class="bp-stat-value">{profileData.engagement.avgEngagement}</span>
        <span class="bp-stat-label">Avg per post</span>
      </div>
      <div class="bp-stat">
        <ChatCircle size={16} />
        <span class="bp-stat-value">{profileData.engagement.postsPerWeek}/wk</span>
        <span class="bp-stat-label">Post frequency</span>
      </div>
    </div>

    <!-- Scheduling stats -->
    <div class="bp-section-label">Content scheduling</div>
    <div class="bp-stats-row">
      <div class="bp-stat">
        <CalendarCheck size={16} />
        <span class="bp-stat-value">{profileData.scheduling.scheduled}</span>
        <span class="bp-stat-label">Scheduled</span>
      </div>
      <div class="bp-stat">
        <TrendUp size={16} />
        <span class="bp-stat-value">{profileData.scheduling.published}</span>
        <span class="bp-stat-label">Published</span>
      </div>
      <div class="bp-stat">
        <ImageSquare size={16} />
        <span class="bp-stat-value">{profileData.scheduling.total}</span>
        <span class="bp-stat-label">Total</span>
      </div>
    </div>

    <!-- Brand Identity Signal Hub -->
    <div class="bp-section-label">
      <span>Brand identity signals</span>
      {#if profileData.identityUpdatedAt}
        <span class="bp-updated">Updated {new Date(profileData.identityUpdatedAt).toLocaleDateString()}</span>
      {/if}
    </div>

    {#if !hasIdentity}
      <div class="bp-extract-cta">
        <p>Run the identity pipeline to extract your brand's aesthetic, voice, personality, and visual signals from Instagram. This powers better caption generation and creator matching.</p>
        <button class="bp-extract-btn" on:click={extractIdentity} disabled={extracting}>
          <Sparkle size={16} weight="bold" />
          {extracting ? 'Analyzing your brand...' : 'Extract brand identity'}
        </button>
        {#if extractMsg}<p class="bp-extract-msg">{extractMsg}</p>{/if}
      </div>
    {:else}
      <div class="bp-identity-grid">
        {#if identity?.aesthetic}
          <div class="bp-signal-card">
            <div class="bp-signal-icon"><Palette size={16} /></div>
            <div class="bp-signal-label">Aesthetic</div>
            <div class="bp-signal-value">{identity.aesthetic}</div>
          </div>
        {/if}
        {#if identity?.captionStyle}
          <div class="bp-signal-card">
            <div class="bp-signal-icon"><ChatCircle size={16} /></div>
            <div class="bp-signal-label">Caption style</div>
            <div class="bp-signal-value">{identity.captionStyle}</div>
          </div>
        {/if}
        {#if identity?.lifestyle}
          <div class="bp-signal-card">
            <div class="bp-signal-icon"><Eye size={16} /></div>
            <div class="bp-signal-label">Lifestyle</div>
            <div class="bp-signal-value">{identity.lifestyle}</div>
          </div>
        {/if}
        {#if identity?.foodVibe}
          <div class="bp-signal-card">
            <div class="bp-signal-label">Food vibe</div>
            <div class="bp-signal-value">{identity.foodVibe}</div>
          </div>
        {/if}
        {#if identity?.igCreatorTier}
          <div class="bp-signal-card">
            <div class="bp-signal-icon"><TrendUp size={16} /></div>
            <div class="bp-signal-label">Creator tier</div>
            <div class="bp-signal-value">{identity.igCreatorTier}</div>
          </div>
        {/if}
        {#if identity?.personality}
          <div class="bp-signal-card bp-signal-card--wide">
            <div class="bp-signal-label">Personality</div>
            <div class="bp-signal-value">
              {#each Object.entries(identity.personality as Record<string, string>) as [key, val]}
                <span class="bp-personality-trait"><strong>{key}:</strong> {val}</span>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      {#if identity?.interests && (identity.interests as string[]).length}
        <div class="bp-tags-section">
          <div class="bp-signal-label">Brand interests</div>
          <div class="bp-tags">
            {#each identity.interests as tag}
              <span class="bp-tag">{tag}</span>
            {/each}
          </div>
        </div>
      {/if}

      {#if identity?.visual}
        <div class="bp-signal-card bp-signal-card--wide">
          <div class="bp-signal-icon"><Palette size={16} /></div>
          <div class="bp-signal-label">Visual identity</div>
          <div class="bp-signal-value bp-visual-detail">
            {#if (identity.visual as any)?.mood}
              <span>Mood: {(identity.visual as any).mood}</span>
            {/if}
            {#if (identity.visual as any)?.palette}
              <span>Palette: {(identity.visual as any).palette}</span>
            {/if}
            {#if (identity.visual as any)?.composition}
              <span>Composition: {(identity.visual as any).composition}</span>
            {/if}
          </div>
        </div>
      {/if}

      {#if identity?.temporal}
        <div class="bp-signal-card bp-signal-card--wide">
          <div class="bp-signal-label">Posting patterns</div>
          <div class="bp-signal-value bp-visual-detail">
            {#if (identity.temporal as any)?.peakDay}
              <span>Peak day: {(identity.temporal as any).peakDay}</span>
            {/if}
            {#if (identity.temporal as any)?.peakHour !== undefined}
              <span>Peak hour: {(identity.temporal as any).peakHour}:00</span>
            {/if}
            {#if (identity.temporal as any)?.avgPostsPerWeek}
              <span>Avg posts/week: {(identity.temporal as any).avgPostsPerWeek}</span>
            {/if}
          </div>
        </div>
      {/if}

      <button class="bp-re-extract" on:click={extractIdentity} disabled={extracting}>
        <ArrowClockwise size={14} />
        {extracting ? 'Re-analyzing...' : 'Re-extract identity'}
      </button>
      {#if extractMsg}<p class="bp-extract-msg">{extractMsg}</p>{/if}
    {/if}

    <!-- Recent posts -->
    <div class="bp-section-label">Recent posts</div>
    <div class="bp-posts-grid">
      {#each profileData.recentPosts as post}
        <a href={post.permalink} target="_blank" rel="noopener" class="bp-post">
          {#if post.thumbnail_url || post.media_url}
            <img src={post.thumbnail_url || post.media_url} alt="" class="bp-post-img" />
          {:else}
            <div class="bp-post-placeholder">{post.media_type}</div>
          {/if}
          <div class="bp-post-overlay">
            <span><Heart size={12} weight="fill" /> {post.like_count || 0}</span>
            <span><ChatCircle size={12} weight="fill" /> {post.comments_count || 0}</span>
          </div>
        </a>
      {/each}
    </div>

    <div class="bp-summary">
      <span><Heart size={14} /> {profileData.engagement.totalLikes.toLocaleString()} total likes</span>
      <span><ChatCircle size={14} /> {profileData.engagement.totalComments.toLocaleString()} total comments</span>
    </div>
  {/if}
</div>

<style>
  .brand-profile { display: flex; flex-direction: column; gap: 20px; max-width: 640px; margin: 0 auto; width: 100%; }
  .bp-loading, .bp-error { text-align: center; padding: 48px 20px; font-size: 14px; color: var(--text-muted); }
  .bp-error { color: var(--accent-primary); }

  .bp-header {
    display: flex; align-items: flex-start; gap: 16px; padding: 20px;
    background: var(--panel-surface); border: 1px solid var(--panel-border);
    border-radius: 16px; position: relative;
  }
  .bp-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-subtle); flex-shrink: 0; }
  .bp-header-info { flex: 1; min-width: 0; }
  .bp-username { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; }
  .bp-name { font-size: 14px; color: var(--text-secondary); margin: 4px 0 0; }
  .bp-bio { font-size: 13px; color: var(--text-muted); margin: 8px 0 0; line-height: 1.5; }
  .bp-refresh { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; }

  .bp-section-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted);
    display: flex; align-items: center; justify-content: space-between;
  }
  .bp-updated { font-size: 10px; font-weight: 500; text-transform: none; letter-spacing: 0; }

  .bp-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .bp-stat {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 16px 12px; background: var(--panel-surface);
    border: 1px solid var(--panel-border); border-radius: 14px; color: var(--text-muted);
  }
  .bp-stat-value { font-size: 22px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em; }
  .bp-stat-label { font-size: 11px; color: var(--text-muted); text-align: center; }

  /* Identity signals */
  .bp-extract-cta {
    padding: 24px; background: var(--panel-surface); border: 1px dashed var(--panel-border);
    border-radius: 14px; text-align: center;
  }
  .bp-extract-cta p { font-size: 13px; color: var(--text-secondary); margin: 0 0 16px; line-height: 1.6; }
  .bp-extract-btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 12px 24px;
    border: none; border-radius: 12px; font-size: 14px; font-weight: 600;
    font-family: inherit; cursor: pointer;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary));
    color: white; transition: all 0.2s;
  }
  .bp-extract-btn:disabled { opacity: 0.5; }
  .bp-extract-btn:hover:not(:disabled) { box-shadow: 0 0 20px rgba(255, 77, 77, 0.2); }
  .bp-extract-msg { font-size: 12px; color: #4ade80; margin: 8px 0 0; }

  .bp-identity-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
  }
  .bp-signal-card {
    padding: 14px; background: var(--panel-surface); border: 1px solid var(--panel-border);
    border-radius: 12px; display: flex; flex-direction: column; gap: 4px;
  }
  .bp-signal-card--wide { grid-column: 1 / -1; }
  .bp-signal-icon { color: var(--accent-tertiary); }
  .bp-signal-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
  .bp-signal-value { font-size: 13px; color: var(--text-primary); line-height: 1.5; }
  .bp-visual-detail { display: flex; flex-direction: column; gap: 2px; }
  .bp-personality-trait { display: block; font-size: 12px; }
  .bp-personality-trait strong { color: var(--text-secondary); }

  .bp-tags-section { display: flex; flex-direction: column; gap: 8px; }
  .bp-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .bp-tag {
    font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 100px;
    background: var(--accent-soft); color: var(--accent-primary);
  }

  .bp-re-extract {
    display: flex; align-items: center; gap: 6px; padding: 8px 16px;
    border: 1px solid var(--panel-border); border-radius: 10px;
    background: transparent; color: var(--text-muted); font-size: 12px;
    font-weight: 600; font-family: inherit; cursor: pointer;
    transition: color 0.15s;
  }
  .bp-re-extract:hover { color: var(--text-primary); }
  .bp-re-extract:disabled { opacity: 0.5; }

  .bp-posts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
  .bp-post { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; display: block; }
  .bp-post-img { width: 100%; height: 100%; object-fit: cover; }
  .bp-post-placeholder {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    background: var(--glass-medium); font-size: 10px; font-weight: 700; color: var(--text-muted);
  }
  .bp-post-overlay {
    position: absolute; inset: 0; background: rgba(0, 0, 0, 0.5); opacity: 0;
    display: flex; align-items: center; justify-content: center; gap: 12px;
    color: white; font-size: 12px; font-weight: 600; transition: opacity 0.2s;
  }
  .bp-post-overlay span { display: flex; align-items: center; gap: 4px; }
  .bp-post:hover .bp-post-overlay { opacity: 1; }

  .bp-summary { display: flex; justify-content: center; gap: 24px; font-size: 13px; color: var(--text-secondary); padding: 16px 0; }
  .bp-summary span { display: flex; align-items: center; gap: 6px; }

  @media (max-width: 520px) {
    .bp-stats-row { grid-template-columns: 1fr; }
    .bp-identity-grid { grid-template-columns: 1fr; }
  }
</style>
