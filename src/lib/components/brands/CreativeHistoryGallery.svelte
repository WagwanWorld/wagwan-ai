<script lang="ts">
  import { onMount } from 'svelte';

  interface GenerationVersion {
    version: number;
    image_gcs_url: string;
    cost_usd: number;
    created_at: string;
  }

  interface Generation {
    id: string;
    mode: string;
    format: string;
    status: string;
    created_at: string;
    approved_at: string | null;
    creative_generation_versions: GenerationVersion[];
  }

  let generations: Generation[] = [];
  let loading = true;
  let fetchError = '';

  onMount(async () => {
    try {
      const res = await fetch('/api/brand/creative-studio/history?limit=12', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
      const data = await res.json();
      generations = data.generations ?? [];
    } catch (e) {
      fetchError = e instanceof Error ? e.message : 'Could not load history';
    } finally {
      loading = false;
    }
  });

  function getThumbnail(gen: Generation): string {
    const versions = gen.creative_generation_versions ?? [];
    // Prefer latest version by version number
    if (versions.length === 0) return '';
    const sorted = [...versions].sort((a, b) => b.version - a.version);
    return sorted[0].image_gcs_url ?? '';
  }

  function getTotalCost(gen: Generation): string {
    const versions = gen.creative_generation_versions ?? [];
    const total = versions.reduce((sum, v) => sum + (v.cost_usd ?? 0), 0);
    return total > 0 ? `$${total.toFixed(2)}` : '—';
  }

  function getRelativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    const diffMo = Math.floor(diffDay / 30);
    return `${diffMo}mo ago`;
  }

  function getModeLabel(mode: string): string {
    if (mode === 'copy_first') return 'Copy First';
    if (mode === 'from_scratch') return 'From Scratch';
    return mode.replace(/_/g, ' ');
  }

  type StatusKey = 'approved' | 'in_progress' | 'abandoned';

  function getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      approved: 'Approved',
      in_progress: 'In Progress',
      abandoned: 'Abandoned',
    };
    return map[status] ?? status;
  }

  function getStatusClass(status: string): string {
    if (status === 'approved') return 'hg-badge--approved';
    if (status === 'in_progress') return 'hg-badge--progress';
    return 'hg-badge--abandoned';
  }
</script>

<div class="hg">
  <div class="hg-header">
    <span class="hg-title">RECENT CREATIVES</span>
  </div>

  {#if loading}
    <div class="hg-loading">
      <div class="hg-spinner"></div>
      <span>Loading history…</span>
    </div>
  {:else if fetchError}
    <div class="hg-fetch-error">{fetchError}</div>
  {:else if generations.length === 0}
    <div class="hg-empty">
      <span class="hg-empty-icon">✦</span>
      <p>No creatives yet — generate your first one above</p>
    </div>
  {:else}
    <div class="hg-grid">
      {#each generations as gen (gen.id)}
        {@const thumb = getThumbnail(gen)}
        <div class="hg-card">
          <!-- Thumbnail -->
          <div class="hg-thumb-wrap">
            {#if thumb}
              <img class="hg-thumb" src={thumb} alt="Creative preview" loading="lazy" />
            {:else}
              <div class="hg-thumb-placeholder">
                <span>✦</span>
              </div>
            {/if}
            <!-- Mode badge overlaid on thumbnail -->
            <span class="hg-badge hg-badge--mode">{getModeLabel(gen.mode)}</span>
          </div>

          <!-- Card meta -->
          <div class="hg-meta">
            <div class="hg-meta-row">
              <span class="hg-badge {getStatusClass(gen.status)}">{getStatusLabel(gen.status)}</span>
              <span class="hg-cost">{getTotalCost(gen)}</span>
            </div>
            <span class="hg-date">{getRelativeTime(gen.created_at)}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .hg {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
  }

  /* Section header */
  .hg-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .hg-title {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
  }

  /* Loading */
  .hg-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 24px 0;
    font-size: 12px;
    color: #4a4a50;
  }
  .hg-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.06);
    border-top-color: #e8464a;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Error */
  .hg-fetch-error {
    padding: 10px 14px;
    border-radius: 9px;
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.15);
    font-size: 12px;
    color: #f87171;
  }

  /* Empty state */
  .hg-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 36px 24px;
    border-radius: 14px;
    border: 1px dashed rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.015);
    text-align: center;
  }
  .hg-empty-icon {
    font-size: 20px;
    color: #4a4a50;
  }
  .hg-empty p {
    margin: 0;
    font-size: 13px;
    color: #4a4a50;
    line-height: 1.5;
  }

  /* Grid — 4 col desktop, 2 tablet, 1 mobile */
  .hg-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  @media (max-width: 1024px) {
    .hg-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 640px) {
    .hg-grid { grid-template-columns: 1fr; }
  }

  /* Card */
  .hg-card {
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color 0.15s;
  }
  .hg-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }

  /* Thumbnail — 4:5 aspect */
  .hg-thumb-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 5;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
    flex-shrink: 0;
  }
  .hg-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .hg-thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: #4a4a50;
  }

  /* Mode badge overlaid bottom-left of thumb */
  .hg-badge--mode {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: #ededef;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Meta row */
  .hg-meta {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hg-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  /* Badges */
  .hg-badge {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 3px 7px;
    border-radius: 5px;
    white-space: nowrap;
  }
  .hg-badge--approved {
    background: rgba(127, 200, 169, 0.12);
    border: 1px solid rgba(127, 200, 169, 0.25);
    color: #7fc8a9;
  }
  .hg-badge--progress {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #f59e0b;
  }
  .hg-badge--abandoned {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #4a4a50;
  }

  /* Cost */
  .hg-cost {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    color: #8a8a90;
  }

  /* Date */
  .hg-date {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    color: #4a4a50;
    letter-spacing: 0.04em;
  }
</style>
