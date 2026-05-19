<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import CreatorInvitePanel from '$lib/components/brands/CreatorInvitePanel.svelte';
  import CreatorRosterDashboard from '$lib/components/brands/CreatorRosterDashboard.svelte';
  import CreatorFeaturedCard from '$lib/components/brands/CreatorFeaturedCard.svelte';
  import { networkCreatorToView, type NetworkCreator } from '$lib/utils/creatorCardView';

  type PageTab = 'roster' | 'invite' | 'network';

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
  let activeTab: PageTab = 'invite';
  let rosterCount = 0;
  let rosterHandles = new Set<string>();
  let rosterBusyHandle: string | null = null;
  let networkToast = '';

  $: brandAuthenticated = $page.data.brandAuthenticated ?? false;
  $: inviteBrandName =
    $page.data.brandAccount?.ig_name?.trim() ||
    $page.data.brandAccount?.ig_username?.trim() ||
    'Brand';

  function toggleExpand(creator: Creator) {
    const key = `${creator.name}::${creator.handle}`;
    expandedCreator = expandedCreator === key ? null : key;
  }

  function isExpanded(creator: Creator): boolean {
    return expandedCreator === `${creator.name}::${creator.handle}`;
  }

  // Featured creator = first with highest strength
  $: featured =
    filtered.length > 0 ? [...filtered].sort((a, b) => b.strength - a.strength)[0] : null;

  // Rest of creators (excluding featured)
  $: rest = featured ? filtered.filter((c) => c !== featured) : [];

  // Unique archetype tags for filter chips
  $: allTags = [...new Set(creators.flatMap((c) => [...c.vibeTags, ...c.contentTags]))].slice(
    0,
    12,
  );

  async function fetchRosterState() {
    if (!brandAuthenticated) return;
    try {
      const res = await fetch('/api/brand/creator-roster', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        rosterCount = data.count ?? data.roster?.length ?? 0;
        rosterHandles = new Set(
          (data.roster ?? []).map((r: { ig_username: string }) =>
            String(r.ig_username).toLowerCase(),
          ),
        );
        if (rosterCount > 0 && activeTab === 'invite') activeTab = 'roster';
      }
    } catch {
      /* ignore */
    }
  }

  function showNetworkToast(msg: string) {
    networkToast = msg;
    setTimeout(() => (networkToast = ''), 2800);
  }

  function isInRoster(creator: Creator): boolean {
    const h = creator.handle?.replace(/^@/, '').toLowerCase();
    return Boolean(h && rosterHandles.has(h));
  }

  async function addToRoster(creator: Creator, e?: Event) {
    e?.stopPropagation();
    if (!brandAuthenticated || !creator.handle || rosterBusyHandle) return;
    const handle = creator.handle.replace(/^@/, '');
    if (isInRoster(creator)) return;

    rosterBusyHandle = handle;
    try {
      const res = await fetch('/api/brand/creator-roster/from-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ instagram: handle }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNetworkToast(data.message || 'Could not add to roster');
        return;
      }
      rosterHandles.add(handle.toLowerCase());
      rosterHandles = rosterHandles;
      rosterCount += 1;
      showNetworkToast(`Added @${handle} to your roster`);
    } catch {
      showNetworkToast('Something went wrong');
    } finally {
      rosterBusyHandle = null;
    }
  }

  function onInviteRosterUpdated() {
    fetchRosterState();
  }

  function onRosterUpdated(e: CustomEvent<{ count: number }>) {
    rosterCount = e.detail.count;
    fetchRosterState();
  }

  onMount(async () => {
    await fetchRosterState();
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

  $: filtered = creators.filter((c) => {
    const matchesQuery =
      !query.trim() ||
      (() => {
        const q = query.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.archetype.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          c.contentTags.some((t) => t.toLowerCase().includes(q)) ||
          c.vibeTags.some((t) => t.toLowerCase().includes(q))
        );
      })();

    const matchesFilter =
      activeFilter === 'all' ||
      c.vibeTags.some((t) => t.toLowerCase() === activeFilter.toLowerCase()) ||
      c.contentTags.some((t) => t.toLowerCase() === activeFilter.toLowerCase());

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
    const pattern = [
      'tall',
      'wide',
      'standard',
      'standard',
      'wide',
      'standard',
      'tall',
      'standard',
    ];
    return pattern[index % pattern.length];
  }
</script>

<div class="ci-page">
  <!-- Page header -->
  <header class="ci-header">
    <div class="ci-header-text">
      <h1 class="ci-title">Creator Index</h1>
      <p class="ci-subtitle">
        A curated directory of creators in the Wagwan network. Real people, real audiences, real
        signal depth.
      </p>
    </div>
    <div class="ci-header-count">
      {#if activeTab === 'network'}
        <span class="ci-count-num">{loading ? '—' : filtered.length}</span>
        <span class="ci-count-label">Creators</span>
      {:else if activeTab === 'roster'}
        <span class="ci-count-num">{rosterCount}</span>
        <span class="ci-count-label">In roster</span>
      {:else}
        <span class="ci-count-num">—</span>
        <span class="ci-count-label">Invite</span>
      {/if}
    </div>
  </header>

  <nav class="ci-tabs" aria-label="Find creators sections">
    <button
      type="button"
      class="ci-tab"
      class:ci-tab--active={activeTab === 'roster'}
      on:click={() => (activeTab = 'roster')}
    >
      My roster
      {#if rosterCount > 0}
        <span class="ci-tab-badge">{rosterCount}</span>
      {/if}
    </button>
    <button
      type="button"
      class="ci-tab"
      class:ci-tab--active={activeTab === 'invite'}
      on:click={() => (activeTab = 'invite')}
    >
      Invite
    </button>
    <button
      type="button"
      class="ci-tab"
      class:ci-tab--active={activeTab === 'network'}
      on:click={() => (activeTab = 'network')}
    >
      Network index
    </button>
  </nav>

  {#if activeTab === 'roster'}
    <CreatorRosterDashboard
      {brandAuthenticated}
      on:goInvite={() => (activeTab = 'invite')}
      on:rosterUpdated={onRosterUpdated}
    />
  {:else if activeTab === 'invite'}
    <CreatorInvitePanel
      {brandAuthenticated}
      brandName={inviteBrandName}
      on:goRoster={() => (activeTab = 'roster')}
      on:rosterUpdated={onInviteRosterUpdated}
    />
  {:else}
    <!-- Search -->
    <div class="ci-search-wrap">
      <svg class="ci-search-icon" width="14" height="14" viewBox="0 0 15 15" fill="none">
        <path
          d="M10 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM12 12l-2.5-2.5"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
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
            <path
              d="M2 2l8 8M10 2L2 10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
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
          on:click={() => (activeFilter = 'all')}>All</button
        >
        {#each allTags as tag}
          <button
            class="ci-chip"
            class:active={activeFilter === tag}
            on:click={() => (activeFilter = activeFilter === tag ? 'all' : tag)}>{tag}</button
          >
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
        <p class="ci-empty-sub">
          {query ? 'Try a different search or clear filters.' : 'Check back soon.'}
        </p>
        {#if query}
          <button
            class="ci-clear-btn"
            on:click={() => {
              query = '';
              activeFilter = 'all';
            }}>Clear all</button
          >
        {/if}
      </section>
    {:else}
      {#if featured}
        <CreatorFeaturedCard creator={networkCreatorToView(featured as NetworkCreator)}>
          <svelte:fragment slot="actions">
            {#if brandAuthenticated && featured.handle}
              {#if isInRoster(featured)}
                <button type="button" class="ci-roster-btn ci-roster-btn--done" disabled
                  >In roster</button
                >
              {:else}
                <button
                  type="button"
                  class="ci-roster-btn ci-roster-btn--primary"
                  disabled={rosterBusyHandle === featured.handle.replace(/^@/, '')}
                  on:click={(e) => addToRoster(featured, e)}
                >
                  {rosterBusyHandle === featured.handle.replace(/^@/, '')
                    ? 'Adding…'
                    : 'Add to roster'}
                </button>
              {/if}
            {/if}
          </svelte:fragment>
        </CreatorFeaturedCard>
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
            <!-- Top: avatar + name + handle -->
            <div class="ci-card-top">
              <div class="ci-card-avatar">
                {#if creator.profilePicture}
                  <img src={creator.profilePicture} alt={creator.name} class="ci-card-photo" />
                {:else}
                  <div class="ci-card-gradient" style="background: {avatarGradient(creator.name)}">
                    <span class="ci-card-initial">{creator.initial}</span>
                  </div>
                {/if}
              </div>
              <div class="ci-card-intro">
                <h3 class="ci-card-name">{creator.name}</h3>
                <span class="ci-card-handle">
                  {#if creator.handle}@{creator.handle}{/if}
                  {#if creator.handle && creator.location}
                    ·
                  {/if}
                  {#if creator.location}{creator.location}{/if}
                </span>
              </div>
              {#if creator.engagementTier}
                <span class="ci-card-tier">{creator.engagementTier}</span>
              {/if}
            </div>

            <div class="ci-card-body">
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
                {#if creator.engagementTier}
                  <div class="ci-card-stat">
                    <span class="ci-card-stat-num ci-card-stat-num--lime"
                      >{creator.engagementTier}</span
                    >
                    <span class="ci-label">Engagement</span>
                  </div>
                {/if}
              </div>

              <!-- Strength bar -->
              <div class="ci-strength">
                <div class="ci-strength-track">
                  <div class="ci-strength-fill" style="width: {creator.strength}%"></div>
                </div>
                <span class="ci-strength-label">{creator.strengthLabel}</span>
              </div>

              <!-- Tags: aesthetic + categories + brand vibes -->
              <div class="ci-card-tags">
                {#if creator.aesthetic}
                  <span class="ci-pill ci-pill--accent">{creator.aesthetic}</span>
                {/if}
                {#each [...creator.contentCategories, ...creator.interests].slice(0, 3) as tag}
                  <span class="ci-pill ci-pill--sm">{tag}</span>
                {/each}
              </div>

              {#if creator.brandVibes.length > 0}
                <div class="ci-card-tags">
                  {#each creator.brandVibes.slice(0, 3) as vibe}
                    <span class="ci-pill ci-pill--muted">{vibe}</span>
                  {/each}
                </div>
              {/if}

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
                          <div class="ci-pbar-track">
                            <div
                              class="ci-pbar-fill"
                              style="width: {creator.personality.expressive * 100}%"
                            ></div>
                          </div>
                        </div>
                        <div class="ci-pbar">
                          <span class="ci-pbar-label">Humor</span>
                          <div class="ci-pbar-track">
                            <div
                              class="ci-pbar-fill"
                              style="width: {creator.personality.humor * 100}%"
                            ></div>
                          </div>
                        </div>
                        <div class="ci-pbar">
                          <span class="ci-pbar-label">Introspective</span>
                          <div class="ci-pbar-track">
                            <div
                              class="ci-pbar-fill"
                              style="width: {creator.personality.introspective * 100}%"
                            ></div>
                          </div>
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

                  {#if brandAuthenticated && creator.handle}
                    <div class="ci-card-roster-actions">
                      {#if isInRoster(creator)}
                        <button type="button" class="ci-roster-btn ci-roster-btn--done" disabled
                          >In roster</button
                        >
                      {:else}
                        <button
                          type="button"
                          class="ci-roster-btn"
                          disabled={rosterBusyHandle === creator.handle.replace(/^@/, '')}
                          on:click|stopPropagation={(e) => addToRoster(creator, e)}
                        >
                          {rosterBusyHandle === creator.handle.replace(/^@/, '')
                            ? 'Adding…'
                            : 'Add to roster'}
                        </button>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </article>
        {/each}
      </section>
    {/if}
  {/if}

  {#if networkToast}
    <p class="ci-network-toast" role="status">{networkToast}</p>
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
  .ci-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .ci-tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: transparent;
    color: #8b8b94;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s,
      border-color 0.15s;
  }

  .ci-tab:hover {
    color: #ededef;
    border-color: rgba(255, 255, 255, 0.12);
  }

  .ci-tab--active {
    background: rgba(255, 255, 255, 0.08);
    color: #ededef;
    border-color: rgba(255, 255, 255, 0.14);
  }

  .ci-tab-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(201, 184, 150, 0.2);
    color: #c9b896;
  }

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
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #ededef;
    margin: 0;
    line-height: 1.1;
  }

  .ci-subtitle {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 13px;
    color: #4a4a50;
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
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 42px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: #ededef;
    line-height: 1;
  }

  .ci-count-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  /* ── Label pattern (reusable) ── */
  .ci-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
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
    color: rgba(255, 255, 255, 0.1);
    pointer-events: none;
  }

  .ci-search {
    width: 100%;
    box-sizing: border-box;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding: 10px 28px 10px 22px;
    font-size: 13px;
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    color: #ededef;
    outline: none;
    transition: border-color 0.2s ease;
  }
  .ci-search::placeholder {
    color: rgba(255, 255, 255, 0.1);
  }
  .ci-search:focus {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .ci-search-clear {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.1);
    cursor: pointer;
    padding: 4px;
    transition: color 0.4s ease;
  }
  .ci-search-clear:hover {
    color: #ededef;
  }

  /* ── Filter chips ── */
  .ci-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 32px;
  }

  .ci-chip {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 5px 13px;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.02);
    background: rgba(255, 255, 255, 0.025);
    color: #4a4a50;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .ci-chip:hover {
    border-color: rgba(255, 255, 255, 0.06);
    color: #8a8a92;
    background: rgba(255, 255, 255, 0.04);
  }
  .ci-chip.active {
    background: rgba(255, 255, 255, 0.06);
    border-color: #e8833a;
    color: #ededef;
  }

  /* ── Glass pill (tag) ── */
  .ci-pill {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 4px 11px;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.03);
    background: rgba(255, 255, 255, 0.025);
    color: #4a4a50;
  }
  .ci-pill--accent {
    border-color: rgba(255, 64, 64, 0.15);
    color: rgba(255, 125, 125, 0.85);
  }
  .ci-pill--sm {
    font-size: 9px;
    padding: 3px 9px;
  }

  .ci-pill--accent {
    font-size: 9px;
    padding: 3px 9px;
    background: rgba(196, 242, 74, 0.1);
    color: #c4f24a;
  }

  .ci-pill--muted {
    font-size: 9px;
    padding: 3px 9px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 248, 232, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  /* ── Featured creator card ── */
  .ci-featured {
    position: relative;
    overflow: hidden;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    box-shadow:
      0 1px 0 0 rgba(255, 255, 255, 0.03) inset,
      0 -1px 0 0 rgba(0, 0, 0, 0.15) inset,
      0 4px 16px rgba(0, 0, 0, 0.12),
      0 12px 40px rgba(0, 0, 0, 0.08);
    backdrop-filter: blur(0px);
    -webkit-backdrop-filter: blur(0px);
    margin-bottom: 32px;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    opacity: 0;
    animation: ci-enter 0.7s ease forwards;
  }
  .ci-featured:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow:
      0 1px 0 0 rgba(255, 255, 255, 0.04) inset,
      0 -1px 0 0 rgba(0, 0, 0, 0.12) inset,
      0 6px 20px rgba(0, 0, 0, 0.15),
      0 20px 50px rgba(0, 0, 0, 0.12);
  }

  /* Inner light on hover */
  .ci-featured::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 14px;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.015), transparent 45%);
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
  }
  .ci-featured:hover::after {
    opacity: 1;
  }

  .ci-featured-edge {
    position: absolute;
    top: 0;
    left: 16px;
    right: 16px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
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
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 4rem;
    font-weight: 300;
    color: rgba(255, 255, 255, 0.08);
    line-height: 1;
  }

  .ci-featured-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ci-featured-name {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.03em;
    color: #ededef;
    margin: 0;
    line-height: 1.1;
  }

  .ci-featured-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ci-meta-handle {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 12px;
    color: #4a4a50;
  }

  .ci-meta-loc {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 12px;
    color: #3a3a40;
    font-style: italic;
  }

  .ci-meta-tier {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #e8833a;
  }

  .ci-featured-stats {
    display: flex;
    gap: 28px;
    padding: 12px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.03);
  }

  .ci-fstat {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ci-fstat-num {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 22px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: #ededef;
    line-height: 1;
  }

  .ci-tier {
    text-transform: uppercase;
    font-size: 14px !important;
  }
  .ci-tier[data-tier='high'] {
    color: rgba(110, 231, 183, 0.85);
  }
  .ci-tier[data-tier='medium'] {
    color: #4a4a50;
  }

  .ci-featured-bio {
    font-size: 13px;
    color: #4a4a50;
    line-height: 1.55;
    margin: 0;
  }

  .ci-featured-archetype {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-style: italic;
    font-size: 15px;
    font-weight: 300;
    color: #8a8a92;
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
    background: rgba(255, 255, 255, 0.04);
    border-radius: 1px;
    overflow: hidden;
  }
  .ci-strength-fill {
    height: 100%;
    background: linear-gradient(90deg, #65ec7a, #c4f24a 58%, #ffbe1b);
    border-radius: 1px;
    transition: width 0.7s ease;
  }
  .ci-strength-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 500;
    color: #3a3a40;
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
    border: 1px solid rgba(255, 255, 255, 0.06);
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
    background: rgba(255, 255, 255, 0.04);
  }

  .ci-result-count {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #3a3a40;
    white-space: nowrap;
  }

  .ci-result-num {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    color: #4a4a50;
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
    border-radius: 20px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(12px);
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      transform 0.2s ease;
    opacity: 0;
    animation: ci-enter 0.7s ease forwards;
    animation-delay: calc(var(--i, 0) * 50ms);
  }

  .ci-card:hover {
    border-color: rgba(196, 242, 74, 0.2);
    transform: translateY(-2px);
  }

  /* Grid spans */
  .ci-card.standard {
    grid-column: span 4;
  }
  .ci-card.wide {
    grid-column: span 5;
  }
  .ci-card.tall {
    grid-column: span 3;
  }

  /* Expanded card */
  .ci-card--expanded {
    grid-column: span 12 !important;
  }

  @keyframes ci-enter {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Card avatar ── */
  /* ── Card top (avatar + intro) ── */
  .ci-card-top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .ci-card-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid rgba(196, 242, 74, 0.2);
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
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 1.1rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.3);
    line-height: 1;
  }

  .ci-card-intro {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ci-card-tier {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 100px;
    background: rgba(196, 242, 74, 0.1);
    color: #c4f24a;
    flex-shrink: 0;
    align-self: flex-start;
  }

  /* ── Card body ── */
  .ci-card-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ci-card-name {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #ededef;
    margin: 0;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ci-card-handle {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 11px;
    color: rgba(255, 248, 232, 0.4);
  }

  .ci-card-stat-num--lime {
    color: #c4f24a;
  }

  /* Stats row */
  .ci-card-stats {
    display: flex;
    gap: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    padding: 8px 0;
    margin: 8px 0 6px;
  }
  .ci-card-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    border-right: 1px solid rgba(255, 255, 255, 0.03);
  }
  .ci-card-stat:last-child {
    border-right: none;
  }

  .ci-card-stat-num {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 16px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: #ededef;
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
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 7px;
    border: 1px solid rgba(255, 255, 255, 0.03);
    background: rgba(255, 255, 255, 0.02);
    color: #4a4a50;
  }
  .ci-badge[data-tier='high'] {
    border-color: rgba(196, 242, 74, 0.15);
    color: #c4f24a;
  }
  .ci-badge[data-tier='low'] {
    border-color: rgba(255, 255, 255, 0.04);
    color: rgba(255, 248, 232, 0.35);
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
    border-top: 1px solid rgba(255, 255, 255, 0.03);
    margin-top: 10px;
    animation: ci-detail-enter 0.5s ease both;
  }

  @keyframes ci-detail-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .ci-detail-bio {
    font-size: 12px;
    color: #4a4a50;
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
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-style: italic;
    font-size: 13px;
    font-weight: 300;
    color: #4a4a50;
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
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    color: #3a3a40;
  }
  .ci-pbar-track {
    height: 2px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 1px;
    overflow: hidden;
  }
  .ci-pbar-fill {
    height: 100%;
    background: #e8833a;
    border-radius: 1px;
    transition: width 0.7s ease;
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
    border-radius: 14px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.02);
    background: rgba(255, 255, 255, 0.015);
    opacity: 0;
    animation: ci-enter 0.4s ease forwards;
    animation-delay: calc(var(--i, 0) * 80ms);
  }

  .ci-sk-block {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    animation: ci-shimmer 1.8s ease-in-out infinite;
  }

  .ci-sk-portrait {
    width: 100%;
    aspect-ratio: 3/4;
    border-radius: 14px;
  }
  .ci-sk-text-lg {
    height: 24px;
    width: 60%;
    border-radius: 6px;
  }
  .ci-sk-text-sm {
    height: 12px;
    width: 40%;
    border-radius: 4px;
  }
  .ci-sk-avatar {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 14px;
  }
  .ci-sk-name {
    height: 14px;
    width: 70%;
    border-radius: 4px;
  }
  .ci-sk-handle {
    height: 10px;
    width: 50%;
    border-radius: 4px;
    opacity: 0.6;
  }

  @keyframes ci-shimmer {
    0%,
    100% {
      opacity: 0.25;
    }
    50% {
      opacity: 0.5;
    }
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
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 18px;
    font-weight: 500;
    color: #8a8a92;
    margin: 0;
  }

  .ci-empty-sub {
    font-size: 13px;
    color: #4a4a50;
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  .ci-clear-btn {
    margin-top: 12px;
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 8px 20px;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.04);
    background: rgba(255, 255, 255, 0.025);
    color: #4a4a50;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .ci-clear-btn:hover {
    border-color: rgba(255, 255, 255, 0.08);
    color: #ededef;
    background: rgba(255, 255, 255, 0.04);
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

  .ci-roster-btn {
    min-height: 38px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: #ededef;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .ci-roster-btn--primary {
    background: #ededef;
    color: #0a0a0b;
    border-color: transparent;
  }

  .ci-roster-btn--done {
    opacity: 0.55;
    cursor: default;
  }

  .ci-roster-btn:disabled:not(.ci-roster-btn--done) {
    opacity: 0.5;
    cursor: wait;
  }

  .ci-card-roster-actions {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .ci-network-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 16px;
    border-radius: 8px;
    background: #2a2a30;
    color: #ededef;
    font-size: 13px;
    z-index: 100;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
</style>
