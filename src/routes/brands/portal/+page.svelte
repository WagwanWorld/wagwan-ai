<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import MatchAgentChat from '$lib/components/brands/MatchAgentChat.svelte';
  import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
  import Download from 'phosphor-svelte/lib/Download';
  import SignOut from 'phosphor-svelte/lib/SignOut';
  import Sparkle from 'phosphor-svelte/lib/Sparkle';
  import Note from 'phosphor-svelte/lib/Note';
  import X from 'phosphor-svelte/lib/X';

  export let data: { brandSessionValid: boolean };

  const loginNext = '/brands/login?next=/brands/portal';

  type ParsedAudience = {
    age_range: [number, number] | null;
    location: string | null;
    interests: string[];
    behaviors: string[];
    human_summary: string;
  };

  const presetChips = [
    { label: 'Nightlife audience', text: 'People who go out every weekend and care about music and venues.' },
    { label: 'Fashion-forward Gen Z', text: 'Gen Z into streetwear, drops, and underground music scenes.' },
    { label: 'Football community', text: 'Football players who train or play matches at least twice a week.' },
    { label: 'Music lovers', text: 'Heavy listeners who discover artists early and go to live shows.' },
    { label: 'High spenders', text: 'Urban professionals with premium taste in dining, travel, and brands.' },
  ];

  const ghostHints = [
    'People who go out every weekend',
    'Gen Z into streetwear and underground music',
    'Football players who play twice a week',
  ];

  let promptText = '';
  let ghostIdx = 0;
  let structured: ParsedAudience | null = null;
  let parseErr = '';
  let searching = false;
  let searchErr = '';

  let users: Array<{
    user_google_sub: string;
    name: string;
    city: string;
    match_score: number;
    match_reason: string;
    preview_tags: string[];
    graph_strength: number;
    graph_strength_label: string;
    rates?: {
      ig_post_rate_inr?: number;
      ig_story_rate_inr?: number;
      ig_reel_rate_inr?: number;
      available?: boolean;
    };
    graph_strength_score?: number;
  }> = [];

  let keyTraits: Array<{ tag: string; count: number }> = [];
  let audienceSize = 0;
  let estimatedEngagement = '';
  let estimatedCost: number | null = null;
  let avgGraphStrength = 0;
  let pctHighStrength = 0;
  let rankStrengthBoostApplied = false;

  let selected = new Set<string>();

  let portalTab: 'search' | 'agent' = 'agent';

  let rewardInr = 50;
  let campaignTitle = '';
  let creativeText = '';
  let brandName = 'Your brand';
  let channelEmail = false;
  let channelInApp = true;
  let campaignMsg = '';
  let creativeDropHint = '';

  let campaignPanelOpen = false;
  let dropActive = false;
  /** True after a successful search response (even if zero rows) — avoids snapping back to hero on empty DB. */
  let inResultsMode = false;

  type BrandAudienceIntel = {
    trying_to_achieve: string;
    struggling_with: string;
    content_that_converts: string;
    will_pay_for: string;
  };
  type BrandMemberBrief = {
    happening_now: string;
    do_next: string;
    missing: string;
  };

  let audienceIntel: BrandAudienceIntel | null = null;
  let audienceIntelLoading = false;
  let audienceIntelErr = '';
  let audienceIntelMembersUsed: number | null = null;

  let memberBriefBySub: Record<string, BrandMemberBrief> = {};
  let memberBriefLoading: string | null = null;
  let memberBriefErr = '';

  const fetchOpts: RequestInit = { credentials: 'include' };

  function jsonHeaders(): HeadersInit {
    return { 'Content-Type': 'application/json' };
  }

  function tileGradient(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    const h2 = (hue + 38) % 360;
    return `linear-gradient(145deg, hsl(${hue}, 42%, 18%), hsl(${h2}, 36%, 10%))`;
  }

  function initials(name: string): string {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }

  $: hasAudience = users.length > 0;

  $: insightCards = (() => {
    if (!hasAudience) return [];
    const out: { title: string; stat: string; caption: string }[] = [];
    if (keyTraits[0]) {
      out.push({
        title: keyTraits[0].tag,
        stat: `${Math.min(92, 52 + keyTraits[0].count * 5)}%`,
        caption: 'Affinity concentration in this pull.',
      });
    }
    if (keyTraits[1]) {
      out.push({
        title: 'Rhythm',
        stat: 'Fri–Sun',
        caption: `Lift around ${keyTraits[1].tag.toLowerCase()}.`,
      });
    }
    out.push({
      title: 'Graph depth',
      stat: `${pctHighStrength}%`,
      caption: 'Members with strong identity graphs (65+).',
    });
    return out.slice(0, 3);
  })();

  onMount(() => {
    const t = setInterval(() => {
      ghostIdx = (ghostIdx + 1) % ghostHints.length;
    }, 4200);
    return () => clearInterval(t);
  });

  function applyChip(text: string) {
    promptText = text;
  }

  async function signOut() {
    await fetch('/api/brands/logout', { method: 'POST', ...fetchOpts });
    await invalidateAll();
    await goto('/brands/portal', { replaceState: true });
  }

  async function runDiscovery() {
    parseErr = '';
    searchErr = '';
    structured = null;
    users = [];
    inResultsMode = false;
    if (!promptText.trim()) {
      parseErr = 'Describe who you are looking for.';
      return;
    }

    const rewardNum = Number(rewardInr);
    const rewardPayload = Number.isFinite(rewardNum) ? rewardNum : 50;

    searching = true;
    try {
      const pr = await fetch('/api/brand/parse-prompt', {
        method: 'POST',
        headers: jsonHeaders(),
        ...fetchOpts,
        body: JSON.stringify({ prompt: promptText, actorGoogleSub: null }),
      });
      let pj: Record<string, unknown>;
      try {
        pj = (await pr.json()) as Record<string, unknown>;
      } catch {
        parseErr = 'Server returned a non-JSON response. Is the dev server running?';
        return;
      }
      if (!pr.ok) {
        parseErr =
          (pj.message as string) ||
          (pj.error as string) ||
          `Parse failed (${pr.status})`;
        return;
      }
      structured = pj.structured as ParsedAudience;

      const sr = await fetch('/api/brand/search-audience', {
        method: 'POST',
        headers: jsonHeaders(),
        ...fetchOpts,
        body: JSON.stringify({
          structured,
          actorGoogleSub: null,
          limit: 60,
          reward_inr: rewardPayload,
        }),
      });
      let sj: Record<string, unknown>;
      try {
        sj = (await sr.json()) as Record<string, unknown>;
      } catch {
        searchErr = 'Search returned an invalid response.';
        users = [];
        return;
      }
      if (!sr.ok) {
        searchErr =
          (sj.message as string) ||
          (sj.error as string) ||
          `Search failed (${sr.status})`;
        users = [];
        return;
      }
      inResultsMode = true;
      users = (sj.users as typeof users) ?? [];
      keyTraits = (sj.key_traits as typeof keyTraits) ?? [];
      audienceSize = Number(sj.audience_size) || 0;
      estimatedEngagement = (sj.estimated_engagement as string) ?? '';
      estimatedCost =
        sj.estimated_cost_inr != null && Number.isFinite(Number(sj.estimated_cost_inr))
          ? Number(sj.estimated_cost_inr)
          : null;
      avgGraphStrength = Number(sj.avg_graph_strength) || 0;
      pctHighStrength = Number(sj.pct_high_strength_graphs) || 0;
      rankStrengthBoostApplied = Boolean(sj.rank_strength_boost_applied);
      selected = new Set(users.slice(0, 10).map(u => u.user_google_sub));
    } finally {
      searching = false;
    }
  }

  async function refineDiscovery() {
    if (!structured) {
      await runDiscovery();
      return;
    }
    searching = true;
    searchErr = '';
    try {
      const res = await fetch('/api/brand/search-audience', {
        method: 'POST',
        headers: jsonHeaders(),
        ...fetchOpts,
        body: JSON.stringify({
          structured,
          actorGoogleSub: null,
          limit: 60,
          reward_inr: Number(rewardInr),
        }),
      });
      let j: Record<string, unknown>;
      try {
        j = (await res.json()) as Record<string, unknown>;
      } catch {
        searchErr = 'Search returned an invalid response.';
        users = [];
        return;
      }
      if (!res.ok) {
        searchErr = (j.message as string) || (j.error as string) || 'Search failed';
        users = [];
        return;
      }
      inResultsMode = true;
      users = (j.users as typeof users) ?? [];
      keyTraits = (j.key_traits as typeof keyTraits) ?? [];
      audienceSize = Number(j.audience_size) || 0;
      estimatedEngagement = (j.estimated_engagement as string) ?? '';
      estimatedCost =
        j.estimated_cost_inr != null && Number.isFinite(Number(j.estimated_cost_inr))
          ? Number(j.estimated_cost_inr)
          : null;
      avgGraphStrength = Number(j.avg_graph_strength) || 0;
      pctHighStrength = Number(j.pct_high_strength_graphs) || 0;
      rankStrengthBoostApplied = Boolean(j.rank_strength_boost_applied);
      selected = new Set(users.slice(0, 10).map(u => u.user_google_sub));
    } finally {
      searching = false;
    }
  }

  function newScene() {
    users = [];
    structured = null;
    parseErr = '';
    searchErr = '';
    campaignPanelOpen = false;
    selected = new Set();
    inResultsMode = false;
    audienceIntel = null;
    audienceIntelErr = '';
    audienceIntelMembersUsed = null;
    memberBriefBySub = {};
    memberBriefErr = '';
  }

  function toggleRow(sub: string) {
    const next = new Set(selected);
    if (next.has(sub)) next.delete(sub);
    else next.add(sub);
    selected = next;
  }

  function selectTop(n: number) {
    selected = new Set(users.slice(0, n).map(u => u.user_google_sub));
  }

  async function runAudienceIntelligence() {
    audienceIntelErr = '';
    if (!structured || !users.length) {
      audienceIntelErr = 'Run discovery first.';
      return;
    }
    if (!data.brandSessionValid) {
      audienceIntelErr = 'Sign in to generate intelligence.';
      return;
    }
    const max = 32;
    const cohort =
      selected.size > 0
        ? users.filter(u => selected.has(u.user_google_sub)).slice(0, max)
        : users.slice(0, 24);
    if (!cohort.length) {
      audienceIntelErr = 'No members in cohort.';
      return;
    }
    audienceIntelLoading = true;
    audienceIntel = null;
    audienceIntelMembersUsed = null;
    try {
      const res = await fetch('/api/brand/audience-intelligence', {
        method: 'POST',
        headers: jsonHeaders(),
        ...fetchOpts,
        body: JSON.stringify({
          actorGoogleSub: null,
          structured,
          key_traits: keyTraits,
          members: cohort.map(u => ({
            user_google_sub: u.user_google_sub,
            match_score: u.match_score,
            match_reason: u.match_reason,
            preview_tags: u.preview_tags,
          })),
        }),
      });
      const j = (await res.json()) as Record<string, unknown>;
      if (!res.ok || !j.ok) {
        audienceIntelErr =
          (j.error as string) ||
          (j.message as string) ||
          `Request failed (${res.status})`;
        return;
      }
      audienceIntel = j.intel as BrandAudienceIntel;
      audienceIntelMembersUsed =
        typeof j.members_used === 'number' ? (j.members_used as number) : cohort.length;
    } catch {
      audienceIntelErr = 'Network error';
    } finally {
      audienceIntelLoading = false;
    }
  }

  async function loadMemberBrief(u: (typeof users)[number]) {
    memberBriefErr = '';
    if (!data.brandSessionValid) {
      memberBriefErr = 'Sign in to load briefs.';
      return;
    }
    memberBriefLoading = u.user_google_sub;
    try {
      const res = await fetch('/api/brand/member-brief', {
        method: 'POST',
        headers: jsonHeaders(),
        ...fetchOpts,
        body: JSON.stringify({
          actorGoogleSub: null,
          user_google_sub: u.user_google_sub,
          match_reason: u.match_reason,
        }),
      });
      const j = (await res.json()) as Record<string, unknown>;
      if (!res.ok || !j.ok) {
        memberBriefErr =
          (j.error as string) || (j.message as string) || `Brief failed (${res.status})`;
        return;
      }
      const b = j.brief as BrandMemberBrief;
      memberBriefBySub = { ...memberBriefBySub, [u.user_google_sub]: b };
    } catch {
      memberBriefErr = 'Network error';
    } finally {
      memberBriefLoading = null;
    }
  }

  async function createCampaign() {
    campaignMsg = '';
    if (!data.brandSessionValid) {
      await goto(loginNext);
      return;
    }
    if (!structured) {
      campaignMsg = 'Run discovery first.';
      return;
    }
    const targets = users
      .filter(u => selected.has(u.user_google_sub))
      .map(u => ({
        user_google_sub: u.user_google_sub,
        match_score: u.match_score,
        match_reason: u.match_reason,
      }));
    if (!targets.length) {
      campaignMsg = 'Select at least one person.';
      return;
    }
    if (!campaignTitle.trim()) {
      campaignMsg = 'Name this campaign.';
      return;
    }
    const res = await fetch('/api/brand/create-campaign', {
      method: 'POST',
      headers: jsonHeaders(),
      ...fetchOpts,
      body: JSON.stringify({
        actorGoogleSub: null,
        brand_name: brandName.trim(),
        title: campaignTitle.trim(),
        creative_text: creativeText,
        reward_inr: Number(rewardInr),
        structured_query: structured,
        channels: { email: channelEmail, in_app: channelInApp, whatsapp: false },
        targets,
      }),
    });
    let j: Record<string, unknown>;
    try {
      j = (await res.json()) as Record<string, unknown>;
    } catch {
      campaignMsg = 'Invalid server response';
      return;
    }
    if (!res.ok) {
      campaignMsg = (j.message as string) || (j.error as string) || 'Create failed';
      return;
    }
    campaignMsg = `Live · ${j.audience_count as number} people · ${String(j.campaign_id ?? '').slice(0, 8)}…`;
    campaignPanelOpen = false;
  }

  function exportCsv() {
    if (!data.brandSessionValid) return;
    const lines = ['google_sub,match_score,match_reason,name,city'];
    for (const u of users.filter(x => selected.has(x.user_google_sub))) {
      lines.push(
        `"${u.user_google_sub}",${u.match_score},"${u.match_reason.replace(/"/g, '""')}","${u.name}","${u.city}"`,
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wagwan-audience-selection.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function readCreativeFile(f: File) {
    if (f.type.startsWith('text/') || f.name.endsWith('.txt') || f.name.endsWith('.md')) {
      const r = new FileReader();
      r.onload = () => {
        creativeText = String(r.result ?? '');
        creativeDropHint = f.name;
      };
      r.readAsText(f);
    } else {
      creativeDropHint = `${f.name} — add your line below as copy`;
    }
  }

  function onCreativeDrop(e: DragEvent) {
    e.preventDefault();
    dropActive = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) readCreativeFile(f);
  }

  function onCreativeFilePick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    if (f) readCreativeFile(f);
    input.value = '';
  }
</script>

<div class="brand-studio relative min-h-[calc(100vh-56px)]">
  <!-- Ambient -->
  <div
    class="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_-30%,rgba(77,124,255,0.10),transparent)]"
    aria-hidden="true"
  ></div>

  <div class="mx-auto max-w-2xl px-4 pt-4">
    <div class="portal-tabs">
      <button class="portal-tab" class:active={portalTab === 'agent'} on:click={() => portalTab = 'agent'}>
        AI Match Agent
      </button>
      <button class="portal-tab" class:active={portalTab === 'search'} on:click={() => portalTab = 'search'}>
        Quick Search
      </button>
    </div>
  </div>

  {#if portalTab === 'agent'}
    <div class="portal-agent-wrap">
      <MatchAgentChat />
    </div>
  {:else}

  {#if !inResultsMode}
    <!-- Hero -->
    <section class="relative z-10 flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-4 py-16">
      <p class="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-600">
        Describe your audience
      </p>
      <h1 class="max-w-3xl text-center text-3xl font-semibold leading-tight text-white md:text-5xl">
        Who are you directing
        <span class="bg-gradient-to-r from-[#FF4D4D] via-white to-[#FFB84D] bg-clip-text text-transparent">
          tonight?
        </span>
      </h1>

      <div class="relative mt-12 w-full max-w-2xl">
        <label for="studio-prompt" class="sr-only">Audience prompt</label>
        <textarea
          id="studio-prompt"
          class="studio-textarea min-h-[140px] w-full resize-none rounded-2xl border border-white/[0.08] bg-[#111113]/90 px-5 py-4 text-base leading-relaxed text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_24px_80px_-24px_rgba(0,0,0,0.6)] outline-none transition-[border,box-shadow] duration-300 placeholder:text-zinc-700 md:min-h-[120px] md:text-lg"
          bind:value={promptText}
          placeholder={ghostHints[ghostIdx]}
        ></textarea>
        <div class="mt-3 flex flex-wrap justify-center gap-2">
          {#each presetChips as chip}
            <button
              type="button"
              class="preset-chip rounded-full border border-white/[0.07] bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-zinc-400 transition-all duration-300"
              on:click={() => applyChip(chip.text)}
            >
              {chip.label}
            </button>
          {/each}
        </div>
      </div>

      <button
        type="button"
        disabled={searching}
        class="group mt-10 inline-flex items-center gap-2 rounded-full bg-white px-10 py-3.5 text-sm font-semibold text-[#0B0B0D] shadow-[0_0_40px_rgba(255,255,255,0.08)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_56px_rgba(77,124,255,0.22)] disabled:opacity-50"
        on:click={() => runDiscovery()}
      >
        {searching ? 'Composing…' : 'Discover audience'}
        {#if !searching}<ArrowRight size={18} class="transition-transform group-hover:translate-x-0.5" />{/if}
      </button>

      {#if parseErr || searchErr}
        <p class="mt-6 max-w-md text-center text-sm text-red-400/90">{parseErr || searchErr}</p>
      {/if}

      <div class="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-4 text-xs text-zinc-600">
        {#if data.brandSessionValid}
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-white"
            on:click={() => signOut()}
          >
            <SignOut size={14} /> Sign out
          </button>
        {:else}
          <a href={loginNext} class="text-zinc-500 underline-offset-4 hover:text-[var(--accent-secondary)] hover:underline">
            Operator sign-in
          </a>
        {/if}
      </div>
    </section>
  {:else}
    <!-- Results -->
    <div class="relative z-10 pb-28 pt-6 md:pt-8">
      <!-- Docked prompt -->
      <div
        class="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0B0B0D]/85 px-4 py-4 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0B0B0D]/70"
      >
        <div class="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-end">
          <div class="min-w-0 flex-1">
            <label for="studio-prompt-dock" class="sr-only">Refine prompt</label>
            <textarea
              id="studio-prompt-dock"
              class="studio-textarea min-h-[72px] w-full resize-y rounded-xl border border-white/[0.08] bg-[#111113] px-4 py-3 text-sm text-zinc-100 outline-none transition-colors md:min-h-[56px]"
              bind:value={promptText}
            ></textarea>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={searching}
              class="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0B0B0D] transition-opacity disabled:opacity-50"
              on:click={() => runDiscovery()}
            >
              {searching ? '…' : 'Re-run'}
            </button>
            <button
              type="button"
              class="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
              on:click={() => refineDiscovery()}
            >
              Refresh match
            </button>
            <button
              type="button"
              class="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-500 transition-colors hover:border-red-500/30 hover:text-red-300"
              on:click={() => newScene()}
            >
              New scene
            </button>
          </div>
        </div>
      </div>

      <div class="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {#if users.length === 0}
          <div
            class="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-5 py-4 text-sm leading-relaxed text-amber-100/95"
            role="status"
          >
            <strong class="text-amber-50">No results found.</strong>
            Try broadening your search — use fewer constraints or describe a wider audience.
          </div>
        {/if}
        <!-- Top bar -->
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Live audience</p>
            <h2 class="mt-2 text-3xl font-semibold text-white md:text-4xl">
              {audienceSize.toLocaleString()} people
              <span class="text-zinc-600">found</span>
            </h2>
            {#if structured}
              <p class="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                {structured.human_summary}
              </p>
            {/if}
          </div>
          <div class="flex flex-wrap gap-2">
            {#if data.brandSessionValid}
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-400 transition-all hover:border-white/20 hover:text-white"
                on:click={() => exportCsv()}
              >
                <Download size={14} /> Export
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-400 transition-all hover:border-white/20 hover:text-white"
                on:click={() => signOut()}
              >
                <SignOut size={14} /> Out
              </button>
            {/if}
            <button
              type="button"
              class="launch-btn rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-[transform,box-shadow] duration-300 hover:scale-[1.02]"
              on:click={() => (campaignPanelOpen = true)}
            >
              Launch campaign
            </button>
          </div>
        </div>

        <!-- Overview + mosaic -->
        <div class="grid gap-6 lg:grid-cols-12">
          <div
            class="lg:col-span-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 shadow-[0_0_60px_rgba(0,0,0,0.35)] backdrop-blur-md transition-[border,box-shadow] duration-300 hover:border-white/10 {users.length === 0
              ? 'opacity-60'
              : ''}"
          >
            <div class="flex items-center gap-2 text-[var(--accent-secondary)]">
              <Sparkle size={18} weight="light" />
              <span class="text-xs font-medium uppercase tracking-wider">Overview</span>
            </div>
            <div class="mt-4 space-y-4 text-sm">
              <div class="flex justify-between border-b border-white/[0.06] py-2 text-zinc-400">
                <span>Engagement</span>
                <span class="font-medium text-white">{estimatedEngagement || '—'}</span>
              </div>
              <div class="flex justify-between border-b border-white/[0.06] py-2 text-zinc-400">
                <span>Est. investment</span>
                <span class="font-medium text-white">
                  {#if estimatedCost != null}₹{estimatedCost.toLocaleString()} @ ₹{rewardInr}{:else}—{/if}
                </span>
              </div>
              <div class="flex justify-between py-2 text-zinc-400">
                <span>Avg. signal</span>
                <span class="font-medium text-white">{avgGraphStrength}/100</span>
              </div>
            </div>
            {#if structured && (structured.interests.length || structured.behaviors.length)}
              <div class="mt-5 flex flex-wrap gap-2">
                {#each structured.interests.slice(0, 6) as t}
                  <span class="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-300"
                    >{t}</span
                  >
                {/each}
                {#each structured.behaviors.slice(0, 4) as b}
                  <span class="rounded-full border border-[rgba(77,124,255,0.2)] bg-[rgba(77,124,255,0.1)] px-2.5 py-1 text-[11px] text-[#8BABFF]"
                    >{b}</span
                  >
                {/each}
              </div>
            {/if}
          </div>

          <div class="lg:col-span-7">
            <p class="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">The mosaic</p>
            <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {#each users.slice(0, 12) as u}
                <div
                  class="mosaic-tile group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06] transition-all duration-300 hover:z-10 hover:scale-[1.04]"
                  style:background={tileGradient(u.user_google_sub)}
                  title={u.name}
                >
                  <div
                    class="absolute inset-0 flex items-center justify-center text-lg font-semibold text-white/90"
                  >
                    {initials(u.name)}
                  </div>
                  <div
                    class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  ></div>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Insight floats -->
        {#if insightCards.length}
          <div class="grid gap-4 sm:grid-cols-3">
            {#each insightCards as card}
              <div
                class="insight-card rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-5 transition-all duration-300"
              >
                <p class="text-2xl font-semibold tabular-nums text-white">{card.stat}</p>
                <p class="mt-1 text-sm font-medium text-zinc-200">{card.title}</p>
                <p class="mt-2 text-xs leading-relaxed text-zinc-500">{card.caption}</p>
              </div>
            {/each}
          </div>
        {/if}

        {#if rankStrengthBoostApplied}
          <p class="text-center text-xs text-[var(--accent-secondary)] opacity-80">Signal-strength rank boost is enabled.</p>
        {/if}

        {#if users.length > 0}
          <div
            class="audience-intel-panel rounded-2xl p-6"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-tertiary)]">
                  Audience intelligence
                </p>
                <p class="mt-2 max-w-xl text-sm text-zinc-400">
                  Monetization read on this pull — goals, friction, converting content, paid wedge. Uses selected rows
                  if any, otherwise the top 24 matches.
                </p>
              </div>
              <button
                type="button"
                disabled={audienceIntelLoading}
                class="generate-intel-btn shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-50"
                on:click={() => runAudienceIntelligence()}
              >
                {audienceIntelLoading ? 'Generating…' : 'Generate'}
              </button>
            </div>
            {#if audienceIntelErr}
              <p class="mt-3 text-sm text-red-400/90">{audienceIntelErr}</p>
            {/if}
            {#if audienceIntelMembersUsed != null && audienceIntel}
              <p class="mt-2 text-xs text-zinc-500">Based on {audienceIntelMembersUsed} profiles.</p>
            {/if}
            {#if audienceIntel}
              <div class="mt-5 grid gap-4 sm:grid-cols-2">
                <div class="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                  <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Trying to achieve</p>
                  <p class="mt-2 text-sm leading-relaxed text-zinc-200">{audienceIntel.trying_to_achieve}</p>
                </div>
                <div class="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                  <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Struggling with</p>
                  <p class="mt-2 text-sm leading-relaxed text-zinc-200">{audienceIntel.struggling_with}</p>
                </div>
                <div class="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                  <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Content that converts</p>
                  <p class="mt-2 text-sm leading-relaxed text-zinc-200">{audienceIntel.content_that_converts}</p>
                </div>
                <div class="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                  <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Will pay for</p>
                  <p class="mt-2 text-sm leading-relaxed text-zinc-200">{audienceIntel.will_pay_for}</p>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Member deck (cards, not table) -->
        <div>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-zinc-500">
              <span class="text-white">{selected.size}</span> selected · tap cards to curate
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:text-white"
                on:click={() => selectTop(10)}>Top 10</button
              >
              <button
                type="button"
                class="rounded-lg border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:text-white"
                on:click={() => selectTop(25)}>Top 25</button
              >
            </div>
          </div>
          {#if memberBriefErr}
            <p class="mb-2 text-center text-xs text-red-400/90">{memberBriefErr}</p>
          {/if}
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {#each users as u}
              <div
                class="flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 {selected.has(
                  u.user_google_sub,
                )
                  ? 'border-[rgba(77,124,255,0.5)] bg-[rgba(77,124,255,0.1)] shadow-[0_0_24px_rgba(77,124,255,0.15)]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'}"
              >
                <button
                  type="button"
                  class="flex w-full flex-col p-4 text-left"
                  on:click={() => toggleRow(u.user_google_sub)}
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-3">
                      <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style:background={tileGradient(u.user_google_sub)}
                      >
                        {initials(u.name)}
                      </div>
                      <div class="min-w-0">
                        <p class="truncate font-medium text-white">{u.name}</p>
                        <p class="truncate text-xs text-zinc-500">{u.city || '—'}</p>
                      </div>
                    </div>
                    <span
                      class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide {u.graph_strength_label ===
                      'high'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : u.graph_strength_label === 'medium'
                          ? 'bg-amber-500/20 text-amber-200'
                          : 'bg-zinc-500/20 text-zinc-400'}"
                    >
                      {typeof u.graph_strength === 'number' ? u.graph_strength : '—'}
                    </span>
                  </div>
                  <div class="mt-3 flex items-center justify-between text-xs">
                    <span class="tabular-nums text-[var(--accent-secondary)] opacity-90">Match {u.match_score}</span>
                    <span class="max-w-[65%] truncate text-zinc-500">{u.preview_tags.join(' · ')}</span>
                  </div>
                  <p class="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">{u.match_reason}</p>
                  {#if u.rates?.available}
                    <div class="brand-user-rates">
                      {#if u.rates.ig_post_rate_inr}<span>📸 ₹{u.rates.ig_post_rate_inr}</span>{/if}
                      {#if u.rates.ig_story_rate_inr}<span>📱 ₹{u.rates.ig_story_rate_inr}</span>{/if}
                      {#if u.rates.ig_reel_rate_inr}<span>🎬 ₹{u.rates.ig_reel_rate_inr}</span>{/if}
                    </div>
                  {/if}
                </button>
                <div class="border-t border-white/[0.06] bg-black/20 px-4 py-3">
                  <button
                    type="button"
                    disabled={memberBriefLoading === u.user_google_sub}
                    class="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-tertiary)] opacity-90 transition-colors hover:opacity-100 disabled:opacity-50"
                    on:click={() => loadMemberBrief(u)}
                  >
                    <Note size={14} />
                    {memberBriefLoading === u.user_google_sub ? 'Brief…' : 'Member brief'}
                  </button>
                  {#if memberBriefBySub[u.user_google_sub]}
                    <div class="mt-3 space-y-2 text-xs leading-relaxed text-zinc-300">
                      <p>
                        <span class="font-semibold text-zinc-500">Now · </span>
                        {memberBriefBySub[u.user_google_sub].happening_now}
                      </p>
                      <p>
                        <span class="font-semibold text-zinc-500">Next · </span>
                        {memberBriefBySub[u.user_google_sub].do_next}
                      </p>
                      <p>
                        <span class="font-semibold text-zinc-500">Missing · </span>
                        {memberBriefBySub[u.user_google_sub].missing}
                      </p>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Campaign slide-over -->
  {#if campaignPanelOpen}
    <div
      class="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm transition-opacity duration-300"
      role="presentation"
      on:click={() => (campaignPanelOpen = false)}
    ></div>
    <aside
      class="fixed inset-y-0 right-0 z-[90] flex w-full max-w-md flex-col border-l border-white/[0.08] bg-[#111113] shadow-[-16px_0_64px_rgba(0,0,0,0.5)]"
      aria-label="Campaign launch"
    >
      <div
        class="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"
      >
        <h3 class="text-sm font-semibold tracking-wide text-white">Launch campaign</h3>
        <button
          type="button"
          class="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
          on:click={() => (campaignPanelOpen = false)}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-5 py-5">
        <p class="block text-xs font-medium uppercase tracking-wider text-zinc-500">Channels</p>
        <div class="mt-3 space-y-3">
          <label
            class="flex cursor-pointer items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/10"
          >
            <span class="text-sm text-zinc-200">In-app</span>
            <input type="checkbox" bind:checked={channelInApp} class="accent-[var(--accent-secondary)]" />
          </label>
          <label
            class="flex cursor-pointer items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/10"
          >
            <span class="text-sm text-zinc-200">Email</span>
            <input type="checkbox" bind:checked={channelEmail} class="accent-[var(--accent-secondary)]" />
          </label>
          <div
            class="flex cursor-not-allowed items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 opacity-50"
          >
            <span class="text-sm text-zinc-500">WhatsApp</span>
            <span class="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Soon</span>
          </div>
        </div>

        <p class="mt-8 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Reward · ₹ per person
        </p>
        <div class="mt-3">
          <input
            type="range"
            min="10"
            max="500"
            step="10"
            bind:value={rewardInr}
            class="slider-aud h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800"
          />
          <div class="mt-1 flex justify-between text-xs text-zinc-500">
            <span>₹10</span>
            <span class="font-medium text-white">₹{rewardInr}</span>
            <span>₹500</span>
          </div>
        </div>

        <label
          class="mt-8 block text-xs font-medium uppercase tracking-wider text-zinc-500"
          for="panel-brand-name">Brand</label
        >
        <input
          id="panel-brand-name"
          class="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0B0B0D] px-3 py-2.5 text-sm text-white outline-none focus:border-[rgba(77,124,255,0.4)]"
          bind:value={brandName}
        />

        <label
          class="mt-6 block text-xs font-medium uppercase tracking-wider text-zinc-500"
          for="panel-campaign-title">Campaign title</label
        >
        <input
          id="panel-campaign-title"
          class="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0B0B0D] px-3 py-2.5 text-sm text-white outline-none focus:border-[rgba(77,124,255,0.4)]"
          bind:value={campaignTitle}
          placeholder="Drop name"
        />

        <p class="mt-6 block text-xs font-medium uppercase tracking-wider text-zinc-500">Creative</p>
        <div
          class="mt-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center transition-colors {dropActive
            ? 'border-[rgba(77,124,255,0.5)] bg-[rgba(77,124,255,0.1)]'
            : ''}"
          role="button"
          tabindex="0"
          on:click={() => document.getElementById('creative-file')?.click()}
          on:keydown={(e) => e.key === 'Enter' && document.getElementById('creative-file')?.click()}
          on:dragenter={() => (dropActive = true)}
          on:dragleave={() => (dropActive = false)}
          on:dragover={(e) => e.preventDefault()}
          on:drop={onCreativeDrop}
        >
          <p class="text-xs text-zinc-500">Drop copy (.txt) or write below</p>
          {#if creativeDropHint}
            <p class="mt-1 text-[11px] text-[var(--accent-secondary)] opacity-80">{creativeDropHint}</p>
          {/if}
          <input
            id="creative-file"
            type="file"
            accept=".txt,.md,text/plain"
            class="hidden"
            on:change={onCreativeFilePick}
          />
        </div>
        <textarea
          class="mt-3 min-h-[100px] w-full rounded-xl border border-white/[0.08] bg-[#0B0B0D] px-3 py-2.5 text-sm text-white outline-none focus:border-[rgba(77,124,255,0.4)]"
          bind:value={creativeText}
          placeholder="Your line, offer, or story…"
        ></textarea>

        {#if !data.brandSessionValid}
          <p class="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200/90">
            <a href={loginNext} class="font-semibold text-amber-100 underline">Sign in</a>
            with your portal secret to push this live.
          </p>
        {/if}

        {#if campaignMsg}
          <p class="mt-4 text-sm text-zinc-400">{campaignMsg}</p>
        {/if}
      </div>
      <div class="border-t border-white/[0.06] p-5">
        <button
          type="button"
          disabled={!data.brandSessionValid}
          class="launch-btn w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
          on:click={() => createCampaign()}
        >
          Launch campaign · {selected.size} people
        </button>
      </div>
    </aside>
  {/if}

  {/if}
</div>

<style>
  /* === Brand color system === */
  .brand-studio {
    --accent-primary: #FF4D4D;
    --accent-secondary: #4D7CFF;
    --accent-tertiary: #FFB84D;
    --bg-primary: oklch(8% 0.008 260);
    --bg-secondary: oklch(10% 0.009 255);
    --bg-elevated: oklch(13% 0.010 258);
    --text-primary: #e8ecf3;
    --text-secondary: #9aa3b2;
    --text-muted: #6d7684;
    --border-subtle: rgba(255, 255, 255, 0.08);
    --border-strong: rgba(255, 255, 255, 0.14);
    --glass-light: rgba(255, 255, 255, 0.055);
    --glass-medium: rgba(255, 255, 255, 0.08);
  }

  .brand-user-rates {
    display: flex; gap: 8px; margin-top: 6px;
    font-size: 11px; font-family: var(--font-mono); color: var(--text-secondary);
  }

  /* Textarea focus states */
  .studio-textarea:focus {
    border-color: rgba(77, 124, 255, 0.4);
    box-shadow: 0 0 0 1px rgba(77, 124, 255, 0.35) inset, 0 0 48px rgba(77, 124, 255, 0.12);
  }

  /* Preset chip hover */
  .preset-chip:hover {
    border-color: rgba(77, 124, 255, 0.35);
    background: rgba(77, 124, 255, 0.1);
    color: #fff;
    box-shadow: 0 0 20px rgba(77, 124, 255, 0.15);
  }

  /* Launch campaign buttons */
  .launch-btn {
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary));
    box-shadow: 0 0 32px rgba(255, 77, 77, 0.25);
  }
  .launch-btn:hover {
    box-shadow: 0 0 40px rgba(255, 77, 77, 0.35);
  }

  /* Mosaic tile hover */
  .mosaic-tile:hover {
    border-color: rgba(77, 124, 255, 0.3);
    box-shadow: 0 0 28px rgba(77, 124, 255, 0.25);
  }

  /* Insight cards hover */
  .insight-card:hover {
    border-color: rgba(77, 124, 255, 0.2);
    box-shadow: 0 0 32px rgba(77, 124, 255, 0.1);
  }

  /* Audience intelligence panel */
  .audience-intel-panel {
    border: 1px solid rgba(77, 124, 255, 0.2);
    background: linear-gradient(to bottom right, rgba(77, 124, 255, 0.08), transparent);
    box-shadow: 0 0 40px rgba(77, 124, 255, 0.06);
  }

  /* Generate intelligence button */
  .generate-intel-btn {
    background: var(--accent-secondary);
    box-shadow: 0 4px 14px rgba(77, 124, 255, 0.3);
  }
  .generate-intel-btn:hover {
    background: #5d8aff;
  }

  /* Slider thumb */
  .slider-aud::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: linear-gradient(145deg, var(--accent-primary), var(--accent-tertiary));
    box-shadow: 0 0 16px rgba(255, 77, 77, 0.4);
    cursor: pointer;
  }
  .slider-aud::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 50%;
    background: linear-gradient(145deg, var(--accent-primary), var(--accent-tertiary));
    box-shadow: 0 0 16px rgba(255, 77, 77, 0.4);
    cursor: pointer;
  }

  /* Portal tabs */
  .portal-tabs {
    display: flex; gap: 4px;
    background: var(--glass-light); border-radius: 12px; padding: 4px;
    border: 1px solid var(--border-subtle);
  }
  .portal-tab {
    flex: 1; padding: 10px 16px; border-radius: 10px; border: none;
    background: transparent; color: var(--text-muted);
    font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
    transition: all 0.15s;
  }
  .portal-tab.active {
    background: var(--glass-medium); color: var(--text-primary);
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }

  /* Agent wrap — uses header height (56px) + tabs container (~72px) */
  .portal-agent-wrap {
    height: calc(100vh - 56px - 72px);
    min-height: 500px;
  }
</style>
