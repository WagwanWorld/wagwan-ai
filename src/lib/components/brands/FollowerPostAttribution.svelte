<script lang="ts">
  export let posts: Array<{
    postId: string;
    mediaType: string;
    postedAt: string;
    captionPreview: string;
    permalink: string;
    reach: number;
    follows: number;
    profileActivity: number;
    reachFollowers: number;
    reachNonFollowers: number;
    conversionRate: number;
  }> = [];
  export let loading: boolean = false;

  $: visiblePosts = posts.slice(0, 10);
  $: maxConversion = visiblePosts.length
    ? Math.max(...visiblePosts.map((p) => p.conversionRate))
    : 0;

  function truncate(str: string, len: number): string {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '\u2026' : str;
  }

  function daysAgo(dateStr: string): string {
    const posted = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return '1 day ago';
    return `${diff} days ago`;
  }

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  function badgeClass(mediaType: string): string {
    const t = mediaType.toUpperCase();
    if (t === 'REEL' || t === 'VIDEO') return 'badge-amber';
    if (t === 'CAROUSEL' || t === 'CAROUSEL_ALBUM') return 'badge-blue';
    return 'badge-muted';
  }
</script>

<div class="bs-card">
  <div class="card-label">WHICH POSTS DRIVE FOLLOWS</div>

  {#if loading}
    <div class="loading-state">
      {#each Array(5) as _, i}
        <div class="skeleton-row" style="animation-delay: {i * 80}ms"></div>
      {/each}
    </div>
  {:else if !visiblePosts.length}
    <div class="empty-state">Post attribution data available after first sync</div>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-num">#</th>
            <th class="col-post">Post</th>
            <th class="col-metric">Reach</th>
            <th class="col-metric">Follows</th>
            <th class="col-rate">Conv. Rate</th>
          </tr>
        </thead>
        <tbody>
          {#each visiblePosts as post, i}
            <tr>
              <td class="col-num cell-num">{i + 1}</td>
              <td class="col-post cell-post">
                <div class="post-info">
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="post-caption"
                  >
                    {truncate(post.captionPreview, 40)}
                  </a>
                  <div class="post-meta">
                    <span class="badge {badgeClass(post.mediaType)}"
                      >{post.mediaType.toUpperCase()}</span
                    >
                    <span class="posted-at">{daysAgo(post.postedAt)}</span>
                  </div>
                </div>
              </td>
              <td class="col-metric cell-metric">{formatNumber(post.reach)}</td>
              <td class="col-metric cell-metric cell-follows">{formatNumber(post.follows)}</td>
              <td class="col-rate cell-rate">
                <div class="rate-cell">
                  <span class="rate-value">{post.conversionRate.toFixed(2)}%</span>
                  <div class="rate-bar-track">
                    <svg width="100%" height="6" aria-hidden="true">
                      <rect
                        x="0"
                        y="0"
                        width="{maxConversion > 0
                          ? (post.conversionRate / maxConversion) * 100
                          : 0}%"
                        height="6"
                        rx="3"
                        fill="#4ade80"
                      />
                    </svg>
                  </div>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .bs-card {
    grid-column: 1 / -1;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 20px 18px;
    min-width: 0;
    overflow: hidden;
  }

  .card-label {
    font-family: 'Geist Mono Variable', 'Geist Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    color: #4a4a50;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  /* Loading */
  .loading-state {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 0;
  }

  .skeleton-row {
    height: 36px;
    border-radius: 6px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.04) 25%,
      rgba(255, 255, 255, 0.07) 50%,
      rgba(255, 255, 255, 0.04) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Empty */
  .empty-state {
    font-family: 'PP Mori', sans-serif;
    font-size: 13px;
    color: #4a4a50;
    text-align: center;
    padding: 32px 16px;
  }

  /* Table */
  .table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'PP Mori', sans-serif;
  }

  thead tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  th {
    font-family: 'Geist Mono Variable', 'Geist Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: #4a4a50;
    text-transform: uppercase;
    text-align: left;
    padding: 0 8px 10px;
    white-space: nowrap;
  }

  th.col-metric,
  th.col-rate {
    text-align: right;
  }

  th.col-num {
    width: 28px;
    text-align: center;
  }

  td {
    padding: 10px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    vertical-align: middle;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: rgba(255, 255, 255, 0.02);
  }

  /* Columns */
  .cell-num {
    font-family: 'Geist Mono Variable', 'Geist Mono', monospace;
    font-size: 11px;
    color: #4a4a50;
    text-align: center;
    width: 28px;
  }

  .col-post {
    min-width: 180px;
  }

  .post-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .post-caption {
    font-size: 13px;
    color: #ededef;
    text-decoration: none;
    line-height: 1.35;
    transition: color 0.15s ease;
  }

  .post-caption:hover {
    color: #e8833a;
  }

  .post-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge {
    font-family: 'Geist Mono Variable', 'Geist Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
  }

  .badge-amber {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.12);
  }

  .badge-blue {
    color: #60a5fa;
    background: rgba(96, 165, 250, 0.12);
  }

  .badge-muted {
    color: #4a4a50;
    background: rgba(74, 74, 80, 0.2);
  }

  .posted-at {
    font-size: 11px;
    color: #4a4a50;
  }

  .cell-metric {
    font-family: 'Geist Mono Variable', 'Geist Mono', monospace;
    font-size: 13px;
    color: #ededef;
    text-align: right;
    white-space: nowrap;
  }

  .cell-follows {
    color: #4ade80;
  }

  .cell-rate {
    text-align: right;
    min-width: 120px;
  }

  .rate-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .rate-value {
    font-family: 'Geist Mono Variable', 'Geist Mono', monospace;
    font-size: 12px;
    color: #4ade80;
  }

  .rate-bar-track {
    width: 80px;
    height: 6px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 3px;
    overflow: hidden;
  }

  .rate-bar-track svg {
    display: block;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .bs-card {
      padding: 16px 12px;
    }

    th,
    td {
      padding: 8px 5px;
    }

    .col-post {
      min-width: 140px;
    }

    .rate-bar-track {
      width: 56px;
    }
  }
</style>
