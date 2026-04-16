<script lang="ts">
  import { onMount } from 'svelte';
  import Heart from 'phosphor-svelte/lib/Heart';
  import ChatCircle from 'phosphor-svelte/lib/ChatCircle';
  import TrendUp from 'phosphor-svelte/lib/TrendUp';
  import CalendarCheck from 'phosphor-svelte/lib/CalendarCheck';
  import ImageSquare from 'phosphor-svelte/lib/ImageSquare';
  import Users from 'phosphor-svelte/lib/Users';
  import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';

  let loading = true;
  let error = '';
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
  } | null = null;

  async function loadStats() {
    loading = true;
    error = '';
    try {
      const res = await fetch('/api/brand/profile-stats');
      const data = await res.json();
      if (data.ok) {
        profileData = data;
      } else {
        error = data.error || 'Failed to load stats';
      }
    } catch {
      error = 'Network error';
    } finally {
      loading = false;
    }
  }

  onMount(loadStats);
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

    <!-- Totals summary -->
    <div class="bp-summary">
      <span><Heart size={14} /> {profileData.engagement.totalLikes.toLocaleString()} total likes</span>
      <span><ChatCircle size={14} /> {profileData.engagement.totalComments.toLocaleString()} total comments</span>
    </div>
  {/if}
</div>

<style>
  .brand-profile {
    display: flex; flex-direction: column; gap: 20px;
    max-width: 640px; margin: 0 auto; width: 100%;
  }
  .bp-loading, .bp-error {
    text-align: center; padding: 48px 20px;
    font-size: 14px; color: var(--text-muted);
  }
  .bp-error { color: var(--accent-primary); }

  .bp-header {
    display: flex; align-items: flex-start; gap: 16px;
    padding: 20px; background: var(--panel-surface);
    border: 1px solid var(--panel-border); border-radius: 16px;
    position: relative;
  }
  .bp-avatar {
    width: 64px; height: 64px; border-radius: 50%; object-fit: cover;
    border: 2px solid var(--border-subtle); flex-shrink: 0;
  }
  .bp-header-info { flex: 1; min-width: 0; }
  .bp-username { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; }
  .bp-name { font-size: 14px; color: var(--text-secondary); margin: 4px 0 0; }
  .bp-bio { font-size: 13px; color: var(--text-muted); margin: 8px 0 0; line-height: 1.5; }
  .bp-refresh {
    position: absolute; top: 16px; right: 16px;
    background: none; border: none; color: var(--text-muted);
    cursor: pointer; padding: 4px;
  }

  .bp-section-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted);
  }

  .bp-stats-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  }
  .bp-stat {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 16px 12px; background: var(--panel-surface);
    border: 1px solid var(--panel-border); border-radius: 14px;
    color: var(--text-muted);
  }
  .bp-stat-value {
    font-size: 22px; font-weight: 800; color: var(--text-primary);
    letter-spacing: -0.02em;
  }
  .bp-stat-label { font-size: 11px; color: var(--text-muted); text-align: center; }

  .bp-posts-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
  }
  .bp-post {
    position: relative; aspect-ratio: 1; border-radius: 8px;
    overflow: hidden; display: block;
  }
  .bp-post-img { width: 100%; height: 100%; object-fit: cover; }
  .bp-post-placeholder {
    width: 100%; height: 100%; display: flex; align-items: center;
    justify-content: center; background: var(--glass-medium);
    font-size: 10px; font-weight: 700; color: var(--text-muted);
  }
  .bp-post-overlay {
    position: absolute; inset: 0;
    background: rgba(0, 0, 0, 0.5); opacity: 0;
    display: flex; align-items: center; justify-content: center; gap: 12px;
    color: white; font-size: 12px; font-weight: 600;
    transition: opacity 0.2s;
  }
  .bp-post-overlay span { display: flex; align-items: center; gap: 4px; }
  .bp-post:hover .bp-post-overlay { opacity: 1; }

  .bp-summary {
    display: flex; justify-content: center; gap: 24px;
    font-size: 13px; color: var(--text-secondary);
    padding: 16px 0;
  }
  .bp-summary span { display: flex; align-items: center; gap: 6px; }

  @media (max-width: 520px) {
    .bp-stats-row { grid-template-columns: 1fr; }
    .bp-posts-grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
