<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let competitors: Array<{
    id: string;
    competitor_ig_username: string;
    latest_analysis: {
      username: string;
      followers: number;
      engagementRate: number;
      postsPerWeek: number;
      aesthetic: string;
      contentThemes: string[];
      summary: string;
      formatMix: Record<string, number>;
    } | null;
    last_analysed_at: string | null;
  }> = [];

  export let matrix: {
    overlaps: string;
    gaps: string;
    positioning: string;
  } | null = null;

  const dispatch = createEventDispatcher();

  let inputValue = '';

  function handleAdd() {
    const username = inputValue.trim().replace(/^@/, '');
    if (!username) return;
    dispatch('add', { username });
    inputValue = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleAdd();
  }

  function formatFollowers(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }
</script>

<div class="watch">
  <!-- Add competitor input -->
  <div class="add-row">
    <input
      class="handle-input"
      type="text"
      placeholder="@handle"
      bind:value={inputValue}
      on:keydown={handleKeydown}
      maxlength={60}
    />
    <button class="track-btn" on:click={handleAdd}>Track</button>
  </div>

  <!-- Matrix insight strip -->
  {#if matrix}
    <div class="matrix-strip">
      <div class="matrix-cell">
        <span class="label">Overlaps</span>
        <p class="matrix-body">{matrix.overlaps}</p>
      </div>
      <div class="matrix-sep"></div>
      <div class="matrix-cell">
        <span class="label">Gaps</span>
        <p class="matrix-body">{matrix.gaps}</p>
      </div>
      <div class="matrix-sep"></div>
      <div class="matrix-cell">
        <span class="label">Positioning</span>
        <p class="matrix-body">{matrix.positioning}</p>
      </div>
    </div>
  {/if}

  <!-- Competitor cards -->
  {#if competitors.length === 0}
    <div class="empty">
      <p class="empty-text">Add competitor handles to track their strategy. Up to 5 accounts.</p>
    </div>
  {:else}
    <div class="cards-grid">
      {#each competitors as comp}
        {@const analysis = comp.latest_analysis}
        <article class="comp-card">
          <div class="card-top">
            <span class="card-username">@{comp.competitor_ig_username}</span>
            {#if analysis}
              <span class="card-followers">{formatFollowers(analysis.followers)}</span>
            {/if}
          </div>

          {#if analysis}
            <div class="stat-chips">
              <span class="chip">
                <span class="chip-val">{analysis.engagementRate.toFixed(2)}%</span>
                <span class="chip-lbl">Engagement</span>
              </span>
              <span class="chip">
                <span class="chip-val">{analysis.postsPerWeek}</span>
                <span class="chip-lbl">Posts / wk</span>
              </span>
            </div>

            <div class="aesthetic-row">
              <span class="aesthetic-tag">{analysis.aesthetic}</span>
            </div>

            {#if analysis.contentThemes.length > 0}
              <div class="themes-row">
                {#each analysis.contentThemes as theme}
                  <span class="tag">{theme}</span>
                {/each}
              </div>
            {/if}

            <p class="card-summary">{analysis.summary}</p>
          {:else}
            <p class="not-analysed">Not yet analysed.</p>
          {/if}

          <div class="card-footer">
            <span class="last-analysed">Last analysed: {formatDate(comp.last_analysed_at)}</span>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .watch {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Label */
  .label {
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-label-color);
    display: block;
  }

  /* Add row — glass underline style */
  .add-row {
    display: flex;
    align-items: stretch;
    gap: 10px;
    margin-bottom: 22px;
  }
  .handle-input {
    flex: 1;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    padding: 8px 0;
    font-family: var(--g-font-mono, monospace);
    font-size: 13px;
    font-weight: 400;
    color: var(--g-text);
    outline: none;
    letter-spacing: 0.02em;
    transition: border-color var(--g-dur) var(--g-ease);
  }
  .handle-input::placeholder {
    color: var(--g-text-ghost);
  }
  .handle-input:focus {
    border-bottom-color: rgba(255,255,255,0.2);
  }
  .track-btn {
    font-family: inherit;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-text-2);
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 9px;
    padding: 8px 18px;
    cursor: pointer;
    transition: all var(--g-dur) var(--g-ease);
    flex-shrink: 0;
  }
  .track-btn:hover {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.1);
    color: var(--g-text);
  }

  /* Matrix strip */
  .matrix-strip {
    display: flex;
    gap: 0;
    border-top: 1px solid rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.03);
    margin-bottom: 22px;
  }
  .matrix-cell {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 18px 14px 0;
  }
  .matrix-cell:first-child { padding-left: 0; }
  .matrix-cell:last-child { padding-right: 0; }
  .matrix-sep {
    width: 1px;
    background: rgba(255,255,255,0.03);
    margin: 14px 18px;
    flex-shrink: 0;
  }
  .matrix-body {
    font-size: 14px;
    color: var(--g-text-3);
    line-height: 1.7;
    margin: 0;
  }

  /* Empty */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 24px;
    border: 1px dashed rgba(255,255,255,0.04);
    border-radius: 12px;
    text-align: center;
  }
  .empty-text {
    font-size: 13px;
    color: var(--g-text-4);
    margin: 0;
    max-width: 280px;
    line-height: 1.6;
  }

  /* Cards grid */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 10px;
  }

  .comp-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 12px;
    background: rgba(255,255,255,0.015);
    border: 1px solid rgba(255,255,255,0.025);
    transition: border-color var(--g-dur) var(--g-ease);
  }
  .comp-card:hover {
    border-color: rgba(255,255,255,0.05);
  }

  .card-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .card-username {
    font-family: var(--g-font-mono, monospace);
    font-size: 13px;
    font-weight: 500;
    color: var(--g-text);
    letter-spacing: 0.02em;
  }
  .card-followers {
    font-size: 20px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: var(--g-text);
    line-height: 1;
  }

  /* Stat chips */
  .stat-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 10px;
    border-radius: 9px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.02);
  }
  .chip-val {
    font-family: var(--g-font-mono, monospace);
    font-size: 12px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: var(--g-text);
    line-height: 1.2;
  }
  .chip-lbl {
    font-size: 8px;
    font-weight: 500;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--g-text-ghost);
    line-height: 1.2;
  }

  /* Aesthetic */
  .aesthetic-row { display: flex; }
  .aesthetic-tag {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 9px;
    color: var(--g-num-amber, rgba(252,210,77,0.85));
    border: 1px solid rgba(251,191,36,0.1);
    background: rgba(251,191,36,0.04);
  }

  /* Themes */
  .themes-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tag {
    font-size: 10px;
    padding: 4px 12px;
    border-radius: 9px;
    background: rgba(255,255,255,0.025);
    color: var(--g-text-4);
    border: 1px solid rgba(255,255,255,0.02);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* Summary */
  .card-summary {
    font-size: 12px;
    font-style: italic;
    line-height: 1.65;
    color: var(--g-text-3);
    margin: 0;
  }
  .not-analysed {
    font-size: 12px;
    color: var(--g-text-ghost);
    margin: 0;
  }

  /* Footer */
  .card-footer {
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.025);
  }
  .last-analysed {
    font-family: var(--g-font-mono, monospace);
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: var(--g-text-ghost);
  }

  @media (max-width: 600px) {
    .matrix-strip { flex-direction: column; }
    .matrix-cell {
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }
    .matrix-cell:last-child { border-bottom: none; }
    .matrix-sep { display: none; }
    .cards-grid { grid-template-columns: 1fr; }
  }
</style>
