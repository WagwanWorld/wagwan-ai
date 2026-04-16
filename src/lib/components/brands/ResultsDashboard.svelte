<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import DashboardSummaryBar from './DashboardSummaryBar.svelte';
  import CreatorCard from './CreatorCard.svelte';
  import StickyLaunchBar from './StickyLaunchBar.svelte';
  import LaunchModal from './LaunchModal.svelte';

  type MatchedCreator = {
    creator: {
      google_sub: string;
      name: string;
      handle: string;
      follower_count: number;
      content_themes: string[];
      location: string;
      rates: { ig_post_rate_inr: number; ig_story_rate_inr: number; ig_reel_rate_inr: number; available: boolean } | null;
      graph_strength: number;
    };
    score: number;
    reasoning: string;
    watch_out: string;
  };

  export let matches: MatchedCreator[] = [];
  export let brandName: string = '';

  const dispatch = createEventDispatcher<{
    startCampaign: { selected: string[]; title: string; creativeText: string; rewardInr: number; channels: { email: boolean; in_app: boolean; whatsapp: boolean } };
    startOver: void;
  }>();

  $: users = matches.map(m => ({
    user_google_sub: m.creator.google_sub,
    name: m.creator.name,
    city: m.creator.location,
    match_score: m.score,
    match_score_breakdown: undefined as undefined,
    match_reason: m.reasoning,
    preview_tags: m.creator.content_themes.slice(0, 5),
    followers: m.creator.follower_count,
    graph_strength: m.creator.graph_strength,
    graph_strength_label: m.creator.graph_strength >= 65 ? 'high' : m.creator.graph_strength >= 35 ? 'medium' : 'low',
    rates: m.creator.rates ? {
      ig_post_rate_inr: m.creator.rates.ig_post_rate_inr,
      ig_story_rate_inr: m.creator.rates.ig_story_rate_inr,
      ig_reel_rate_inr: m.creator.rates.ig_reel_rate_inr,
      available: m.creator.rates.available,
    } : undefined,
  }));

  let selected = new Set<string>(matches.map(m => m.creator.google_sub));

  $: selectedUsers = users.filter(u => selected.has(u.user_google_sub));
  $: totalReach = selectedUsers.reduce((s, u) => s + (u.followers || 0), 0);
  $: estimatedCost = selectedUsers.reduce((s, u) => s + (u.rates?.ig_post_rate_inr ?? 0), 0) || null;
  $: avgMatchScore = users.length ? users.reduce((s, u) => s + u.match_score, 0) / users.length : 0;
  $: pctHighStrength = users.length
    ? Math.round(users.filter(u => u.graph_strength >= 65).length / users.length * 100)
    : 0;

  $: keyTraits = (() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      for (const t of u.preview_tags) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));
  })();

  $: costBreakdown = {
    posts: selectedUsers.filter(u => u.rates?.ig_post_rate_inr).length,
    stories: selectedUsers.filter(u => u.rates?.ig_story_rate_inr).length,
    reels: selectedUsers.filter(u => u.rates?.ig_reel_rate_inr).length,
  };

  let showLaunchModal = false;

  let memberBriefBySub: Record<string, { happening_now: string; do_next: string; missing: string }> = {};
  let memberBriefLoading: string | null = null;

  function toggleCreator(e: CustomEvent<string>) {
    const sub = e.detail;
    const next = new Set(selected);
    if (next.has(sub)) next.delete(sub);
    else next.add(sub);
    selected = next;
  }

  async function loadBrief(e: CustomEvent<string>) {
    const sub = e.detail;
    const user = users.find(u => u.user_google_sub === sub);
    if (!user) return;
    memberBriefLoading = sub;
    try {
      const res = await fetch('/api/brand/member-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_google_sub: sub, match_reason: user.match_reason }),
      });
      const j = await res.json();
      if (j.ok && j.brief) {
        memberBriefBySub = { ...memberBriefBySub, [sub]: j.brief };
      }
    } catch { /* ignore */ }
    finally { memberBriefLoading = null; }
  }

  function handleLaunchConfirm(e: CustomEvent<{ title: string; creativeText: string; rewardInr: number; channels: { email: boolean; in_app: boolean; whatsapp: boolean } }>) {
    showLaunchModal = false;
    dispatch('startCampaign', {
      selected: [...selected],
      ...e.detail,
    });
  }
</script>

<div class="dashboard-root">
  {#if matches.length === 0}
    <div class="empty-state">
      <h3 class="empty-title">No exact matches yet</h3>
      <p class="empty-text">Try broadening your criteria or adjusting your audience description.</p>
      <button class="empty-btn" on:click={() => dispatch('startOver')}>Try different criteria</button>
    </div>
  {:else}
    <DashboardSummaryBar
      creatorCount={users.length}
      selectedCount={selected.size}
      {totalReach}
      {estimatedCost}
      {avgMatchScore}
      {keyTraits}
      {pctHighStrength}
    />

    <div class="section-header">
      <h3 class="section-title">Your creators</h3>
      <p class="section-meta">{selected.size} selected &middot; click to expand, checkbox to select</p>
    </div>

    <div class="creator-grid">
      {#each users as user (user.user_google_sub)}
        <CreatorCard
          {user}
          selected={selected.has(user.user_google_sub)}
          brief={memberBriefBySub[user.user_google_sub] ?? null}
          briefLoading={memberBriefLoading === user.user_google_sub}
          on:toggle={toggleCreator}
          on:loadBrief={loadBrief}
        />
      {/each}
    </div>

    <StickyLaunchBar
      selectedCount={selected.size}
      totalCount={users.length}
      {totalReach}
      {estimatedCost}
      {costBreakdown}
      on:launch={() => showLaunchModal = true}
      on:startOver={() => dispatch('startOver')}
    />

    {#if showLaunchModal}
      <LaunchModal
        selectedCount={selected.size}
        {estimatedCost}
        {brandName}
        on:confirm={handleLaunchConfirm}
        on:close={() => showLaunchModal = false}
      />
    {/if}
  {/if}
</div>

<style>
  .dashboard-root {
    max-width: 72rem;
    margin: 0 auto;
    padding: 32px 24px 120px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  .section-meta {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .creator-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  @media (max-width: 768px) {
    .creator-grid { grid-template-columns: 1fr; }
  }

  .empty-state {
    text-align: center;
    padding: 60px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .empty-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  .empty-text {
    font-size: 14px;
    color: var(--text-muted);
    margin: 0;
    max-width: 400px;
    line-height: 1.5;
  }
  .empty-btn {
    margin-top: 8px;
    background: var(--accent-secondary, #4D7CFF);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .empty-btn:hover { opacity: 0.9; }
</style>
