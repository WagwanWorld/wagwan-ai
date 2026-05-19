<script lang="ts">
  import { onMount } from 'svelte';
  import FollowerGrowthChart from './FollowerGrowthChart.svelte';
  import FollowerDemographics from './FollowerDemographics.svelte';
  import FollowerActivityHeatmap from './FollowerActivityHeatmap.svelte';
  import FollowerPostAttribution from './FollowerPostAttribution.svelte';
  import FollowerMomentum from './FollowerMomentum.svelte';

  let loading = true;
  let collecting = false;
  let collectStatus = '';
  let error = '';
  let range: '30d' | '90d' = '30d';
  let hasData = false;

  // Data state
  let summary: any = null;
  let growth: any = null;
  let demographics: Record<string, any[]> = { age: [], gender: [], city: [], country: [] };
  let heatmap: any = { grid: [], recommendedWindows: [] };
  let sources: any[] = [];
  let reachMix: any = null;
  let momentum: any = null;

  const fetchOpts = { credentials: 'include' as RequestCredentials };

  /** Fetch from Instagram API, save to DB, then reload */
  async function collectAndLoad() {
    collecting = true;
    collectStatus = 'Fetching from Instagram...';
    error = '';
    try {
      const res = await fetch('/api/brand/followers/collect', { method: 'POST', ...fetchOpts });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        error = j.error || 'Collection failed';
        collecting = false;
        return;
      }
      collectStatus = `Collected: ${(j.collected || []).join(', ')}`;
      if (j.errors?.length) {
        collectStatus += ` (warnings: ${j.errors.length})`;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Collection failed';
      collecting = false;
      return;
    }
    collecting = false;
    await loadAll();
  }

  async function loadAll() {
    loading = true;
    error = '';
    try {
      const [sumRes, growthRes, momRes] = await Promise.all([
        fetch('/api/brand/followers/summary', fetchOpts).then((r) => r.json()),
        fetch(`/api/brand/followers/growth?range=${range}`, fetchOpts).then((r) => r.json()),
        fetch('/api/brand/followers/momentum', fetchOpts).then((r) => r.json()),
      ]);
      summary = sumRes.ok ? sumRes.summary : null;
      growth = growthRes.ok ? growthRes : null;
      momentum = momRes.ok ? momRes : null;

      const [ageRes, genderRes, cityRes, countryRes, heatRes, srcRes, mixRes] = await Promise.all([
        fetch('/api/brand/followers/demographics?breakdown=age', fetchOpts)
          .then((r) => r.json())
          .catch(() => ({ data: [] })),
        fetch('/api/brand/followers/demographics?breakdown=gender', fetchOpts)
          .then((r) => r.json())
          .catch(() => ({ data: [] })),
        fetch('/api/brand/followers/demographics?breakdown=city', fetchOpts)
          .then((r) => r.json())
          .catch(() => ({ data: [] })),
        fetch('/api/brand/followers/demographics?breakdown=country', fetchOpts)
          .then((r) => r.json())
          .catch(() => ({ data: [] })),
        fetch('/api/brand/followers/activity-heatmap', fetchOpts)
          .then((r) => r.json())
          .catch(() => ({ grid: [], recommendedWindows: [] })),
        fetch(`/api/brand/followers/sources?range=${range}`, fetchOpts)
          .then((r) => r.json())
          .catch(() => ({ posts: [] })),
        fetch(`/api/brand/followers/reach-mix?range=${range}`, fetchOpts)
          .then((r) => r.json())
          .catch(() => null),
      ]);

      demographics = {
        age: ageRes.data || [],
        gender: genderRes.data || [],
        city: cityRes.data || [],
        country: countryRes.data || [],
      };
      heatmap = { grid: heatRes.grid || [], recommendedWindows: heatRes.recommendedWindows || [] };
      sources = srcRes.posts || [];
      reachMix = mixRes?.ok ? mixRes : null;

      // Check if we have any real data
      hasData = !!(
        summary?.current ||
        growth?.series?.length ||
        demographics.age.length ||
        heatmap.grid.length ||
        sources.length
      );
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load analytics';
    } finally {
      loading = false;
    }
  }

  function switchRange(r: '30d' | '90d') {
    range = r;
    void loadAll();
  }

  onMount(async () => {
    // Try loading from DB first
    await loadAll();
    // If no data, auto-collect from Instagram
    if (!hasData && !error) {
      await collectAndLoad();
    }
  });
</script>

<div class="fa-panel">
  {#if collectStatus}
    <div class="fa-collect-status">{collectStatus}</div>
  {/if}
  {#if error}
    <div class="fa-error">{error}</div>
  {/if}

  {#if (loading || collecting) && !growth}
    <div class="fa-loading">Loading follower analytics...</div>
  {:else}
    <!-- Demographics -->
    <FollowerDemographics
      age={demographics.age}
      gender={demographics.gender}
      city={demographics.city}
      country={demographics.country}
      {loading}
    />

    <!-- Growth Chart + Momentum -->
    <div class="fa-row-2col">
      <div class="fa-grow-chart">
        <FollowerGrowthChart series={growth?.series || []} {range} />
      </div>
      <div class="fa-momentum">
        <FollowerMomentum
          momentum={momentum?.momentum ?? 1}
          avg7d={momentum?.avg7d ?? 0}
          avg28d={momentum?.avg28d ?? 0}
          trend={momentum?.trend ?? 'steady'}
        />
      </div>
    </div>

    <!-- Reach Mix -->
    {#if reachMix}
      <div class="fa-reach-bar">
        <span class="fa-label">REACH MIX</span>
        <div class="fa-reach-track">
          <div
            class="fa-reach-follower"
            style="width:{reachMix.totalReach > 0 ? 100 - reachMix.nonFollowerPct : 50}%"
          >
            <span
              >Followers {reachMix.totalReach > 0
                ? (100 - reachMix.nonFollowerPct).toFixed(0)
                : '—'}%</span
            >
          </div>
          <div class="fa-reach-new" style="width:{reachMix.nonFollowerPct || 50}%">
            <span>New {reachMix.nonFollowerPct?.toFixed(0) || '—'}%</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Heatmap -->
    <FollowerActivityHeatmap
      grid={heatmap.grid}
      recommendedWindows={heatmap.recommendedWindows}
      {loading}
    />

    <!-- Post Attribution -->
    <FollowerPostAttribution posts={sources} {loading} />
  {/if}
</div>

<style>
  .fa-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  .fa-collect-status {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 10px;
    color: #4ade80;
    padding: 8px 14px;
    background: rgba(74, 222, 128, 0.06);
    border-radius: 8px;
  }
  .fa-error {
    color: #f87171;
    font-family: 'Geist Mono Variable', monospace;
    font-size: 11px;
    padding: 10px 14px;
    background: rgba(248, 113, 113, 0.06);
    border-radius: 8px;
  }
  .fa-loading {
    color: #6a6a72;
    font-family: 'PP Mori', sans-serif;
    font-size: 14px;
    text-align: center;
    padding: 40px;
  }

  .fa-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
    display: block;
    margin-bottom: 8px;
  }

  /* Growth + Momentum row */
  .fa-row-2col {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 12px;
  }

  /* Reach mix bar */
  .fa-reach-bar {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 14px 16px;
  }
  .fa-reach-track {
    display: flex;
    height: 28px;
    border-radius: 6px;
    overflow: hidden;
  }
  .fa-reach-follower {
    background: rgba(232, 131, 58, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: width 0.3s ease;
  }
  .fa-reach-new {
    background: rgba(77, 124, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: width 0.3s ease;
  }
  .fa-reach-follower span,
  .fa-reach-new span {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 9px;
    font-weight: 600;
    color: #ededef;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .fa-row-2col {
      grid-template-columns: 1fr;
    }
  }
</style>
