<script lang="ts">
  export let rate: number = 0;
  export let avgPerPost: number = 0;
  export let postsPerWeek: number = 0;
  export let growthTrend: number = 0;
  export let contentTypes: Array<{ type: string; count: number; avgEng: number }> = [];
  export let topPosts: Array<{
    id: string; type: string; likes: number; comments: number;
    engagement: number; caption: string; permalink: string; thumbnail: string;
  }> = [];
  export let topHashtags: Array<{ tag: string; count: number }> = [];

  const typeLabels: Record<string, string> = {
    IMAGE: 'Feed Post',
    VIDEO: 'Video',
    CAROUSEL_ALBUM: 'Carousel',
    REELS: 'Reel',
  };

  $: maxTypeEng = Math.max(...contentTypes.map(t => t.avgEng), 1);
</script>

<div class="engagement">
  <!-- Stats row -->
  <div class="stats-row">
    <div class="stat">
      <span class="stat-num">{rate}%</span>
      <span class="stat-label">Engagement Rate</span>
    </div>
    <div class="stat">
      <span class="stat-num">{avgPerPost}</span>
      <span class="stat-label">Avg. per Post</span>
    </div>
    <div class="stat">
      <span class="stat-num">{postsPerWeek}</span>
      <span class="stat-label">Posts / Week</span>
    </div>
    <div class="stat">
      <span class="stat-num" class:positive={growthTrend > 0} class:negative={growthTrend < 0}>
        {growthTrend > 0 ? '+' : ''}{growthTrend}%
      </span>
      <span class="stat-label">Growth Trend</span>
    </div>
  </div>

  {#if contentTypes.length > 0}
    <div class="type-perf">
      <span class="label">By Content Type</span>
      {#each contentTypes as ct}
        <div class="type-row">
          <span class="type-name">{typeLabels[ct.type] || ct.type}</span>
          <div class="type-bar-wrap">
            <div class="type-bar" style="width: {(ct.avgEng / maxTypeEng) * 100}%"></div>
          </div>
          <span class="type-avg">{ct.avgEng}</span>
          <span class="type-count">{ct.count} posts</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if topPosts.length > 0}
    <div class="top-posts">
      <span class="label">Top Performing</span>
      <div class="posts-strip">
        {#each topPosts as post, i}
          <a href={post.permalink} target="_blank" rel="noopener" class="post-thumb" title="{post.likes} likes, {post.comments} comments">
            {#if post.thumbnail}
              <img src={post.thumbnail} alt="" class="thumb-img" />
            {:else}
              <div class="thumb-placeholder">{typeLabels[post.type] || post.type}</div>
            {/if}
            <div class="thumb-overlay">
              <span class="thumb-eng">{post.engagement}</span>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  {#if topHashtags.length > 0}
    <div class="hashtag-strip">
      <span class="label">Top Hashtags</span>
      <div class="hashtag-tags">
        {#each topHashtags as ht}
          <span class="hashtag-tag">{ht.tag} <span class="hashtag-count">{ht.count}</span></span>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .engagement {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  /* Stats row */
  .stats-row {
    display: flex;
    gap: 0;
    padding: 14px 0;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }
  .stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    border-right: 1px solid rgba(255,255,255,0.03);
  }
  .stat:last-child { border-right: none; }
  .stat-num {
    font-size: 22px;
    font-weight: 300;
    letter-spacing: -0.04em;
    line-height: 1;
    color: var(--g-text);
    transition: letter-spacing var(--g-dur) var(--g-ease);
  }
  .stat-num.positive { color: var(--g-num-green, rgba(110,231,183,0.85)); }
  .stat-num.negative { color: var(--g-num-rose, rgba(251,113,133,0.78)); }
  .stat-label {
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-label-color);
  }

  /* Label */
  .label {
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-label-color);
    display: block;
    margin-bottom: 8px;
  }

  /* Content type bars */
  .type-perf {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .type-row {
    display: grid;
    grid-template-columns: 80px 1fr 40px 60px;
    align-items: center;
    gap: 10px;
  }
  .type-name {
    font-family: var(--g-font-mono, monospace);
    font-size: 11px;
    font-weight: 500;
    color: var(--g-text-3);
  }
  .type-bar-wrap {
    height: 4px;
    background: rgba(255,255,255,0.03);
    border-radius: 2px;
    overflow: hidden;
  }
  .type-bar {
    height: 100%;
    background: var(--g-accent, rgba(255,64,64,0.5));
    border-radius: 2px;
    transition: width var(--g-dur) var(--g-ease);
  }
  .type-avg {
    font-family: var(--g-font-mono, monospace);
    font-size: 11px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: var(--g-text);
    text-align: right;
  }
  .type-count {
    font-size: 10px;
    color: var(--g-text-ghost);
    text-align: right;
  }

  /* Top posts */
  .top-posts {
    display: flex;
    flex-direction: column;
  }
  .posts-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
  }
  .post-thumb {
    position: relative;
    width: 88px;
    height: 88px;
    overflow: hidden;
    display: block;
    border-radius: 8px;
    flex-shrink: 0;
  }
  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform var(--g-dur) var(--g-ease);
  }
  .post-thumb:hover .thumb-img { transform: scale(1.06); }
  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,0.02);
    font-family: var(--g-font-mono, monospace);
    font-size: 9px;
    color: var(--g-text-ghost);
  }
  .thumb-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 4px 6px;
    background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);
    border-radius: 0 0 8px 8px;
  }
  .thumb-eng {
    font-family: var(--g-font-mono, monospace);
    font-size: 10px;
    font-weight: 500;
    color: rgba(255,255,255,0.9);
  }

  /* Hashtags */
  .hashtag-strip {
    display: flex;
    flex-direction: column;
  }
  .hashtag-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .hashtag-tag {
    font-size: 10px;
    padding: 4px 12px;
    border-radius: 9px;
    background: rgba(255,255,255,0.025);
    color: var(--g-text-4);
    border: 1px solid rgba(255,255,255,0.02);
  }
  .hashtag-count {
    font-weight: 500;
    color: var(--g-text-2);
  }

  @media (max-width: 600px) {
    .stats-row { flex-wrap: wrap; }
    .stat {
      min-width: 45%;
      border-bottom: 1px solid rgba(255,255,255,0.03);
      padding: 12px 0;
    }
    .type-row { grid-template-columns: 70px 1fr 36px; }
    .type-count { display: none; }
  }
</style>
