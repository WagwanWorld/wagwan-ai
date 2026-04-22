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
    strengthLabel: string;
    initial: string;
    aesthetic: string;
    lifestyle: string;
    brandVibes: string[];
    interests: string[];
    activities: string[];
    contentCategories: string[];
    profilePicture: string;
    bio: string;
    mediaCount: number;
    engagementTier: string;
    captionIntent: string;
    creatorTier: string;
    personality: { expressive: number; humor: number; introspective: number } | null;
    colorPalette: string[];
    aestheticTone: string;
  };

  let creators: Creator[] = [];
  let loading = true;
  let error = '';
  let query = '';
  let activeFilter = 'all';
  let expandedCreator: string | null = null;

  function toggleExpand(creator: Creator) {
    const key = `${creator.name}::${creator.handle}`;
    expandedCreator = expandedCreator === key ? null : key;
  }

  function isExpanded(creator: Creator): boolean {
    return expandedCreator === `${creator.name}::${creator.handle}`;
  }

  // Featured creator = first with highest strength
  $: featured = filtered.length > 0
    ? [...filtered].sort((a, b) => b.strength - a.strength)[0]
    : null;

  // Rest of creators (excluding featured)
  $: rest = featured
    ? filtered.filter(c => c !== featured)
    : [];

  // Unique archetype tags for filter chips
  $: allTags = [...new Set(creators.flatMap(c => [...c.vibeTags, ...c.contentTags]))].slice(0, 12);

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
    const matchesQuery = !query.trim() || (() => {
      const q = query.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.archetype.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        c.contentTags.some(t => t.toLowerCase().includes(q)) ||
        c.vibeTags.some(t => t.toLowerCase().includes(q))
      );
    })();

    const matchesFilter = activeFilter === 'all' ||
      c.vibeTags.some(t => t.toLowerCase() === activeFilter.toLowerCase()) ||
      c.contentTags.some(t => t.toLowerCase() === activeFilter.toLowerCase());

    return matchesQuery && matchesFilter;
  });

  function formatFollowers(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n > 0 ? n.toString() : '—';
  }

  function formatFollowersRaw(n: number): string {
    return n.toLocaleString('en-US');
  }

  function avatarGradient(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    const h2 = (hue + 35) % 360;
    return `linear-gradient(160deg, hsl(${hue}, 40%, 88%), hsl(${h2}, 35%, 78%))`;
  }

  // Assign grid sizes for asymmetric layout
  function gridClass(index: number): string {
    const pattern = ['tall', 'wide', 'standard', 'standard', 'wide', 'standard', 'tall', 'standard'];
    return pattern[index % pattern.length];
  }
</script>

<div class="ci-page">

  <!-- Page header -->
  <header class="ci-header">
    <div class="ci-header-text">
      <h1 class="ci-title">Creator Index</h1>
      <p class="ci-subtitle">A curated directory of creators in the Wagwan network. Real people, real audiences, real signal depth.</p>
    </div>
    <div class="ci-header-count">
      <span class="ci-count-num">{loading ? '—' : filtered.length}</span>
      <span class="ci-count-label">Creators</span>
    </div>
  </header>

  <!-- Search -->
  <div class="ci-search-wrap">
    <svg class="ci-search-icon" width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M10 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM12 12l-2.5-2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
    <input
      class="ci-search"
      type="search"
      placeholder="Search name, archetype, tag..."
      bind:value={query}
      autocomplete="off"
      spellcheck="false"
    />
    {#if query}
      <button class="ci-search-clear" on:click={() => (query = '')} aria-label="Clear">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    {/if}
  </div>

  <!-- Filter chips -->
  {#if allTags.length > 0}
    <div class="ci-chips">
      <button
        class="ci-chip"
        class:active={activeFilter === 'all'}
        on:click={() => (activeFilter = 'all')}
      >All</button>
      {#each allTags as tag}
        <button
          class="ci-chip"
          class:active={activeFilter === tag}
          on:click={() => (activeFilter = activeFilter === tag ? 'all' : tag)}
        >{tag}</button>
      {/each}
    </div>
  {/if}

  <!-- Loading skeleton -->
  {#if loading}
    <section class="ci-skeleton">
      <div class="ci-sk-featured">
        <div class="ci-sk-block ci-sk-portrait"></div>
        <div class="ci-sk-block ci-sk-text-lg"></div>
        <div class="ci-sk-block ci-sk-text-sm"></div>
      </div>
      <div class="ci-sk-grid">
        {#each Array(6) as _, i}
          <div class="ci-sk-card" style="--i:{i}">
            <div class="ci-sk-block ci-sk-avatar"></div>
            <div class="ci-sk-block ci-sk-name"></div>
            <div class="ci-sk-block ci-sk-handle"></div>
          </div>
        {/each}
      </div>
    </section>

  {:else if error}
    <section class="ci-empty">
      <p class="ci-empty-title">Could not load the index</p>
      <p class="ci-empty-sub">{error}</p>
    </section>

  {:else if filtered.length === 0}
    <section class="ci-empty">
      <p class="ci-empty-title">{query ? 'No creators match' : 'The index is empty'}</p>
      <p class="ci-empty-sub">{query ? 'Try a different search or clear filters.' : 'Check back soon.'}</p>
      {#if query}
        <button class="ci-clear-btn" on:click={() => { query = ''; activeFilter = 'all'; }}>Clear all</button>
      {/if}
    </section>

  {:else}

    <!-- Featured creator -->
    {#if featured}
      <section class="ci-featured">
        <div class="ci-featured-edge"></div>
        <div class="ci-featured-inner">
          <div class="ci-featured-avatar">
            {#if featured.profilePicture}
              <img src={featured.profilePicture} alt={featured.name} class="ci-featured-img" />
            {:else}
              <div class="ci-featured-gradient" style="background: {avatarGradient(featured.name)}">
                <span class="ci-featured-initial">{featured.initial}</span>
              </div>
            {/if}
          </div>
          <div class="ci-featured-body">
            <span class="ci-label">Featured Creator</span>
            <h2 class="ci-featured-name">{featured.name}</h2>
            <div class="ci-featured-meta">
              {#if featured.handle}<span class="ci-meta-handle">@{featured.handle}</span>{/if}
              {#if featured.location}<span class="ci-meta-loc">{featured.location}</span>{/if}
              {#if featured.creatorTier}<span class="ci-meta-tier">{featured.creatorTier}</span>{/if}
            </div>

            <div class="ci-featured-stats">
              <div class="ci-fstat">
                <span class="ci-fstat-num">{formatFollowersRaw(featured.followers)}</span>
                <span class="ci-label">Followers</span>
              </div>
              <div class="ci-fstat">
                <span class="ci-fstat-num">{featured.mediaCount.toLocaleString()}</span>
                <span class="ci-label">Posts</span>
              </div>
              <div class="ci-fstat">
                <span class="ci-fstat-num">{Math.round(featured.strength)}</span>
                <span class="ci-label">Signal</span>
              </div>
              {#if featured.engagementTier}
                <div class="ci-fstat">
                  <span class="ci-fstat-num ci-tier" data-tier={featured.engagementTier}>{featured.engagementTier}</span>
                  <span class="ci-label">Engagement</span>
                </div>
              {/if}
            </div>

            <!-- Strength bar -->
            <div class="ci-strength">
              <div class="ci-strength-track">
                <div class="ci-strength-fill" style="width: {featured.strength}%"></div>
              </div>
              <span class="ci-strength-label">{featured.strengthLabel} signal</span>
            </div>

            {#if featured.bio}
              <p class="ci-featured-bio">{featured.bio}</p>
            {:else if featured.archetype}
              <p class="ci-featured-archetype">&ldquo;{featured.archetype}&rdquo;</p>
            {/if}

            <!-- Tags -->
            <div class="ci-featured-tags">
              {#if featured.aesthetic}
                <span class="ci-pill ci-pill--accent">{featured.aesthetic}</span>
              {/if}
              {#if featured.lifestyle}
                <span class="ci-pill ci-pill--accent">{featured.lifestyle}</span>
              {/if}
              {#each featured.interests.slice(0, 5) as interest}
                <span class="ci-pill">{interest}</span>
              {/each}
            </div>

            <!-- Color palette -->
            {#if featured.colorPalette.length > 0}
              <div class="ci-palette-row">
                <span class="ci-label">Visual Palette</span>
                <div class="ci-palette-dots">
                  {#each featured.colorPalette as color}
                    <span class="ci-palette-dot" style="background: {color}"></span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </section>
    {/if}

    <!-- Result divider -->
    <div class="ci-result-bar">
      <span class="ci-result-rule"></span>
      <span class="ci-result-count">
        <span class="ci-result-num">{rest.length}</span> more in the index
      </span>
      <span class="ci-result-rule"></span>
    </div>

    <!-- Creator grid -->
    <section class="ci-grid">
      {#each rest as creator, i}
        <article
          class="ci-card {gridClass(i)}"
          class:ci-card--expanded={isExpanded(creator)}
          style="--i:{i}"
          on:click={() => toggleExpand(creator)}
        >
          <div class="ci-card-edge"></div>

          <!-- Avatar -->
          <div class="ci-card-avatar">
            {#if creator.profilePicture}
              <img src={creator.profilePicture} alt={creator.name} class="ci-card-photo" />
            {:else}
              <div class="ci-card-gradient" style="background: {avatarGradient(creator.name)}">
                <span class="ci-card-initial">{creator.initial}</span>
              </div>
            {/if}
          </div>

          <div class="ci-card-body">
            <h3 class="ci-card-name">{creator.name}</h3>
            <span class="ci-card-handle">
              {#if creator.handle}@{creator.handle}{/if}
              {#if creator.handle && creator.location} &middot; {/if}
              {#if creator.location}{creator.location}{/if}
            </span>

            <!-- Stats row -->
            <div class="ci-card-stats">
              <div class="ci-card-stat">
                <span class="ci-card-stat-num">{formatFollowers(creator.followers)}</span>
                <span class="ci-label">Followers</span>
              </div>
              <div class="ci-card-stat">
                <span class="ci-card-stat-num">{creator.mediaCount.toLocaleString()}</span>
                <span class="ci-label">Posts</span>
              </div>
              <div class="ci-card-stat">
                <span class="ci-card-stat-num">{Math.round(creator.strength)}</span>
                <span class="ci-label">Signal</span>
              </div>
            </div>

            <!-- Strength bar -->
            <div class="ci-strength">
              <div class="ci-strength-track">
                <div class="ci-strength-fill" style="width: {creator.strength}%"></div>
              </div>
              <span class="ci-strength-label">{creator.strengthLabel}</span>
            </div>

            <!-- Badges -->
            <div class="ci-card-badges">
              {#if creator.engagementTier}
                <span class="ci-badge" data-tier={creator.engagementTier}>{creator.engagementTier} engagement</span>
              {/if}
              {#if creator.aesthetic}
                <span class="ci-badge">{creator.aesthetic}</span>
              {/if}
              {#if creator.captionIntent}
                <span class="ci-badge">{creator.captionIntent}</span>
              {/if}
            </div>

            <!-- Top categories -->
            <div class="ci-card-tags">
              {#each [...creator.contentCategories, ...creator.interests].slice(0, 4) as tag}
                <span class="ci-pill ci-pill--sm">{tag}</span>
              {/each}
            </div>

            <!-- Expanded detail -->
            {#if isExpanded(creator)}
              <div class="ci-card-detail">
                {#if creator.bio}
                  <p class="ci-detail-bio">{creator.bio}</p>
                {/if}

                {#if creator.brandVibes.length > 0}
                  <div class="ci-detail-section">
                    <span class="ci-label">Brand Vibes</span>
                    <div class="ci-detail-tags">
                      {#each creator.brandVibes as vibe}
                        <span class="ci-pill ci-pill--sm">{vibe}</span>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if creator.interests.length > 0}
                  <div class="ci-detail-section">
                    <span class="ci-label">Interests</span>
                    <div class="ci-detail-tags">
                      {#each creator.interests as interest}
                        <span class="ci-pill ci-pill--sm">{interest}</span>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if creator.personality}
                  <div class="ci-detail-section">
                    <span class="ci-label">Personality</span>
                    <div class="ci-pbar-group">
                      <div class="ci-pbar">
                        <span class="ci-pbar-label">Expressive</span>
                        <div class="ci-pbar-track"><div class="ci-pbar-fill" style="width: {creator.personality.expressive * 100}%"></div></div>
                      </div>
                      <div class="ci-pbar">
                        <span class="ci-pbar-label">Humor</span>
                        <div class="ci-pbar-track"><div class="ci-pbar-fill" style="width: {creator.personality.humor * 100}%"></div></div>
                      </div>
                      <div class="ci-pbar">
                        <span class="ci-pbar-label">Introspective</span>
                        <div class="ci-pbar-track"><div class="ci-pbar-fill" style="width: {creator.personality.introspective * 100}%"></div></div>
                      </div>
                    </div>
                  </div>
                {/if}

                {#if creator.colorPalette.length > 0}
                  <div class="ci-detail-section">
                    <span class="ci-label">Visual Palette</span>
                    <div class="ci-palette-dots">
                      {#each creator.colorPalette as color}
                        <span class="ci-palette-dot" style="background: {color}"></span>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if creator.archetype}
                  <p class="ci-detail-archetype">&ldquo;{creator.archetype}&rdquo;</p>
                {/if}
              </div>
            {/if}
          </div>
        </article>
      {/each}
    </section>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════
     CREATOR INDEX — Glass Bento Grid
     Uses var(--g-*) tokens from tokens-glass.css
     ═══════════════════════════════════════════ */

  .ci-page {
    max-width: 76rem;
    margin: 0 auto;
    padding: 0 28px 6rem;
  }

  /* ── Page header ── */
  .ci-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 48px 0 32px;
    gap: 24px;
  }

  .ci-header-text {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ci-title {
    font-family: var(--g-font);
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--g-text);
    margin: 0;
    line-height: 1.1;
  }

  .ci-subtitle {
    font-family: var(--g-font);
    font-size: 13px;
    color: var(--g-text-3);
    line-height: 1.5;
    max-width: 420px;
    margin: 0;
  }

  .ci-header-count {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }

  .ci-count-num {
    font-family: var(--g-font);
    font-size: 42px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: var(--g-text);
    line-height: 1;
  }

  .ci-count-label {
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-label-color);
  }

  /* ── Label pattern (reusable) ── */
  .ci-label {
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-label-color);
  }

  /* ── Search ── */
  .ci-search-wrap {
    position: relative;
    max-width: 360px;
    margin-bottom: 16px;
  }

  .ci-search-icon {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    color: var(--g-text-ghost);
    pointer-events: none;
  }

  .ci-search {
    width: 100%;
    box-sizing: border-box;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    padding: 10px 28px 10px 22px;
    font-size: 13px;
    font-family: var(--g-font);
    color: var(--g-text);
    outline: none;
    transition: border-color var(--g-dur) var(--g-ease);
  }
  .ci-search::placeholder { color: var(--g-text-ghost); }
  .ci-search:focus { border-color: rgba(255,255,255,0.15); }

  .ci-search-clear {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--g-text-ghost);
    cursor: pointer;
    padding: 4px;
    transition: color 0.4s var(--g-ease);
  }
  .ci-search-clear:hover { color: var(--g-text); }

  /* ── Filter chips ── */
  .ci-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 32px;
  }

  .ci-chip {
    font-family: var(--g-font);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 5px 13px;
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,0.02);
    background: rgba(255,255,255,0.025);
    color: var(--g-text-3);
    cursor: pointer;
    transition: all var(--g-dur) var(--g-ease);
  }
  .ci-chip:hover {
    border-color: rgba(255,255,255,0.06);
    color: var(--g-text-2);
    background: rgba(255,255,255,0.04);
  }
  .ci-chip.active {
    background: rgba(255,255,255,0.06);
    border-color: var(--g-accent, rgba(255,255,255,0.12));
    color: var(--g-text);
  }

  /* ── Glass pill (tag) ── */
  .ci-pill {
    font-family: var(--g-font);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 4px 11px;
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,0.03);
    background: rgba(255,255,255,0.025);
    color: var(--g-text-3);
  }
  .ci-pill--accent {
    border-color: rgba(255,64,64,0.15);
    color: rgba(255,125,125,0.85);
  }
  .ci-pill--sm {
    font-size: 9px;
    padding: 3px 9px;
  }

  /* ── Featured creator card ── */
  .ci-featured {
    position: relative;
    overflow: hidden;
    border-radius: var(--g-card-radius);
    border: 1px solid var(--g-card-border);
    box-shadow:
      0 1px 0 0 var(--g-card-highlight) inset,
      0 -1px 0 0 var(--g-card-shadow-bottom) inset,
      var(--g-card-shadow-near),
      var(--g-card-shadow-far);
    backdrop-filter: blur(var(--g-card-blur));
    -webkit-backdrop-filter: blur(var(--g-card-blur));
    margin-bottom: 32px;
    transition:
      border-color var(--g-dur) var(--g-ease),
      box-shadow var(--g-dur) var(--g-ease);
    opacity: 0;
    animation: ci-enter 0.7s var(--g-ease) forwards;
  }
  .ci-featured:hover {
    border-color: var(--g-card-border-hover);
    box-shadow:
      0 1px 0 0 rgba(255,255,255,0.04) inset,
      0 -1px 0 0 rgba(0,0,0,0.12) inset,
      var(--g-card-shadow-hover-near),
      var(--g-card-shadow-hover-far);
  }

  /* Inner light on hover */
  .ci-featured::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--g-card-radius);
    background: linear-gradient(145deg, rgba(255,255,255,0.015), transparent 45%);
    opacity: 0;
    transition: opacity var(--g-dur);
    pointer-events: none;
  }
  .ci-featured:hover::after { opacity: 1; }

  .ci-featured-edge {
    position: absolute;
    top: 0;
    left: 16px;
    right: 16px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
    pointer-events: none;
  }

  .ci-featured-inner {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 28px;
    padding: 28px 32px;
  }

  .ci-featured-avatar {
    width: 200px;
    height: 200px;
    border-radius: 16px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .ci-featured-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ci-featured-gradient {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ci-featured-initial {
    font-family: var(--g-font);
    font-size: 4rem;
    font-weight: 300;
    color: rgba(255,255,255,0.08);
    line-height: 1;
  }

  .ci-featured-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ci-featured-name {
    font-family: var(--g-font);
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.03em;
    color: var(--g-text);
    margin: 0;
    line-height: 1.1;
  }

  .ci-featured-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ci-meta-handle {
    font-family: var(--g-font-mono);
    font-size: 12px;
    color: var(--g-text-3);
  }

  .ci-meta-loc {
    font-family: var(--g-font);
    font-size: 12px;
    color: var(--g-text-4);
    font-style: italic;
  }

  .ci-meta-tier {
    font-family: var(--g-font-mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--g-accent);
  }

  .ci-featured-stats {
    display: flex;
    gap: 28px;
    padding: 12px 0;
    border-top: 1px solid rgba(255,255,255,0.03);
  }

  .ci-fstat {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ci-fstat-num {
    font-family: var(--g-font);
    font-size: 22px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: var(--g-text);
    line-height: 1;
  }

  .ci-tier { text-transform: uppercase; font-size: 14px !important; }
  .ci-tier[data-tier="high"] { color: rgba(110,231,183,0.85); }
  .ci-tier[data-tier="medium"] { color: var(--g-text-3); }

  .ci-featured-bio {
    font-size: 13px;
    color: var(--g-text-3);
    line-height: 1.55;
    margin: 0;
  }

  .ci-featured-archetype {
    font-family: var(--g-font);
    font-style: italic;
    font-size: 15px;
    font-weight: 300;
    color: var(--g-text-2);
    margin: 0;
    line-height: 1.4;
  }

  .ci-featured-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  /* ── Strength bar ── */
  .ci-strength {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ci-strength-track {
    flex: 1;
    height: 2px;
    background: rgba(255,255,255,0.04);
    border-radius: 1px;
    overflow: hidden;
  }
  .ci-strength-fill {
    height: 100%;
    background: var(--g-accent);
    border-radius: 1px;
    transition: width 0.7s var(--g-ease);
  }
  .ci-strength-label {
    font-family: var(--g-font-mono);
    font-size: 9px;
    font-weight: 500;
    color: var(--g-text-4);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  /* ── Palette ── */
  .ci-palette-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ci-palette-dots {
    display: flex;
    gap: 5px;
  }
  .ci-palette-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.06);
  }

  /* ── Result bar ── */
  .ci-result-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 28px;
  }

  .ci-result-rule {
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.04);
  }

  .ci-result-count {
    font-family: var(--g-font);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--g-text-4);
    white-space: nowrap;
  }

  .ci-result-num {
    font-family: var(--g-font-mono);
    color: var(--g-text-3);
  }

  /* ── Creator grid ── */
  .ci-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 11px;
    grid-auto-flow: dense;
  }

  /* ── Creator card (glass) ── */
  .ci-card {
    position: relative;
    overflow: hidden;
    border-radius: var(--g-card-radius);
    padding: 20px 22px;
    border: 1px solid var(--g-card-border);
    box-shadow:
      0 1px 0 0 var(--g-card-highlight) inset,
      0 -1px 0 0 var(--g-card-shadow-bottom) inset,
      var(--g-card-shadow-near),
      var(--g-card-shadow-far);
    backdrop-filter: blur(var(--g-card-blur));
    -webkit-backdrop-filter: blur(var(--g-card-blur));
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition:
      border-color var(--g-dur) var(--g-ease),
      box-shadow var(--g-dur) var(--g-ease);
    opacity: 0;
    animation: ci-enter 0.7s var(--g-ease) forwards;
    animation-delay: calc(var(--i, 0) * 50ms);
  }

  .ci-card:hover {
    border-color: var(--g-card-border-hover);
    box-shadow:
      0 1px 0 0 rgba(255,255,255,0.04) inset,
      0 -1px 0 0 rgba(0,0,0,0.12) inset,
      var(--g-card-shadow-hover-near),
      var(--g-card-shadow-hover-far);
  }

  /* Top edge line */
  .ci-card-edge {
    position: absolute;
    top: 0;
    left: 16px;
    right: 16px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
    pointer-events: none;
  }

  /* Inner light on hover */
  .ci-card::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--g-card-radius);
    background: linear-gradient(145deg, rgba(255,255,255,0.015), transparent 45%);
    opacity: 0;
    transition: opacity var(--g-dur);
    pointer-events: none;
  }
  .ci-card:hover::after { opacity: 1; }

  /* Grid spans */
  .ci-card.standard { grid-column: span 4; }
  .ci-card.wide     { grid-column: span 5; }
  .ci-card.tall     { grid-column: span 3; }

  /* Expanded card */
  .ci-card--expanded {
    grid-column: span 12 !important;
  }

  @keyframes ci-enter {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Card avatar ── */
  .ci-card-avatar {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 14px;
  }

  .ci-card-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ci-card-gradient {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ci-card-initial {
    font-family: var(--g-font);
    font-size: clamp(2rem, 4vw, 3.5rem);
    font-weight: 300;
    color: rgba(255,255,255,0.06);
    line-height: 1;
  }

  /* ── Card body ── */
  .ci-card-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ci-card-name {
    font-family: var(--g-font);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--g-text);
    margin: 0;
    line-height: 1.2;
  }

  .ci-card-handle {
    font-family: var(--g-font-mono);
    font-size: 11px;
    color: var(--g-text-4);
  }

  /* Stats row */
  .ci-card-stats {
    display: flex;
    gap: 0;
    border-top: 1px solid rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.03);
    padding: 8px 0;
    margin: 8px 0 6px;
  }
  .ci-card-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    border-right: 1px solid rgba(255,255,255,0.03);
  }
  .ci-card-stat:last-child { border-right: none; }

  .ci-card-stat-num {
    font-family: var(--g-font);
    font-size: 16px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: var(--g-text);
    line-height: 1;
  }

  /* ── Badges ── */
  .ci-card-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 6px 0;
  }

  .ci-badge {
    font-family: var(--g-font);
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 7px;
    border: 1px solid rgba(255,255,255,0.03);
    background: rgba(255,255,255,0.02);
    color: var(--g-text-3);
  }
  .ci-badge[data-tier="high"] {
    border-color: rgba(52,211,153,0.15);
    color: rgba(110,231,183,0.85);
  }
  .ci-badge[data-tier="low"] {
    border-color: rgba(255,255,255,0.02);
    color: var(--g-text-4);
  }

  /* Card tags */
  .ci-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  /* ── Expanded detail ── */
  .ci-card-detail {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.03);
    margin-top: 10px;
    animation: ci-detail-enter 0.5s var(--g-ease) both;
  }

  @keyframes ci-detail-enter {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .ci-detail-bio {
    font-size: 12px;
    color: var(--g-text-3);
    line-height: 1.55;
    margin: 0;
  }

  .ci-detail-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ci-detail-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .ci-detail-archetype {
    font-family: var(--g-font);
    font-style: italic;
    font-size: 13px;
    font-weight: 300;
    color: var(--g-text-3);
    margin: 0;
    line-height: 1.4;
  }

  /* Personality bars */
  .ci-pbar-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .ci-pbar {
    display: grid;
    grid-template-columns: 80px 1fr;
    align-items: center;
    gap: 8px;
  }
  .ci-pbar-label {
    font-family: var(--g-font-mono);
    font-size: 9px;
    color: var(--g-text-4);
  }
  .ci-pbar-track {
    height: 2px;
    background: rgba(255,255,255,0.04);
    border-radius: 1px;
    overflow: hidden;
  }
  .ci-pbar-fill {
    height: 100%;
    background: var(--g-accent);
    border-radius: 1px;
    transition: width 0.7s var(--g-ease);
  }

  /* ── Skeleton ── */
  .ci-skeleton {
    padding: 48px 0;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .ci-sk-featured {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 400px;
  }

  .ci-sk-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 11px;
  }

  .ci-sk-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-radius: var(--g-card-radius);
    padding: 20px;
    border: 1px solid rgba(255,255,255,0.02);
    background: rgba(255,255,255,0.015);
    opacity: 0;
    animation: ci-enter 0.4s var(--g-ease) forwards;
    animation-delay: calc(var(--i, 0) * 80ms);
  }

  .ci-sk-block {
    background: rgba(255,255,255,0.03);
    border-radius: 8px;
    animation: ci-shimmer 1.8s ease-in-out infinite;
  }

  .ci-sk-portrait { width: 100%; aspect-ratio: 3/4; border-radius: 14px; }
  .ci-sk-text-lg  { height: 24px; width: 60%; border-radius: 6px; }
  .ci-sk-text-sm  { height: 12px; width: 40%; border-radius: 4px; }
  .ci-sk-avatar   { width: 100%; aspect-ratio: 1; border-radius: 14px; }
  .ci-sk-name     { height: 14px; width: 70%; border-radius: 4px; }
  .ci-sk-handle   { height: 10px; width: 50%; border-radius: 4px; opacity: 0.6; }

  @keyframes ci-shimmer {
    0%, 100% { opacity: 0.25; }
    50%      { opacity: 0.5; }
  }

  /* ── Empty state ── */
  .ci-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 80px 28px;
    text-align: center;
  }

  .ci-empty-title {
    font-family: var(--g-font);
    font-size: 18px;
    font-weight: 500;
    color: var(--g-text-2);
    margin: 0;
  }

  .ci-empty-sub {
    font-size: 13px;
    color: var(--g-text-3);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  .ci-clear-btn {
    margin-top: 12px;
    font-family: var(--g-font);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 8px 20px;
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,0.04);
    background: rgba(255,255,255,0.025);
    color: var(--g-text-3);
    cursor: pointer;
    transition: all var(--g-dur) var(--g-ease);
  }
  .ci-clear-btn:hover {
    border-color: rgba(255,255,255,0.08);
    color: var(--g-text);
    background: rgba(255,255,255,0.04);
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .ci-header {
      flex-direction: column;
      align-items: flex-start;
    }
    .ci-header-count {
      align-items: flex-start;
    }
    .ci-featured-inner {
      grid-template-columns: 1fr;
    }
    .ci-featured-avatar {
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 9;
    }
    .ci-card.standard,
    .ci-card.wide,
    .ci-card.tall {
      grid-column: span 4;
    }
    .ci-card--expanded {
      grid-column: span 4 !important;
    }
    .ci-grid {
      grid-template-columns: repeat(4, 1fr);
    }
    .ci-sk-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 600px) {
    .ci-card.standard,
    .ci-card.wide,
    .ci-card.tall {
      grid-column: span 2;
    }
    .ci-card--expanded {
      grid-column: span 2 !important;
    }
    .ci-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .ci-sk-grid {
      grid-template-columns: 1fr;
    }
    .ci-featured-inner {
      padding: 20px;
    }
  }
</style>
