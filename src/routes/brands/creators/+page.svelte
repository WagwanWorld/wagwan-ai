<script lang="ts">
  import { onMount } from 'svelte';

  type Creator = {
    name: string;
    handle: string;
    followers: number;
    archetype: string;
    location: string;
    vibeTags: string[];
    contentTags: string[];
    strength: number;
    initial: string;
  };

  let creators: Creator[] = [];
  let loading = true;
  let error = '';
  let query = '';

  onMount(async () => {
    try {
      const res = await fetch('/api/brand/creators');
      if (!res.ok) throw new Error('Failed to load creators');
      const data = await res.json();
      creators = data.creators ?? [];
    } catch (e: any) {
      error = e.message ?? 'Something went wrong';
    } finally {
      loading = false;
    }
  });

  $: filtered = creators.filter(c => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.archetype.toLowerCase().includes(q) ||
      c.handle.toLowerCase().includes(q) ||
      c.contentTags.some(t => t.toLowerCase().includes(q)) ||
      c.vibeTags.some(t => t.toLowerCase().includes(q))
    );
  });

  function formatFollowers(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n > 0 ? n.toString() : '—';
  }

  function avatarGradient(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    const h2 = (hue + 42) % 360;
    return `linear-gradient(145deg, hsl(${hue}, 55%, 22%), hsl(${h2}, 45%, 12%))`;
  }

  function accentColor(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }
</script>

<div class="page">
  <!-- Header -->
  <div class="page-header">
    <div class="header-copy">
      <h1 class="page-title">Explore Creators</h1>
      <p class="page-sub">Browse the full Wagwan creator network — real people, real signals.</p>
    </div>
    <div class="search-wrap">
      <svg class="search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M10 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM12 12l-2.5-2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
      <input
        class="search-input"
        type="search"
        placeholder="Search by name, archetype, tag…"
        bind:value={query}
        autocomplete="off"
        spellcheck="false"
      />
      {#if query}
        <button class="search-clear" on:click={() => (query = '')} aria-label="Clear search">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <!-- Loading skeleton -->
  {#if loading}
    <div class="grid">
      {#each Array(9) as _, i}
        <div class="skeleton-card" style="--index: {i}">
          <div class="sk-avatar"></div>
          <div class="sk-line sk-line--name"></div>
          <div class="sk-line sk-line--sub"></div>
          <div class="sk-line sk-line--archetype"></div>
          <div class="sk-bar"></div>
          <div class="sk-tags">
            <div class="sk-tag"></div>
            <div class="sk-tag"></div>
            <div class="sk-tag"></div>
          </div>
        </div>
      {/each}
    </div>

  {:else if error}
    <div class="empty-state">
      <span class="empty-icon">⚠</span>
      <p class="empty-title">Couldn't load creators</p>
      <p class="empty-sub">{error}</p>
    </div>

  {:else if filtered.length === 0}
    <div class="empty-state">
      <span class="empty-icon">✦</span>
      <p class="empty-title">{query ? 'No creators match your search' : 'No creators yet'}</p>
      <p class="empty-sub">{query ? 'Try a different keyword or clear the filter.' : 'Check back soon — the network is growing.'}</p>
      {#if query}
        <button class="clear-btn" on:click={() => (query = '')}>Clear search</button>
      {/if}
    </div>

  {:else}
    <p class="result-count">
      {#if query}
        <span class="count-num">{filtered.length}</span> creator{filtered.length !== 1 ? 's' : ''} found
      {:else}
        <span class="count-num">{filtered.length}</span> creator{filtered.length !== 1 ? 's' : ''} in the network
      {/if}
    </p>
    <div class="grid">
      {#each filtered as creator, i}
        <div class="creator-card" style="--index: {i}; --accent: {accentColor(creator.name)}">
          <!-- Avatar -->
          <div class="card-avatar" style="background: {avatarGradient(creator.name)}">
            <span class="avatar-initial" style="color: {accentColor(creator.name)}">{creator.initial}</span>
          </div>

          <!-- Name + handle + location -->
          <div class="card-identity">
            <span class="card-name">{creator.name}</span>
            <span class="card-sub">
              {#if creator.handle}@{creator.handle}{/if}{#if creator.handle && creator.location} · {/if}{#if creator.location}{creator.location}{/if}
              {#if !creator.handle && !creator.location}<span class="text-muted">—</span>{/if}
            </span>
          </div>

          <!-- Archetype -->
          {#if creator.archetype}
            <p class="card-archetype">"{creator.archetype}"</p>
          {/if}

          <!-- Followers + strength bar -->
          <div class="card-stats">
            <span class="card-followers">{formatFollowers(creator.followers)}</span>
            <div class="strength-wrap">
              <div class="strength-bar">
                <div class="strength-fill" style="width: {creator.strength}%; background: {accentColor(creator.name)}"></div>
              </div>
              <span class="strength-num">{Math.round(creator.strength)}</span>
            </div>
          </div>

          <!-- Tags — vibe first, then content -->
          <div class="card-tags">
            {#each [...creator.vibeTags, ...creator.contentTags].slice(0, 3) as tag}
              <span class="tag">{tag}</span>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 72rem;
    margin: 0 auto;
    padding: 3rem 1.25rem 6rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* ── Header ── */
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .header-copy {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .page-title {
    margin: 0;
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    line-height: 1.1;
  }

  .page-sub {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--text-muted);
    font-weight: 400;
  }

  /* ── Search ── */
  .search-wrap {
    position: relative;
    flex: 0 0 auto;
    width: 100%;
    max-width: 320px;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 10px 36px 10px 34px;
    font-size: 0.875rem;
    font-family: var(--font-sans);
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.25s cubic-bezier(0.32, 0.72, 0, 1), background 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .search-input::placeholder { color: var(--text-muted); }

  .search-input:focus {
    border-color: rgba(77, 124, 255, 0.4);
    background: var(--glass-medium);
  }

  .search-clear {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: 4px;
    transition: color 0.15s;
  }
  .search-clear:hover { color: var(--text-primary); }

  /* ── Result count ── */
  .result-count {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  .count-num {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text-secondary);
  }

  /* ── Grid ── */
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  @media (max-width: 900px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 560px) {
    .grid { grid-template-columns: 1fr; }
    .search-wrap { max-width: 100%; }
    .page-header { flex-direction: column; }
  }

  /* ── Creator card ── */
  .creator-card {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 18px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    opacity: 0;
    transform: translateY(14px);
    animation: card-enter 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    animation-delay: calc(var(--index, 0) * 0.06s);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    transition:
      border-color 0.3s cubic-bezier(0.32, 0.72, 0, 1),
      background 0.3s cubic-bezier(0.32, 0.72, 0, 1),
      transform 0.3s cubic-bezier(0.32, 0.72, 0, 1),
      box-shadow 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .creator-card:hover {
    border-color: color-mix(in srgb, var(--accent) 30%, var(--border-subtle));
    background: var(--glass-medium);
    transform: translateY(-3px);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      0 8px 32px rgba(0, 0, 0, 0.15);
  }

  @keyframes card-enter {
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Avatar ── */
  .card-avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
  }

  .avatar-initial {
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  /* ── Identity ── */
  .card-identity {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .card-name {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-sub {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Archetype ── */
  .card-archetype {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    font-style: italic;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Stats row ── */
  .card-stats {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .card-followers {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: -0.02em;
    flex-shrink: 0;
  }

  .strength-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .strength-bar {
    flex: 1;
    height: 4px;
    border-radius: 9999px;
    background: var(--border-subtle);
    overflow: hidden;
  }

  .strength-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.6s cubic-bezier(0.32, 0.72, 0, 1);
    opacity: 0.8;
  }

  .strength-num {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--text-muted);
    flex-shrink: 0;
    min-width: 22px;
    text-align: right;
  }

  /* ── Tags ── */
  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .tag {
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 9999px;
    background: var(--glass-medium);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    white-space: nowrap;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: lowercase;
    letter-spacing: 0.01em;
  }

  /* ── Skeleton ── */
  .skeleton-card {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 18px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    opacity: 0;
    animation: card-enter 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    animation-delay: calc(var(--index, 0) * 0.05s);
  }

  .sk-avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--glass-medium);
    animation: shimmer 1.6s ease-in-out infinite;
  }

  .sk-line {
    height: 12px;
    border-radius: 6px;
    background: var(--glass-medium);
    animation: shimmer 1.6s ease-in-out infinite;
  }

  .sk-line--name { width: 55%; }
  .sk-line--sub  { width: 75%; opacity: 0.6; }
  .sk-line--archetype { width: 90%; opacity: 0.5; }

  .sk-bar {
    height: 4px;
    border-radius: 9999px;
    background: var(--glass-medium);
    animation: shimmer 1.6s ease-in-out infinite;
  }

  .sk-tags {
    display: flex;
    gap: 5px;
  }

  .sk-tag {
    height: 20px;
    width: 52px;
    border-radius: 9999px;
    background: var(--glass-medium);
    animation: shimmer 1.6s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%, 100% { opacity: 0.4; }
    50%       { opacity: 0.7; }
  }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
    padding: 5rem 1.5rem;
    text-align: center;
  }

  .empty-icon {
    font-size: 2rem;
    opacity: 0.4;
  }

  .empty-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .empty-sub {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted);
    max-width: 300px;
    line-height: 1.5;
  }

  .clear-btn {
    margin-top: 0.5rem;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 9999px;
    padding: 7px 18px;
    font-size: 0.8125rem;
    font-family: var(--font-sans);
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .clear-btn:hover {
    border-color: rgba(255, 77, 77, 0.3);
    color: var(--text-primary);
    background: var(--glass-medium);
  }

  .text-muted { color: var(--text-muted); }
</style>
