<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import BrandIntakeCard from '$lib/components/brands/BrandIntakeCard.svelte';
  import GuidedQuestions from '$lib/components/brands/GuidedQuestions.svelte';
  import ThinkingStepper from '$lib/components/brands/ThinkingStepper.svelte';
  import ResultsDashboard from '$lib/components/brands/ResultsDashboard.svelte';
  import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
  import Download from 'phosphor-svelte/lib/Download';
  import SignOut from 'phosphor-svelte/lib/SignOut';
  import Sparkle from 'phosphor-svelte/lib/Sparkle';
  import Note from 'phosphor-svelte/lib/Note';
  import X from 'phosphor-svelte/lib/X';
  import DashboardSummaryBar from '$lib/components/brands/DashboardSummaryBar.svelte';
  import CreatorCard from '$lib/components/brands/CreatorCard.svelte';
  import StickyLaunchBar from '$lib/components/brands/StickyLaunchBar.svelte';
  import LaunchModal from '$lib/components/brands/LaunchModal.svelte';
  import ContentStudio from '$lib/components/brands/ContentStudio.svelte';
  import BrandProfile from '$lib/components/brands/BrandProfile.svelte';

  export let data: { brandSessionValid: boolean; brandProfile: Record<string, unknown> | null };

  let portalTab: 'content' | 'creators' | 'profile' = data.brandProfile ? 'content' : 'creators';

  // ── Step machine ──
  type Step = 'intake' | 'questions' | 'thinking' | 'confirm' | 'results';
  let currentStep: Step = 'intake';

  let brandContext = { brandName: '', website: '', instagram: '', description: '' };

  // Thinking stepper state
  let thinkingActiveStep = '';
  let thinkingCompleted = new Set<string>();

  // Results from match agent
  let matchResults: Array<{
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
  }> = [];

  let enriching = false;
  let enrichedContext = '';

  // Brief confirmation
  let extractedBrief: {
    product_summary?: string;
    buyer_roles?: string[];
    campaign_intent?: string;
    content_themes_needed?: string[];
    budget_tier?: string;
    geography?: string[];
  } | null = null;

  let editableBriefSummary = '';
  let editableBudget = '';
  let editableLocation = '';

  function handleBriefExtracted(e: CustomEvent) {
    const brief = e.detail?.brief ?? e.detail;
    if (brief) {
      extractedBrief = brief;
      editableBriefSummary = brief.product_summary || brandContext.description;
      editableBudget = brief.budget_tier || 'micro';
      editableLocation = (brief.geography || []).join(', ') || 'India';
      // Show confirmation step
      currentStep = 'confirm';
    }
  }

  function confirmBrief() {
    currentStep = 'thinking';
  }

  async function handleIntakeSubmit(e: CustomEvent<typeof brandContext>) {
    brandContext = e.detail;
    brandName = brandContext.brandName || 'Your brand';

    // Enrich brand context from website + Instagram
    enriching = true;
    try {
      const res = await fetch('/api/brand/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: brandContext.website,
          instagram: brandContext.instagram,
        }),
      });
      const data = await res.json();
      if (data.contextSummary) {
        enrichedContext = data.contextSummary;
      }
    } catch {
      // Enrichment failed — continue without it
    } finally {
      enriching = false;
    }

    currentStep = 'questions';
  }

  let thinkingTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleThinking(e: CustomEvent<{ step: string; text: string }>) {
    if (currentStep !== 'thinking') {
      currentStep = 'thinking';
      // Safety timeout: if stuck in thinking for 20s, force transition to results
      thinkingTimeout = setTimeout(() => {
        if (currentStep === 'thinking') {
          thinkingCompleted = new Set(['brief', 'scoring', 'matching', 'done']);
          thinkingActiveStep = 'done';
          currentStep = 'results';
        }
      }, 20_000);
    }
    if (thinkingActiveStep) {
      thinkingCompleted = new Set([...thinkingCompleted, thinkingActiveStep]);
    }
    thinkingActiveStep = e.detail.step;

    if (e.detail.step === 'done') {
      if (thinkingTimeout) clearTimeout(thinkingTimeout);
      thinkingCompleted = new Set([...thinkingCompleted, 'done']);
      setTimeout(() => {
        currentStep = 'results';
      }, 800);
    }
  }

  function handleMatches(e: CustomEvent<{ results: unknown }>) {
    const payload = e.detail as { results?: { matches?: typeof matchResults } };
    matchResults = payload?.results?.matches ?? [];
    // If we got matches, ensure we transition even if 'done' status is missed
    if (currentStep === 'thinking' && matchResults.length > 0) {
      if (thinkingTimeout) clearTimeout(thinkingTimeout);
      thinkingCompleted = new Set([...thinkingCompleted, thinkingActiveStep, 'done']);
      thinkingActiveStep = 'done';
      setTimeout(() => {
        currentStep = 'results';
      }, 1200);
    }
  }

  function handleStartOver() {
    currentStep = 'intake';
    brandContext = { brandName: '', website: '', instagram: '', description: '' };
    thinkingActiveStep = '';
    thinkingCompleted = new Set();
    matchResults = [];
    enrichedContext = '';
  }

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
    followers: number;
    graph_strength: number;
    graph_strength_label: string;
    rates?: {
      ig_post_rate_inr?: number;
      ig_story_rate_inr?: number;
      ig_reel_rate_inr?: number;
      available?: boolean;
    };
  }> = [];

  let keyTraits: Array<{ tag: string; count: number }> = [];
  let audienceSize = 0;
  let estimatedEngagement = '';
  let estimatedCost: number | null = null;
  let avgGraphStrength = 0;
  let pctHighStrength = 0;
  let rankStrengthBoostApplied = false;

  let selected = new Set<string>();

  let showManualSearch = false;

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

  $: manualSelectedUsers = users.filter(u => selected.has(u.user_google_sub));
  $: manualTotalReach = manualSelectedUsers.reduce((s, u) => s + (u.followers || 0), 0);
  $: manualEstimatedCost = manualSelectedUsers.reduce((s, u) => s + (u.rates?.ig_post_rate_inr ?? 0), 0) || null;
  $: manualAvgMatchScore = users.length ? users.reduce((s, u) => s + u.match_score, 0) / users.length : 0;
  $: manualCostBreakdown = {
    posts: manualSelectedUsers.filter(u => u.rates?.ig_post_rate_inr).length,
    stories: manualSelectedUsers.filter(u => u.rates?.ig_story_rate_inr).length,
    reels: manualSelectedUsers.filter(u => u.rates?.ig_reel_rate_inr).length,
  };

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

  function smartRerun() {
    if (structured) {
      refineDiscovery();
    } else {
      runDiscovery();
    }
  }

  function confirmNewScene() {
    if (inResultsMode && (selected.size > 0 || users.length > 0)) {
      if (!confirm('This will clear your current audience. Start over?')) return;
    }
    newScene();
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

<div class="brand-studio">
  <!-- Tab toggle: Content Studio vs Find Creators -->
  {#if data.brandProfile}
    <div class="portal-tabs">
      <button
        class="portal-tab"
        class:active={portalTab === 'content'}
        on:click={() => portalTab = 'content'}
      >Content Studio</button>
      <button
        class="portal-tab"
        class:active={portalTab === 'creators'}
        on:click={() => portalTab = 'creators'}
      >Find Creators</button>
      <button
        class="portal-tab"
        class:active={portalTab === 'profile'}
        on:click={() => portalTab = 'profile'}
      >Profile & Insights</button>
    </div>
  {/if}

  {#if portalTab === 'content' && data.brandProfile}
    <div class="portal-content-studio">
      <ContentStudio brandProfile={{
        ig_user_id: String(data.brandProfile.ig_user_id || ''),
        ig_username: String(data.brandProfile.ig_username || ''),
        ig_name: String(data.brandProfile.ig_name || ''),
        ig_profile_picture: String(data.brandProfile.ig_profile_picture || ''),
        ig_followers_count: Number(data.brandProfile.ig_followers_count || 0),
      }} />
    </div>
  {:else if portalTab === 'profile' && data.brandProfile}
    <div class="portal-content-studio">
      <BrandProfile />
    </div>
  {:else if showManualSearch}
    <div class="manual-search-header">
      <button class="back-to-chat" on:click={() => showManualSearch = false}>
        Back to AI matching
      </button>
    </div>

  <!-- Ambient -->
  <div
    class="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_-30%,rgba(77,124,255,0.10),transparent)]"
    aria-hidden="true"
  ></div>

  {#if !inResultsMode}
    <!-- Hero -->
    <section class="relative z-10 flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-4 py-16">
      <p class="hero-label mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.3em]">
        Describe your audience
      </p>
      <h1 class="hero-title max-w-3xl text-center text-3xl font-semibold leading-tight md:text-5xl">
        Who are you directing
        <span class="hero-title-accent">
          tonight?
        </span>
      </h1>

      <div class="relative mt-12 w-full max-w-2xl">
        <label for="studio-prompt" class="sr-only">Audience prompt</label>
        <textarea
          id="studio-prompt"
          class="studio-textarea studio-textarea-hero min-h-[140px] w-full resize-none rounded-2xl px-5 py-4 text-base leading-relaxed outline-none transition-[border,box-shadow] duration-300 md:min-h-[120px] md:text-lg"
          bind:value={promptText}
          placeholder={ghostHints[ghostIdx]}
        ></textarea>
        <div class="mt-3 flex flex-wrap justify-center gap-2">
          {#each presetChips as chip}
            <button
              type="button"
              class="preset-chip rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-300"
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
        class="discover-btn group mt-10 inline-flex items-center gap-2 rounded-full px-10 py-3.5 text-sm font-semibold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50"
        on:click={() => runDiscovery()}
      >
        {searching ? 'Composing…' : 'Discover audience'}
        {#if !searching}<ArrowRight size={18} class="transition-transform group-hover:translate-x-0.5" />{/if}
      </button>

      {#if parseErr || searchErr}
        <p class="mt-6 max-w-md text-center text-sm text-red-400/90">{parseErr || searchErr}</p>
      {/if}

      <div class="hero-footer absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-4 text-xs">
        {#if data.brandSessionValid}
          <button
            type="button"
            class="hero-sign-out inline-flex items-center gap-1.5 transition-colors"
            on:click={() => signOut()}
          >
            <SignOut size={14} /> Sign out
          </button>
        {:else}
          <a href={loginNext} class="hero-sign-in underline-offset-4 hover:underline">
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
        class="docked-prompt sticky top-0 z-40 px-4 py-4 backdrop-blur-xl"
      >
        <div class="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-end">
          <div class="min-w-0 flex-1">
            <label for="studio-prompt-dock" class="sr-only">Refine prompt</label>
            <textarea
              id="studio-prompt-dock"
              class="studio-textarea studio-textarea-dock min-h-[72px] w-full resize-y rounded-xl px-4 py-3 text-sm outline-none transition-colors md:min-h-[56px]"
              bind:value={promptText}
            ></textarea>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={searching}
              class="rerun-btn rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              on:click={smartRerun}
            >
              {searching ? '…' : 'Re-run'}
            </button>
            <button
              type="button"
              class="new-scene-btn rounded-xl px-4 py-2.5 text-sm transition-colors"
              on:click={confirmNewScene}
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
            <p class="section-label text-[11px] font-semibold uppercase tracking-[0.2em]">Live audience</p>
            <h2 class="results-heading mt-2 text-3xl font-semibold md:text-4xl">
              {audienceSize.toLocaleString()} people
              <span class="results-heading-muted">found</span>
            </h2>
            {#if structured}
              <p class="text-secondary mt-3 max-w-2xl text-sm leading-relaxed">
                {structured.human_summary}
              </p>
            {/if}
          </div>
          <div class="flex flex-wrap gap-2">
            {#if data.brandSessionValid}
              <button
                type="button"
                class="toolbar-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all"
                on:click={() => exportCsv()}
              >
                <Download size={14} /> Export
              </button>
              <button
                type="button"
                class="toolbar-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all"
                on:click={() => signOut()}
              >
                <SignOut size={14} /> Out
              </button>
            {/if}
          </div>
        </div>

        <!-- Dashboard summary -->
        <DashboardSummaryBar
          creatorCount={users.length}
          selectedCount={selected.size}
          totalReach={manualTotalReach}
          estimatedCost={manualEstimatedCost}
          avgMatchScore={manualAvgMatchScore}
          {keyTraits}
          {pctHighStrength}
        />

        <!-- Audience intelligence -->
        {#if users.length > 0}
          <div class="audience-intel-panel rounded-2xl p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="intel-label text-[11px] font-semibold uppercase tracking-wider">Audience intelligence</p>
                <p class="text-secondary mt-2 max-w-xl text-sm">
                  Monetization read — goals, friction, converting content. Uses selected rows if any, otherwise top 24.
                </p>
              </div>
              <button
                type="button"
                disabled={audienceIntelLoading}
                class="generate-intel-btn shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg transition-opacity disabled:opacity-50"
                on:click={() => runAudienceIntelligence()}
              >
                {audienceIntelLoading ? 'Generating\u2026' : 'Generate'}
              </button>
            </div>
            {#if audienceIntelErr}
              <p class="mt-3 text-sm text-red-400/90">{audienceIntelErr}</p>
            {/if}
            {#if audienceIntelMembersUsed != null && audienceIntel}
              <p class="text-muted mt-2 text-xs">Based on {audienceIntelMembersUsed} profiles.</p>
            {/if}
            {#if audienceIntel}
              <div class="mt-5 grid gap-4 sm:grid-cols-2">
                <div class="intel-card rounded-xl p-4">
                  <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">Trying to achieve</p>
                  <p class="intel-card-body mt-2 text-sm leading-relaxed">{audienceIntel.trying_to_achieve}</p>
                </div>
                <div class="intel-card rounded-xl p-4">
                  <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">Struggling with</p>
                  <p class="intel-card-body mt-2 text-sm leading-relaxed">{audienceIntel.struggling_with}</p>
                </div>
                <div class="intel-card rounded-xl p-4">
                  <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">Content that converts</p>
                  <p class="intel-card-body mt-2 text-sm leading-relaxed">{audienceIntel.content_that_converts}</p>
                </div>
                <div class="intel-card rounded-xl p-4">
                  <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">Will pay for</p>
                  <p class="intel-card-body mt-2 text-sm leading-relaxed">{audienceIntel.will_pay_for}</p>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Creator cards -->
        <div>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p class="text-muted text-sm">
              <span class="text-primary">{selected.size}</span> selected &middot; click to expand, checkbox to select
            </p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="toolbar-btn rounded-lg px-3 py-1 text-xs" on:click={() => selectTop(10)}>Top 10</button>
              <button type="button" class="toolbar-btn rounded-lg px-3 py-1 text-xs" on:click={() => selectTop(25)}>Top 25</button>
              <button type="button" class="toolbar-btn rounded-lg px-3 py-1 text-xs" on:click={() => { selected = new Set(users.map(u => u.user_google_sub)); }}>All</button>
            </div>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            {#each users as u (u.user_google_sub)}
              <CreatorCard
                user={u}
                selected={selected.has(u.user_google_sub)}
                brief={memberBriefBySub[u.user_google_sub] ?? null}
                briefLoading={memberBriefLoading === u.user_google_sub}
                on:toggle={(e) => toggleRow(e.detail)}
                on:loadBrief={(e) => loadMemberBrief(users.find(x => x.user_google_sub === e.detail))}
              />
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if inResultsMode && users.length > 0}
    <StickyLaunchBar
      selectedCount={selected.size}
      totalCount={users.length}
      totalReach={manualTotalReach}
      estimatedCost={manualEstimatedCost}
      costBreakdown={manualCostBreakdown}
      on:launch={() => campaignPanelOpen = true}
      on:startOver={confirmNewScene}
    />
  {/if}

  {#if campaignPanelOpen}
    <LaunchModal
      selectedCount={selected.size}
      estimatedCost={manualEstimatedCost}
      {brandName}
      on:confirm={(e) => {
        const d = e.detail;
        campaignTitle = d.title;
        creativeText = d.creativeText;
        rewardInr = d.rewardInr;
        channelEmail = d.channels.email;
        channelInApp = d.channels.in_app;
        createCampaign();
      }}
      on:close={() => campaignPanelOpen = false}
    />
  {/if}

  {:else}
    <div class="agent-full">
      {#if currentStep === 'intake'}
        {#if enriching}
          <div class="enriching-state">
            <div class="enriching-spinner"></div>
            <p class="enriching-text">Looking up your brand...</p>
          </div>
        {:else}
          <BrandIntakeCard on:submit={handleIntakeSubmit} />
        {/if}
      {:else if currentStep === 'questions'}
        <GuidedQuestions
          {brandContext}
          {enrichedContext}
          on:thinking={handleThinking}
          on:matches={handleMatches}
          on:brief={handleBriefExtracted}
        />
      {:else if currentStep === 'confirm'}
        <div class="confirm-root">
          <div class="confirm-card">
            <div class="confirm-badge">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7.5l3.5 3.5L12 3" stroke="var(--accent-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Brief ready</span>
            </div>
            <h2 class="confirm-title">Here's your campaign brief</h2>
            <p class="confirm-sub">Review and edit, then we'll find your matches.</p>

            <div class="confirm-fields">
              <div class="confirm-field">
                <label>What you're promoting</label>
                <textarea bind:value={editableBriefSummary} rows="2" class="confirm-input"></textarea>
              </div>
              <div class="confirm-row">
                <div class="confirm-field">
                  <label>Budget tier</label>
                  <select bind:value={editableBudget} class="confirm-select">
                    <option value="nano">Nano (under 10k)</option>
                    <option value="micro">Micro (10k-50k)</option>
                    <option value="mid">Mid (50k-2L)</option>
                    <option value="macro">Macro (2L+)</option>
                  </select>
                </div>
                <div class="confirm-field">
                  <label>Location</label>
                  <input type="text" bind:value={editableLocation} class="confirm-input" placeholder="India" />
                </div>
              </div>
              {#if extractedBrief?.buyer_roles?.length}
                <div class="confirm-field">
                  <label>Target audience</label>
                  <div class="confirm-tags">
                    {#each extractedBrief.buyer_roles as role}
                      <span class="confirm-tag">{role}</span>
                    {/each}
                  </div>
                </div>
              {/if}
              {#if extractedBrief?.content_themes_needed?.length}
                <div class="confirm-field">
                  <label>Content themes</label>
                  <div class="confirm-tags">
                    {#each extractedBrief.content_themes_needed as theme}
                      <span class="confirm-tag confirm-tag--blue">{theme}</span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>

            <div class="confirm-actions">
              <button class="confirm-btn" on:click={confirmBrief}>
                <span>Find my creators</span>
                <span class="confirm-btn-icon">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
              </button>
              <button class="confirm-back" on:click={() => currentStep = 'questions'}>Edit answers</button>
            </div>
          </div>
        </div>
      {:else if currentStep === 'thinking'}
        <ThinkingStepper
          activeStep={thinkingActiveStep}
          completedSteps={thinkingCompleted}
        />
      {:else if currentStep === 'results'}
        <ResultsDashboard
          matches={matchResults}
          brandName={brandContext.brandName}
          on:startOver={handleStartOver}
          on:startCampaign={(e) => {
            const d = e.detail;
            campaignTitle = d.title;
            creativeText = d.creativeText;
            rewardInr = d.rewardInr;
            channelEmail = d.channels.email;
            channelInApp = d.channels.in_app;
            selected = new Set(d.selected);
            createCampaign();
          }}
        />
      {/if}
    </div>
    {#if currentStep === 'intake' || currentStep === 'questions'}
      <div class="manual-link">
        <button class="switch-link" on:click={() => showManualSearch = true}>
          Switch to manual search
        </button>
      </div>
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
    display: flex;
    flex-direction: column;
    height: calc(100vh - 56px);
  }

  .agent-full {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .manual-link {
    text-align: center;
    padding: 8px 0 16px;
  }

  .switch-link {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
    padding: 4px 8px;
    transition: color 0.2s;
  }
  .switch-link:hover { color: var(--text-secondary); }

  .enriching-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 48px;
  }
  .enriching-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-subtle);
    border-top-color: var(--accent-secondary);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .enriching-text {
    font-size: 14px;
    color: var(--text-muted);
    margin: 0;
  }

  .manual-search-header {
    padding: 12px 24px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .back-to-chat {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
    padding: 4px 0;
    transition: color 0.2s;
  }
  .back-to-chat:hover { color: var(--text-primary); }

  .brand-user-rates {
    display: flex; gap: 8px; margin-top: 6px;
    font-size: 11px; font-family: var(--font-mono); color: var(--text-secondary);
  }

  /* === Token-based utility classes === */
  .text-primary { color: var(--text-primary); }
  .text-secondary { color: var(--text-secondary); }
  .text-muted { color: var(--text-muted); }
  .section-label { color: var(--text-muted); }
  .accent-secondary { color: var(--accent-secondary); }
  .accent-tertiary { color: var(--accent-tertiary); }

  /* === Hero section === */
  .hero-label { color: var(--text-muted); }
  .hero-title { color: var(--text-primary); }
  .hero-title-accent { color: var(--text-secondary); }
  .hero-footer { color: var(--text-muted); }
  .hero-sign-out {
    color: var(--text-muted);
  }
  .hero-sign-out:hover { color: var(--text-primary); }
  .hero-sign-in {
    color: var(--text-muted);
  }
  .hero-sign-in:hover { color: var(--accent-secondary); }

  .studio-textarea-hero {
    border: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
    color: var(--text-primary);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.04) inset, 0 24px 80px -24px rgba(0,0,0,0.6);
  }
  .studio-textarea-hero::placeholder { color: var(--text-muted); }

  .preset-chip {
    border: 1px solid var(--glass-medium);
    background: var(--glass-light);
    color: var(--text-secondary);
  }

  .discover-btn {
    background: white;
    color: var(--bg-primary);
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  }
  .discover-btn:hover {
    box-shadow: 0 6px 24px rgba(0,0,0,0.4);
  }

  /* === Docked prompt / Results toolbar === */
  .docked-prompt {
    border-bottom: 1px solid var(--border-subtle);
    background: rgba(11, 11, 13, 0.85);
  }
  @supports (backdrop-filter: blur(1px)) {
    .docked-prompt { background: rgba(11, 11, 13, 0.70); }
  }

  .studio-textarea-dock {
    border: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .rerun-btn {
    background: white;
    color: var(--bg-primary);
  }

  .new-scene-btn {
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
  }
  .new-scene-btn:hover {
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  /* === Results header === */
  .results-heading { color: var(--text-primary); }
  .results-heading-muted { color: var(--text-muted); }

  .toolbar-btn {
    border: 1px solid var(--border-strong);
    color: var(--text-secondary);
  }
  .toolbar-btn:hover {
    border-color: rgba(255, 255, 255, 0.2);
    color: var(--text-primary);
  }

  /* === Overview panel === */
  .overview-panel {
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    box-shadow: 0 0 60px rgba(0,0,0,0.35);
  }
  .overview-panel:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .overview-row {
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-subtle);
  }
  .overview-row-last { border-bottom: none; }
  .overview-value { color: var(--text-primary); }

  .interest-tag {
    border: 1px solid var(--border-strong);
    background: var(--glass-light);
    color: var(--text-primary);
  }
  .behavior-tag {
    border: 1px solid rgba(77, 124, 255, 0.2);
    background: rgba(77, 124, 255, 0.1);
    color: #8BABFF;
  }

  /* === Mosaic === */
  .mosaic-tile {
    border: 1px solid var(--border-subtle);
  }
  .mosaic-initials {
    color: rgba(255, 255, 255, 0.9);
  }

  /* === Insight cards === */
  .insight-card {
    border: 1px solid var(--border-subtle);
    background: linear-gradient(to bottom right, var(--glass-light), transparent);
  }
  .insight-stat { color: var(--text-primary); }
  .insight-title { color: var(--text-primary); }
  .insight-caption { color: var(--text-muted); }

  /* === Intel cards === */
  .intel-label { color: var(--accent-tertiary); }
  .intel-card {
    border: 1px solid var(--border-subtle);
    background: rgba(0, 0, 0, 0.2);
  }
  .intel-card-label { color: var(--text-muted); }
  .intel-card-body { color: var(--text-primary); }

  /* === Member cards === */
  .member-card-selected {
    border-color: rgba(77, 124, 255, 0.5);
    background: rgba(77, 124, 255, 0.1);
    box-shadow: 0 0 24px rgba(77, 124, 255, 0.15);
  }
  .member-card-default {
    border-color: var(--border-subtle);
    background: var(--glass-light);
  }
  .member-card-default:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background: var(--glass-medium);
  }
  .member-avatar { color: var(--text-primary); }
  .member-card-footer {
    border-top: 1px solid var(--border-subtle);
    background: rgba(0, 0, 0, 0.2);
  }
  .brief-body { color: var(--text-primary); }
  .brief-label { color: var(--text-muted); }

  /* === Campaign slide-over === */
  .campaign-aside {
    border-left: 1px solid var(--border-subtle);
    background: var(--bg-secondary);
    box-shadow: -16px 0 64px rgba(0,0,0,0.5);
  }
  .campaign-header {
    border-bottom: 1px solid var(--border-subtle);
  }
  .campaign-close-btn {
    color: var(--text-muted);
  }
  .campaign-close-btn:hover {
    background: var(--glass-light);
    color: var(--text-primary);
  }
  .campaign-option {
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
  }
  .campaign-option:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }
  .campaign-option-disabled {
    border-color: rgba(255, 255, 255, 0.04);
  }
  .campaign-input {
    border: 1px solid var(--border-subtle);
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  .campaign-input:focus {
    border-color: rgba(77, 124, 255, 0.4);
  }
  .creative-drop {
    border: 1px dashed var(--border-strong);
    background: var(--glass-light);
  }
  .creative-drop-active {
    border-color: rgba(77, 124, 255, 0.5);
    background: rgba(77, 124, 255, 0.1);
  }
  .campaign-footer {
    border-top: 1px solid var(--border-subtle);
  }

  /* Textarea focus states */
  .studio-textarea:focus {
    border-color: rgba(77, 124, 255, 0.4);
    box-shadow: 0 0 0 1px rgba(77, 124, 255, 0.35) inset;
  }

  /* Preset chip hover */
  .preset-chip:hover {
    border-color: rgba(77, 124, 255, 0.35);
    background: rgba(77, 124, 255, 0.1);
    color: #fff;
  }

  /* Launch campaign buttons */
  .launch-btn {
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary));
    color: var(--text-primary);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  }
  .launch-btn:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  }

  /* Mosaic tile hover */
  .mosaic-tile:hover {
    border-color: rgba(77, 124, 255, 0.3);
  }

  /* Insight cards hover */
  .insight-card:hover {
    border-color: rgba(77, 124, 255, 0.2);
  }

  /* Audience intelligence panel */
  .audience-intel-panel {
    border: 1px solid rgba(77, 124, 255, 0.2);
    background: linear-gradient(to bottom right, rgba(77, 124, 255, 0.08), transparent);
  }

  /* Generate intelligence button */
  .generate-intel-btn {
    background: var(--accent-secondary);
    color: var(--text-primary);
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
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: pointer;
  }
  .slider-aud::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 50%;
    background: linear-gradient(145deg, var(--accent-primary), var(--accent-tertiary));
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: pointer;
  }

  /* ── Brief Confirmation ── */
  .confirm-root {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 32px 24px;
  }

  .confirm-card {
    max-width: 500px;
    width: 100%;
    padding: 32px;
    border-radius: 1.25rem;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.04), 0 16px 48px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    gap: 24px;
    animation: card-in 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  }

  @keyframes card-in {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .confirm-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: center;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent-primary);
    background: rgba(255,77,77,0.08);
    border: 1px solid rgba(255,77,77,0.15);
    border-radius: 9999px;
    padding: 5px 12px;
  }

  .confirm-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    text-align: center;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .confirm-sub {
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
    margin: -12px 0 0;
  }

  .confirm-fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .confirm-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 480px) {
    .confirm-row { grid-template-columns: 1fr; }
  }

  .confirm-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .confirm-field label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .confirm-input,
  .confirm-select {
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 14px;
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .confirm-input:focus,
  .confirm-select:focus {
    border-color: rgba(77,124,255,0.4);
  }

  .confirm-select {
    appearance: none;
    cursor: pointer;
  }

  textarea.confirm-input {
    resize: vertical;
    min-height: 48px;
    line-height: 1.5;
  }

  .confirm-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .confirm-tag {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 9999px;
    background: rgba(255,77,77,0.08);
    color: #FF6B6B;
    border: 1px solid rgba(255,77,77,0.15);
  }

  .confirm-tag--blue {
    background: rgba(77,124,255,0.08);
    color: #6B9AFF;
    border-color: rgba(77,124,255,0.15);
  }

  .confirm-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .confirm-btn {
    width: 100%;
    padding: 14px 20px;
    border: none;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary));
    color: white;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .confirm-btn:hover { transform: translateY(-1px); }
  .confirm-btn:active { transform: scale(0.98); }

  .confirm-btn-icon {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .confirm-back {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    padding: 8px;
    text-align: center;
    transition: color 0.2s;
  }
  .confirm-back:hover { color: var(--text-secondary); }

  /* ── Portal tabs ── */
  .portal-tabs {
    display: flex; gap: 4px; margin-bottom: 24px;
    background: var(--panel-surface); border-radius: 12px; padding: 4px;
  }
  .portal-tab {
    flex: 1; padding: 10px 16px; border: none; border-radius: 10px;
    font-size: 14px; font-weight: 600; font-family: inherit;
    background: transparent; color: var(--text-muted); cursor: pointer;
    transition: all 0.2s;
  }
  .portal-tab.active {
    background: var(--glass-medium); color: var(--text-primary);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .portal-content-studio {
    max-width: 48rem;
    margin: 0 auto;
    padding: 0 16px 80px;
  }
</style>
