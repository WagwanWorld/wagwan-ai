<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
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
  import BrandProfile from '$lib/components/brands/BrandProfile.svelte';
  import BrandOsDashboard from '$lib/components/brands/BrandOsDashboard.svelte';
  import ContentAutomation from '$lib/components/brands/ContentAutomation.svelte';
  import FollowerAnalyticsPanel from '$lib/components/brands/FollowerAnalyticsPanel.svelte';
  import type { BrandOsDashboard as BrandOsDashboardType } from '$lib/types/brand-os';

  export let data: { brandSessionValid: boolean; brandProfile: Record<string, unknown> | null };

  // Read tab from URL param (set by editorial shell nav)
  $: urlTab = $page.url.searchParams.get('tab') as
    | 'content'
    | 'creators'
    | 'profile'
    | 'automation'
    | null;
  let portalTab: 'content' | 'creators' | 'profile' | 'automation' = data.brandProfile
    ? 'content'
    : 'creators';
  let osDashboard: BrandOsDashboardType | null = null;
  let osLoading = false;
  let osError = '';
  let osSyncing = false;
  let osPeriod: '1d' | '7d' | '30d' = '7d';
  let osPostCount = 0;

  // URL tab param handled by reactive block above
  $: if (urlTab && ['content', 'creators', 'profile', 'automation'].includes(urlTab)) {
    portalTab = urlTab;
  }

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
      rates: {
        ig_post_rate_inr: number;
        ig_story_rate_inr: number;
        ig_reel_rate_inr: number;
        available: boolean;
      } | null;
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

  const loginNext = '/';

  type ParsedAudience = {
    age_range: [number, number] | null;
    location: string | null;
    interests: string[];
    behaviors: string[];
    human_summary: string;
  };

  const presetChips = [
    {
      label: 'Nightlife audience',
      text: 'People who go out every weekend and care about music and venues.',
    },
    {
      label: 'Fashion-forward Gen Z',
      text: 'Gen Z into streetwear, drops, and underground music scenes.',
    },
    {
      label: 'Football community',
      text: 'Football players who train or play matches at least twice a week.',
    },
    {
      label: 'Music lovers',
      text: 'Heavy listeners who discover artists early and go to live shows.',
    },
    {
      label: 'High spenders',
      text: 'Urban professionals with premium taste in dining, travel, and brands.',
    },
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
  type BriefCreative = {
    url: string;
    gcsPath: string;
    mediaType: 'image' | 'video';
    thumbUrl?: string | null;
    caption?: string | null;
    fileName?: string;
  };
  let creativeUploads: BriefCreative[] = [];
  let creativeUploading = false;
  let creativeUploadErr = '';

  let campaignPanelOpen = false;
  let quickBriefSending = false;

  async function createQuickBrief() {
    campaignMsg = '';
    quickBriefSending = true;
    try {
      // Fetch all creator subs to target
      const subsRes = await fetch('/api/brand/creator-subs', fetchOpts)
        .then((r) => r.json())
        .catch(() => ({ ok: false }));
      const targets =
        subsRes.ok && subsRes.targets
          ? (subsRes.targets as Array<{
              user_google_sub: string;
              match_score: number;
              match_reason: string;
            }>)
          : [];

      const bName =
        (data.brandProfile as any)?.brand_name ||
        (data.brandProfile as any)?.ig_username ||
        'Brand';
      const res = await fetch('/api/brand/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...fetchOpts,
        body: JSON.stringify({
          actorGoogleSub: null,
          brand_name: bName,
          title: campaignTitle.trim(),
          creative_text: creativeText.trim(),
          reward_inr: Number(rewardInr) || 50,
          structured_query: null,
          channels: { email: channelEmail, in_app: channelInApp, whatsapp: false },
          targets,
          creatives: creativeUploads,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        campaignMsg = (j.message as string) || (j.error as string) || 'Create failed';
      } else {
        const count = j.audience_count as number;
        campaignMsg =
          count > 0
            ? `Live · ${count} creators targeted`
            : `Saved · Brief created (no creators targeted yet)`;
        campaignTitle = '';
        creativeText = '';
        rewardInr = 50;
        creativeUploads = [];
        creativeDropHint = '';
        creativeUploadErr = '';
        await loadRequests();
      }
    } catch {
      campaignMsg = 'Something went wrong. Try again.';
    }
    quickBriefSending = false;
  }
  let dropActive = false;
  /** True after a successful search response (even if zero rows) — avoids snapping back to hero on empty DB. */
  let inResultsMode = false;

  type BrandRequestMember = {
    user_google_sub: string;
    status: 'sent' | 'accepted' | 'declined' | 'live' | 'completed';
    accepted_at: string | null;
    live_at: string | null;
    completed_at: string | null;
    ig_post_url: string | null;
  };
  type BrandRequestCampaign = {
    id: string;
    title: string;
    creative_text?: string;
    status: string;
    created_at: string;
    reward_inr: number;
    counts: Record<string, number>;
    members: BrandRequestMember[];
    creatives?: Array<{
      id: string;
      media_type: 'image' | 'video';
      url: string;
      thumb_url?: string | null;
      caption?: string | null;
    }>;
  };

  let requestCampaigns: BrandRequestCampaign[] = [];
  let requestsLoading = false;
  let requestsErr = '';
  let requestActionBusy: string | null = null;

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

  $: manualSelectedUsers = users.filter((u) => selected.has(u.user_google_sub));
  $: manualTotalReach = manualSelectedUsers.reduce((s, u) => s + (u.followers || 0), 0);
  $: manualEstimatedCost =
    manualSelectedUsers.reduce((s, u) => s + (u.rates?.ig_post_rate_inr ?? 0), 0) || null;
  $: manualAvgMatchScore = users.length
    ? users.reduce((s, u) => s + u.match_score, 0) / users.length
    : 0;
  $: manualCostBreakdown = {
    posts: manualSelectedUsers.filter((u) => u.rates?.ig_post_rate_inr).length,
    stories: manualSelectedUsers.filter((u) => u.rates?.ig_story_rate_inr).length,
    reels: manualSelectedUsers.filter((u) => u.rates?.ig_reel_rate_inr).length,
  };

  onMount(() => {
    const t = setInterval(() => {
      ghostIdx = (ghostIdx + 1) % ghostHints.length;
    }, 4200);
    void loadOsDashboard();
    void loadRequests();
    return () => clearInterval(t);
  });

  async function loadOsDashboard(period?: '1d' | '7d' | '30d') {
    if (!data.brandSessionValid) return;
    const p = period || osPeriod;
    osLoading = true;
    osError = '';
    try {
      const res = await fetch(`/api/brand/os-dashboard?period=${p}`, fetchOpts);
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        dashboard?: BrandOsDashboardType;
        error?: string;
        message?: string;
        postCount?: number;
      };
      if (!res.ok || !j.ok || !j.dashboard) {
        osError = j.error || j.message || `Dashboard failed (HTTP ${res.status})`;
        osDashboard = null;
        return;
      }
      osDashboard = j.dashboard;
      osPostCount = j.postCount ?? 0;
    } catch {
      osError = 'Dashboard unavailable';
      osDashboard = null;
    } finally {
      osLoading = false;
    }
  }

  function handlePeriodChange(p: '1d' | '7d' | '30d') {
    osPeriod = p;
    void loadOsDashboard(p);
  }

  async function handleScrapeIdentity(url?: string) {
    if (!data.brandSessionValid) return;
    osSyncing = true;
    osError = '';
    try {
      const body: Record<string, string> = {};
      if (url) body.websiteUrl = url;
      const res = await fetch('/api/brand/os-scrape-identity', {
        method: 'POST',
        headers: jsonHeaders(),
        ...fetchOpts,
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        osError = j.error || 'Identity scan failed';
        return;
      }
      await loadOsDashboard();
    } catch {
      osError = 'Identity scan failed';
    } finally {
      osSyncing = false;
    }
  }

  async function runOsSync(
    action: 'refresh_dashboard' | 'regenerate_synopsis' | 'regenerate_brand_kit',
  ) {
    if (!data.brandSessionValid) return;
    osSyncing = true;
    osError = '';
    try {
      const res = await fetch('/api/brand/os-sync', {
        method: 'POST',
        headers: jsonHeaders(),
        ...fetchOpts,
        body: JSON.stringify({ action }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        osError = j.error || 'Sync failed';
        return;
      }
      await Promise.all([loadOsDashboard(), loadRequests()]);
    } catch {
      osError = 'Sync failed';
    } finally {
      osSyncing = false;
    }
  }

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
        parseErr = (pj.message as string) || (pj.error as string) || `Parse failed (${pr.status})`;
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
          (sj.message as string) || (sj.error as string) || `Search failed (${sr.status})`;
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
      selected = new Set(users.slice(0, 10).map((u) => u.user_google_sub));
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
      selected = new Set(users.slice(0, 10).map((u) => u.user_google_sub));
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
    selected = new Set(users.slice(0, n).map((u) => u.user_google_sub));
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
        ? users.filter((u) => selected.has(u.user_google_sub)).slice(0, max)
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
          members: cohort.map((u) => ({
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
          (j.error as string) || (j.message as string) || `Request failed (${res.status})`;
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
      .filter((u) => selected.has(u.user_google_sub))
      .map((u) => ({
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
        creatives: creativeUploads,
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
    creativeUploads = [];
    creativeDropHint = '';
    creativeUploadErr = '';
    await invalidateAll();
    await loadRequests();
  }

  async function loadRequests() {
    if (!data.brandSessionValid) return;
    requestsLoading = true;
    requestsErr = '';
    try {
      const res = await fetch('/api/brand/requests', { ...fetchOpts });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        campaigns?: BrandRequestCampaign[];
        error?: string;
      };
      if (!res.ok || !j.ok) {
        requestsErr = j.error || 'Could not load requests';
        requestCampaigns = [];
        return;
      }
      requestCampaigns = j.campaigns ?? [];
    } catch {
      requestsErr = 'Network error';
    } finally {
      requestsLoading = false;
    }
  }

  async function patchRequest(campaignId: string, action: 'mark_live' | 'close', userSub?: string) {
    if (!data.brandSessionValid) return;
    const busyKey = `${campaignId}:${action}:${userSub ?? '*'}`;
    requestActionBusy = busyKey;
    try {
      const res = await fetch('/api/brand/requests', {
        method: 'PATCH',
        headers: jsonHeaders(),
        ...fetchOpts,
        body: JSON.stringify({ campaignId, action, userSub }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        requestsErr = j.error || 'Action failed';
        return;
      }
      await loadRequests();
    } catch {
      requestsErr = 'Network error';
    } finally {
      requestActionBusy = null;
    }
  }

  function exportCsv() {
    if (!data.brandSessionValid) return;
    const lines = ['google_sub,match_score,match_reason,name,city'];
    for (const u of users.filter((x) => selected.has(x.user_google_sub))) {
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

  // ── Brand OS top bar derived state ──
  const BOS_DATE = new Date().toLocaleDateString('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  $: bosName = data.brandProfile
    ? String(data.brandProfile.ig_name || 'Brand')
    : brandName || 'Brand';
  $: bosHandle = data.brandProfile ? '@' + String(data.brandProfile.ig_username || '') : '';
  $: bosAvatar = data.brandProfile ? String(data.brandProfile.ig_profile_picture || '') : '';
  $: bosFollowers = data.brandProfile ? Number(data.brandProfile.ig_followers_count || 0) : 0;
  $: bosActiveCampaigns = requestCampaigns.filter((c) => c.status !== 'ended').length;
  $: bosTotalSent = requestCampaigns.reduce((s, c) => s + (c.counts.sent ?? 0), 0);
  $: bosTotalAccepted = requestCampaigns.reduce((s, c) => s + (c.counts.accepted ?? 0), 0);

  async function uploadCreativeFiles(files: File[]) {
    if (!files.length) return;
    creativeUploading = true;
    creativeUploadErr = '';
    try {
      const form = new FormData();
      for (const file of files.slice(0, 10)) form.append('files', file);
      const res = await fetch('/api/brand/upload', {
        method: 'POST',
        ...fetchOpts,
        body: form,
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        uploads?: Array<{
          url: string;
          gcsPath: string;
          mediaType: 'IMAGE' | 'VIDEO' | 'FONT' | 'SVG';
          fileName?: string;
        }>;
        errors?: Array<{ file?: string; error?: string }>;
      };
      if (!res.ok || !j.ok) {
        creativeUploadErr = 'Upload failed';
        return;
      }
      const mapped = (j.uploads ?? [])
        .filter((u) => u.mediaType === 'IMAGE' || u.mediaType === 'VIDEO')
        .map(
          (u) =>
            ({
              url: u.url,
              gcsPath: u.gcsPath,
              mediaType: u.mediaType === 'VIDEO' ? 'video' : 'image',
              thumbUrl: null,
              caption: '',
              fileName: u.fileName,
            }) satisfies BriefCreative,
        );
      creativeUploads = [...creativeUploads, ...mapped].slice(0, 10);
      creativeDropHint = mapped.length
        ? `${creativeUploads.length} creative${creativeUploads.length === 1 ? '' : 's'} attached`
        : 'No valid image/video files found';
      if ((j.errors?.length ?? 0) > 0) {
        creativeUploadErr = j.errors?.[0]?.error || 'Some files failed to upload';
      }
    } catch {
      creativeUploadErr = 'Upload failed';
    } finally {
      creativeUploading = false;
    }
  }

  function onCreativeDrop(e: DragEvent) {
    e.preventDefault();
    dropActive = false;
    const files = Array.from(e.dataTransfer?.files ?? []);
    void uploadCreativeFiles(files);
  }

  function onCreativeFilePick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    void uploadCreativeFiles(files);
    input.value = '';
  }

  function removeCreativeUpload(index: number) {
    creativeUploads = creativeUploads.filter((_, i) => i !== index);
    creativeDropHint = creativeUploads.length
      ? `${creativeUploads.length} creative${creativeUploads.length === 1 ? '' : 's'} attached`
      : '';
  }
</script>

<div class="bos-root">
  <!-- ═══ Brand OS Top Bar ═══ -->
  {#if portalTab !== 'automation'}
    <header class="bos-top">
      <div class="bos-brand-card">
        {#if bosAvatar}
          <img src={bosAvatar} alt="" class="bos-avatar" />
        {:else}
          <div class="bos-avatar bos-avatar--init">{bosName.charAt(0)}</div>
        {/if}
        <div class="bos-brand-info">
          <span class="bos-brand-name">{bosName}</span>
          {#if bosHandle}<span class="bos-brand-handle">{bosHandle}</span>{/if}
          {#if bosFollowers > 0}
            <span class="bos-brand-meta">{bosFollowers.toLocaleString()} followers</span>
          {/if}
        </div>
      </div>

      <div class="bos-greeting-block">
        <span class="bos-os-label">BRAND OS</span>
        <h1 class="bos-greeting">Welcome, <em>{bosName.split(' ')[0]}</em>.</h1>
        <span class="bos-date">{BOS_DATE}</span>
      </div>

      <div class="bos-clock-block">
        <div class="bos-clock">
          {new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}
        </div>
        <span class="bos-clock-label">LOCAL TIME</span>
      </div>

      <div class="bos-stats-hero">
        <div class="bos-stat-big">{requestCampaigns.length}</div>
        <span class="bos-stat-label">CAMPAIGNS</span>
        <div class="bos-stat-sub-row">
          <span class="bos-stat-sub"
            ><span class="bos-stat-val bos-stat-val--active">{bosActiveCampaigns}</span> active</span
          >
          <span class="bos-stat-sub"
            ><span class="bos-stat-val bos-stat-val--green">{bosTotalAccepted}</span> accepted</span
          >
        </div>
      </div>
    </header>
  {/if}

  <!-- ═══ Bento Grid ═══ -->
  <div class="bos-bento">
    {#if portalTab === 'content' && data.brandProfile}
      <!-- ── Quick Brief Creator (always visible) ── -->
      <section class="bos-card bos-card--brief-creator">
        <div class="bos-card-head">
          <span class="bos-card-label">CREATE BRIEF</span>
        </div>
        <div class="bos-brief-form">
          <input
            type="text"
            class="bos-brief-input"
            placeholder="Brief title (e.g. Summer launch campaign)"
            bind:value={campaignTitle}
          />
          <textarea
            class="bos-brief-textarea"
            placeholder="Describe the campaign — what should creators post, the vibe, any requirements..."
            bind:value={creativeText}
            rows="4"
          ></textarea>
          <div
            class="creative-drop {dropActive ? 'creative-drop-active' : ''}"
            on:dragover|preventDefault={() => (dropActive = true)}
            on:dragleave={() => (dropActive = false)}
            on:drop={onCreativeDrop}
          >
            <div class="creative-drop-inner">
              <div>
                <p class="bos-brief-label" style="margin:0">Add Creatives</p>
                <p class="bos-card-empty" style="padding:4px 0 0;margin:0">
                  Upload images/videos creators should reference (max 10).
                </p>
              </div>
              <label class="bos-os-error-retry" style="cursor:pointer">
                {creativeUploading ? 'Uploading...' : 'Upload files'}
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  on:change={onCreativeFilePick}
                  style="display:none"
                  disabled={creativeUploading}
                />
              </label>
            </div>
            {#if creativeDropHint}
              <p class="bos-card-empty" style="padding:8px 0 0;margin:0">{creativeDropHint}</p>
            {/if}
            {#if creativeUploadErr}
              <p class="bos-os-error-text" style="margin:8px 0 0">{creativeUploadErr}</p>
            {/if}
            {#if creativeUploads.length > 0}
              <div class="creative-preview-grid">
                {#each creativeUploads as creative, idx}
                  <article class="creative-preview-item">
                    {#if creative.mediaType === 'video'}
                      <video
                        class="creative-preview-media"
                        src={creative.url}
                        muted
                        controls
                        preload="metadata"
                      ></video>
                    {:else}
                      <img
                        class="creative-preview-media"
                        src={creative.url}
                        alt={creative.fileName || 'Creative image'}
                      />
                    {/if}
                    <button
                      type="button"
                      class="creative-remove"
                      on:click={() => removeCreativeUpload(idx)}>Remove</button
                    >
                  </article>
                {/each}
              </div>
            {/if}
          </div>
          <div class="bos-brief-row">
            <div class="bos-brief-field">
              <label class="bos-brief-label">Reward per creator (₹)</label>
              <input
                type="number"
                class="bos-brief-input bos-brief-input--small"
                bind:value={rewardInr}
                min="0"
                step="50"
              />
            </div>
            <div class="bos-brief-field">
              <label class="bos-brief-label">Channel</label>
              <div class="bos-brief-channels">
                <label class="bos-brief-check"
                  ><input type="checkbox" bind:checked={channelInApp} /> In-app</label
                >
                <label class="bos-brief-check"
                  ><input type="checkbox" bind:checked={channelEmail} /> Email</label
                >
              </div>
            </div>
          </div>
          <div class="bos-brief-actions">
            <button
              class="bos-brief-submit"
              on:click={createQuickBrief}
              disabled={quickBriefSending || !campaignTitle.trim() || !creativeText.trim()}
            >
              {quickBriefSending ? 'Creating...' : 'Create & Send to All Creators'}
            </button>
            {#if campaignMsg}
              <span class="bos-brief-msg" class:bos-brief-msg--ok={campaignMsg.startsWith('Live')}
                >{campaignMsg}</span
              >
            {/if}
          </div>
        </div>
      </section>

      {#if osLoading}
        <section class="bos-card bos-card--agent">
          <div class="bos-card-head">
            <span class="bos-card-label">BRAND OS</span>
          </div>
          <div class="bos-card-body">
            <p class="bos-card-empty">Loading dashboard…</p>
          </div>
        </section>
      {:else if osError}
        <div class="bos-os-error-bar">
          <span class="bos-os-error-text">Brand OS: {osError}</span>
          <button
            class="bos-os-error-retry"
            on:click={() => loadOsDashboard()}
            disabled={osLoading}
          >
            {osLoading ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      {:else if osDashboard}
        <BrandOsDashboard
          dashboard={osDashboard}
          syncing={osSyncing}
          onRefresh={() => runOsSync('refresh_dashboard')}
          onRegenerateSynopsis={() => runOsSync('regenerate_synopsis')}
          onRegenerateBrandKit={() => runOsSync('regenerate_brand_kit')}
          onScrapeIdentity={handleScrapeIdentity}
          period={osPeriod}
          onPeriodChange={handlePeriodChange}
          postCount={osPostCount}
        />
      {/if}

      <!-- Follower Analytics (inline on Content Studio) -->
      {#if data.brandSessionValid}
        <FollowerAnalyticsPanel />
      {/if}

      <!-- Insight Cards — after follower analytics, before campaigns -->
      {#if osDashboard}
        {@const syn = osDashboard.synopsis}
        {@const whatHappened = syn?.whatHappened || ''}
        {@const whyItHappened = syn?.whyItHappened || ''}
        {@const whatNext = syn?.whatNext || []}
        <div class="bos-insights-row">
          <div class="bos-insight-card bos-insight-green">
            <span class="bos-insight-label" style="color:#4ade80;">WHAT'S WORKING</span>
            <p class="bos-insight-text">{whatHappened || 'No data yet.'}</p>
          </div>
          <div class="bos-insight-card bos-insight-red">
            <span class="bos-insight-label" style="color:#f87171;">WHAT'S NOT</span>
            <p class="bos-insight-text">{whyItHappened || 'No data yet.'}</p>
          </div>
          <div class="bos-insight-card bos-insight-amber">
            <span class="bos-insight-label" style="color:#E8833A;">DO THIS WEEK</span>
            {#if whatNext.length > 0}
              <ol class="bos-insight-list">
                {#each whatNext as item}
                  <li>{item}</li>
                {/each}
              </ol>
            {:else}
              <p class="bos-insight-text">No recommendations yet.</p>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Campaigns list (always visible in content tab) -->
      <section class="bos-card bos-card--campaigns-list">
        <div class="bos-card-head">
          <span class="bos-card-label">YOUR CAMPAIGNS</span>
          {#if requestCampaigns.length > 0}
            <span class="bos-card-count">{requestCampaigns.length}</span>
          {/if}
          <button
            type="button"
            class="bos-os-error-retry"
            style="margin-left:auto"
            on:click={() => loadRequests()}
            disabled={requestsLoading}
          >
            {requestsLoading ? '...' : 'Refresh'}
          </button>
        </div>
        {#if requestsLoading}
          <p class="bos-card-empty">Loading campaigns...</p>
        {:else if requestCampaigns.length === 0}
          <p class="bos-card-empty">No campaigns yet. Create your first brief above.</p>
        {:else}
          <div class="bos-campaigns-grid">
            {#each requestCampaigns as campaign}
              <div class="bos-campaign-card">
                <div class="bos-campaign-top">
                  <span class="bos-campaign-title">{campaign.title}</span>
                  <span
                    class="bos-campaign-status"
                    class:bos-campaign-status--active={campaign.status === 'active'}
                  >
                    {campaign.status}
                  </span>
                </div>
                <div class="bos-campaign-reward">
                  ₹{(campaign.reward_inr ?? 0).toLocaleString('en-IN')}
                </div>
                {#if campaign.creatives?.[0]}
                  <div class="bos-campaign-creative">
                    {#if campaign.creatives[0].media_type === 'video'}
                      <video src={campaign.creatives[0].url} muted preload="metadata"></video>
                    {:else}
                      <img
                        src={campaign.creatives[0].thumb_url || campaign.creatives[0].url}
                        alt="Campaign creative"
                      />
                    {/if}
                  </div>
                {/if}
                <div class="bos-campaign-stats">
                  <span>{campaign.counts?.sent ?? 0} sent</span>
                  <span>{campaign.counts?.accepted ?? 0} accepted</span>
                  <span>{campaign.counts?.completed ?? 0} completed</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {:else if portalTab === 'profile' && data.brandProfile}
      <BrandProfile />
    {:else if portalTab === 'automation' && data.brandProfile}
      <div class="bos-automation-wrap">
        <ContentAutomation />
      </div>
    {:else if showManualSearch}
      <div class="manual-search-header">
        <button class="back-to-chat" on:click={() => (showManualSearch = false)}>
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
        <section
          class="relative z-10 flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-4 py-16"
        >
          <p
            class="hero-label mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.3em]"
          >
            Describe your audience
          </p>
          <h1
            class="hero-title max-w-3xl text-center text-3xl font-semibold leading-tight md:text-5xl"
          >
            Who are you directing
            <span class="hero-title-accent"> tonight? </span>
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
            {#if !searching}<ArrowRight
                size={18}
                class="transition-transform group-hover:translate-x-0.5"
              />{/if}
          </button>

          {#if parseErr || searchErr}
            <p class="mt-6 max-w-md text-center text-sm text-red-400/90">{parseErr || searchErr}</p>
          {/if}

          <div
            class="hero-footer absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-4 text-xs"
          >
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
          <div class="docked-prompt sticky top-0 z-40 px-4 py-4 backdrop-blur-xl">
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
                <p class="section-label text-[11px] font-semibold uppercase tracking-[0.2em]">
                  Live audience
                </p>
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
                    <p class="intel-label text-[11px] font-semibold uppercase tracking-wider">
                      Audience intelligence
                    </p>
                    <p class="text-secondary mt-2 max-w-xl text-sm">
                      Monetization read — goals, friction, converting content. Uses selected rows if
                      any, otherwise top 24.
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
                  <p class="text-muted mt-2 text-xs">
                    Based on {audienceIntelMembersUsed} profiles.
                  </p>
                {/if}
                {#if audienceIntel}
                  <div class="mt-5 grid gap-4 sm:grid-cols-2">
                    <div class="intel-card rounded-xl p-4">
                      <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">
                        Trying to achieve
                      </p>
                      <p class="intel-card-body mt-2 text-sm leading-relaxed">
                        {audienceIntel.trying_to_achieve}
                      </p>
                    </div>
                    <div class="intel-card rounded-xl p-4">
                      <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">
                        Struggling with
                      </p>
                      <p class="intel-card-body mt-2 text-sm leading-relaxed">
                        {audienceIntel.struggling_with}
                      </p>
                    </div>
                    <div class="intel-card rounded-xl p-4">
                      <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">
                        Content that converts
                      </p>
                      <p class="intel-card-body mt-2 text-sm leading-relaxed">
                        {audienceIntel.content_that_converts}
                      </p>
                    </div>
                    <div class="intel-card rounded-xl p-4">
                      <p class="intel-card-label text-[10px] font-bold uppercase tracking-wide">
                        Will pay for
                      </p>
                      <p class="intel-card-body mt-2 text-sm leading-relaxed">
                        {audienceIntel.will_pay_for}
                      </p>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Creator cards -->
            <div>
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p class="text-muted text-sm">
                  <span class="text-primary">{selected.size}</span> selected &middot; click to expand,
                  checkbox to select
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="toolbar-btn rounded-lg px-3 py-1 text-xs"
                    on:click={() => selectTop(10)}>Top 10</button
                  >
                  <button
                    type="button"
                    class="toolbar-btn rounded-lg px-3 py-1 text-xs"
                    on:click={() => selectTop(25)}>Top 25</button
                  >
                  <button
                    type="button"
                    class="toolbar-btn rounded-lg px-3 py-1 text-xs"
                    on:click={() => {
                      selected = new Set(users.map((u) => u.user_google_sub));
                    }}>All</button
                  >
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
                    on:loadBrief={(e) => {
                      const selectedUser = users.find((x) => x.user_google_sub === e.detail);
                      if (selectedUser) loadMemberBrief(selectedUser);
                    }}
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
          on:launch={() => (campaignPanelOpen = true)}
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
          on:close={() => (campaignPanelOpen = false)}
        />
      {/if}
    {:else}
      <!-- Creator Matching Flow -->
      <section class="bos-card bos-card--agent">
        <div class="bos-card-head">
          <span class="bos-card-label">FIND CREATORS</span>
          {#if currentStep !== 'intake'}
            <span class="bos-card-count">{currentStep}</span>
          {/if}
        </div>
        <div class="bos-card-body bos-agent-body">
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
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                    ><path
                      d="M2 7.5l3.5 3.5L12 3"
                      stroke="#E8833A"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    /></svg
                  >
                  <span>Brief ready</span>
                </div>
                <h2 class="confirm-title">Here's your campaign brief</h2>
                <p class="confirm-sub">Review and edit, then we'll find your matches.</p>

                <div class="confirm-fields">
                  <div class="confirm-field">
                    <label>What you're promoting</label>
                    <textarea bind:value={editableBriefSummary} rows="2" class="confirm-input"
                    ></textarea>
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
                      <input
                        type="text"
                        bind:value={editableLocation}
                        class="confirm-input"
                        placeholder="India"
                      />
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
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                        ><path
                          d="M2 7h10M8 3l4 4-4 4"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        /></svg
                      >
                    </span>
                  </button>
                  <button class="confirm-back" on:click={() => (currentStep = 'questions')}
                    >Edit answers</button
                  >
                </div>
              </div>
            </div>
          {:else if currentStep === 'thinking'}
            <ThinkingStepper activeStep={thinkingActiveStep} completedSteps={thinkingCompleted} />
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
      </section>

      <!-- Campaign Requests — separate bento card (intake view only) -->
      {#if currentStep === 'intake' && data.brandSessionValid}
        <section class="bos-card bos-card--requests">
          <div class="bos-card-head">
            <span class="bos-card-label">YOUR CAMPAIGNS</span>
            {#if requestCampaigns.length > 0}
              <span class="bos-card-count">{requestCampaigns.length}</span>
            {/if}
            <button
              type="button"
              class="bos-refresh-btn"
              on:click={() => loadRequests()}
              disabled={requestsLoading}
            >
              {requestsLoading ? '…' : 'Refresh'}
            </button>
          </div>
          <div class="bos-card-body bos-campaign-scroll">
            {#if requestsErr}
              <p class="bos-card-empty" style="color:#E8464A">{requestsErr}</p>
            {/if}
            {#if !requestsLoading && requestCampaigns.length === 0}
              <p class="bos-card-empty">No campaigns yet. Launch one above.</p>
            {/if}
            {#each requestCampaigns as c (c.id)}
              <article class="requests-card">
                <header class="requests-card__head">
                  <div class="requests-card__title-wrap">
                    <h4 class="requests-card__title">{c.title}</h4>
                    <span class="requests-card__status requests-card__status--{c.status}">
                      {c.status}
                    </span>
                  </div>
                  <div class="requests-card__counts">
                    <span>Sent {c.counts.sent ?? 0}</span>
                    <span>Accepted {c.counts.accepted ?? 0}</span>
                    <span>Live {c.counts.live ?? 0}</span>
                    <span>Completed {c.counts.completed ?? 0}</span>
                    <span class="requests-card__declined">Declined {c.counts.declined ?? 0}</span>
                  </div>
                </header>

                <div class="requests-card__actions">
                  {#if (c.counts.accepted ?? 0) > 0}
                    <button
                      type="button"
                      class="requests-card__action"
                      disabled={requestActionBusy === `${c.id}:mark_live:*`}
                      on:click={() => patchRequest(c.id, 'mark_live')}
                    >
                      {requestActionBusy === `${c.id}:mark_live:*`
                        ? 'Marking…'
                        : `Mark ${c.counts.accepted} accepted → live`}
                    </button>
                  {/if}
                  {#if c.status !== 'ended'}
                    <button
                      type="button"
                      class="requests-card__action requests-card__action--ghost"
                      disabled={requestActionBusy === `${c.id}:close:*`}
                      on:click={() => patchRequest(c.id, 'close')}
                    >
                      Close campaign
                    </button>
                  {/if}
                </div>

                {#if c.members.length > 0}
                  <ul class="requests-card__members">
                    {#each c.members.slice(0, 6) as m (m.user_google_sub)}
                      <li class="requests-card__member">
                        <code class="requests-card__sub">{m.user_google_sub.slice(0, 8)}…</code>
                        <span class="requests-card__status requests-card__status--{m.status}"
                          >{m.status}</span
                        >
                        {#if m.ig_post_url}
                          <a
                            class="requests-card__link"
                            href={m.ig_post_url}
                            target="_blank"
                            rel="noreferrer">Post</a
                          >
                        {/if}
                      </li>
                    {/each}
                    {#if c.members.length > 6}
                      <li class="requests-card__more">+{c.members.length - 6} more</li>
                    {/if}
                  </ul>
                {/if}
              </article>
            {/each}
          </div>
        </section>
      {/if}

      {#if currentStep === 'intake' || currentStep === 'questions'}
        <div class="bos-card bos-card--switch">
          <button class="switch-link" on:click={() => (showManualSearch = true)}>
            Switch to manual search
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* ══════════════════════════════════════════════════════════
     BRAND OS — Bento Grid Dashboard
     ══════════════════════════════════════════════════════════ */
  .bos-root {
    position: relative;
    flex: 1;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: visible;
    background: transparent;
    font-family:
      'Geist Variable',
      'Inter',
      -apple-system,
      sans-serif;
    color: #ededef;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    gap: 0;
  }
  .bos-root::-webkit-scrollbar {
    display: none;
  }

  /* ── Top bar ── */
  .bos-top {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: clamp(12px, 2vw, 20px);
    align-items: center;
    padding: clamp(12px, 1.8vw, 16px) clamp(14px, 2.5vw, 24px);
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    min-width: 0;
  }

  .bos-brand-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-right: 20px;
    border-right: 1px solid rgba(255, 255, 255, 0.04);
  }
  .bos-avatar {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    object-fit: cover;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }
  .bos-avatar--init {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #e87fa8, #e8833a);
    color: #fff;
    font-size: 18px;
    font-weight: 700;
  }
  .bos-brand-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .bos-brand-name {
    font-size: 14px;
    font-weight: 700;
    color: #ededef;
  }
  .bos-brand-handle {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    color: #4a4a50;
    letter-spacing: 0.02em;
  }
  .bos-brand-meta {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    color: #3a3a40;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .bos-greeting-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bos-os-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: #3a3a40;
    text-transform: uppercase;
  }
  .bos-greeting {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: clamp(20px, 2.5vw, 28px);
    font-weight: 700;
    color: #ededef;
    margin: 0;
    letter-spacing: -0.03em;
  }
  .bos-greeting em {
    font-style: italic;
    font-family: 'Bodoni Moda', Georgia, serif;
    color: #e8833a;
    font-weight: 400;
  }
  .bos-date {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    color: #3a3a40;
    letter-spacing: 0.04em;
  }

  .bos-clock-block {
    text-align: right;
  }
  .bos-clock {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 26px;
    font-weight: 300;
    color: #ededef;
    letter-spacing: 0.06em;
  }
  .bos-clock-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    color: #3a3a40;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .bos-stats-hero {
    padding-left: 20px;
    border-left: 1px solid rgba(255, 255, 255, 0.04);
    text-align: right;
  }
  .bos-stat-big {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: clamp(22px, 2.5vw, 32px);
    font-weight: 700;
    color: #ededef;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .bos-stat-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    color: #3a3a40;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    display: block;
    margin-top: 2px;
  }
  .bos-stat-sub-row {
    display: flex;
    gap: 12px;
    margin-top: 6px;
    justify-content: flex-end;
  }
  .bos-stat-sub {
    font-size: 10px;
    color: #4a4a50;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
  }
  .bos-stat-val {
    font-weight: 700;
  }
  .bos-stat-val--active {
    color: #4d7cff;
  }
  .bos-stat-val--green {
    color: #4ade80;
  }

  /* ── Automation wrapper — full-width inside bento grid ── */
  .bos-automation-wrap {
    grid-column: 1 / -1;
    min-width: 0;
    width: 100%;
  }

  /* ── Bento grid ── */
  .bos-bento {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: auto;
    gap: clamp(8px, 1.2vw, 12px);
    padding: clamp(12px, 1.8vw, 16px) clamp(14px, 2vw, 20px);
    min-width: 0;
    overflow: visible;
    align-content: start;
  }

  /* ── Card base ── */
  .bos-card {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .bos-card-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    flex-shrink: 0;
  }
  .bos-card-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: #4a4a50;
    text-transform: uppercase;
  }
  .bos-card-count {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: #8a8a90;
    background: rgba(255, 255, 255, 0.04);
    padding: 2px 7px;
    border-radius: 100px;
  }
  .bos-card-body {
    flex: 1;
    min-height: 0;
  }
  .bos-card-empty {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 11px;
    color: #3a3a40;
    padding: 16px 0;
  }
  .bos-refresh-btn {
    margin-left: auto;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    padding: 3px 10px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    color: #4a4a50;
    cursor: pointer;
    transition:
      color 0.15s,
      border-color 0.15s;
  }
  .bos-refresh-btn:hover {
    color: #ededef;
    border-color: rgba(255, 255, 255, 0.15);
  }
  .bos-refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Card sizes ── */
  .bos-card--studio {
    grid-column: span 2;
    grid-row: span 1;
  }
  .bos-card--campaigns {
    grid-column: span 1;
    grid-row: span 1;
    max-height: 360px;
  }
  .bos-card--agent {
    grid-column: span 2;
    grid-row: span 2;
    min-height: 360px;
  }

  /* ── Quick Brief Creator (landing page style) ── */
  .bos-card--brief-creator {
    grid-column: span 2;
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.035)),
      rgba(20, 18, 23, 0.72);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 28px 80px rgba(0, 0, 0, 0.34);
    backdrop-filter: blur(28px);
  }

  .bos-brief-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .bos-brief-input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    color: #ededef;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: border-color 200ms ease;
  }
  .bos-brief-input:focus {
    border-color: rgba(196, 242, 74, 0.4);
  }
  .bos-brief-input--small {
    max-width: 160px;
  }

  .bos-brief-textarea {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    color: #ededef;
    font-size: 13px;
    line-height: 1.6;
    font-family: inherit;
    outline: none;
    resize: vertical;
    min-height: 100px;
    transition: border-color 200ms ease;
  }
  .bos-brief-textarea:focus {
    border-color: rgba(196, 242, 74, 0.4);
  }

  .bos-brief-row {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .bos-brief-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .bos-brief-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #9cec7b;
    text-transform: uppercase;
  }

  .bos-brief-channels {
    display: flex;
    gap: 14px;
  }

  .bos-brief-check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(255, 248, 232, 0.6);
    cursor: pointer;
  }
  .bos-brief-check input {
    accent-color: #c4f24a;
  }

  .bos-brief-actions {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    padding-top: 4px;
  }

  .bos-brief-submit {
    padding: 12px 28px;
    border: none;
    border-radius: 14px;
    background: #c4f24a;
    color: #0a0a0a;
    font-size: 14px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 4px 24px rgba(196, 242, 74, 0.18);
    transition:
      transform 200ms ease,
      box-shadow 300ms ease;
  }
  .bos-brief-submit:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 36px rgba(196, 242, 74, 0.35);
  }
  .bos-brief-submit:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  .bos-brief-msg {
    font-size: 12px;
    color: rgba(255, 248, 232, 0.5);
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
  }
  .bos-brief-msg--ok {
    color: #4ade80;
  }

  .bos-os-error-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-radius: 12px;
    background: rgba(255, 77, 151, 0.06);
    border: 1px solid rgba(255, 77, 151, 0.12);
    margin-bottom: 16px;
  }
  .bos-os-error-text {
    font-size: 12px;
    color: #ff4d97;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
  }
  .bos-os-error-retry {
    padding: 4px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 248, 232, 0.6);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .bos-os-error-retry:hover {
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
  }
  .bos-os-error-retry:disabled {
    opacity: 0.5;
  }

  /* ── Campaigns list ── */
  .bos-card--campaigns-list {
    grid-column: span 2;
  }

  .bos-campaigns-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
  }

  .bos-campaign-card {
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.03);
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color 200ms ease;
  }
  .bos-campaign-card:hover {
    border-color: rgba(196, 242, 74, 0.2);
  }

  .bos-campaign-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .bos-campaign-title {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .bos-campaign-status {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 248, 232, 0.45);
    flex-shrink: 0;
  }
  .bos-campaign-status--active {
    background: rgba(196, 242, 74, 0.1);
    color: #c4f24a;
  }

  .bos-campaign-reward {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: 1.2rem;
    font-weight: 700;
    color: #c4f24a;
  }
  .bos-campaign-creative {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    overflow: hidden;
    height: 86px;
    background: rgba(255, 255, 255, 0.03);
  }
  .bos-campaign-creative img,
  .bos-campaign-creative video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .bos-campaign-stats {
    display: flex;
    gap: 12px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    color: rgba(255, 248, 232, 0.4);
    letter-spacing: 0.04em;
  }
  .bos-card--requests {
    grid-column: span 1;
    grid-row: span 2;
    max-height: none;
    overflow-y: auto;
  }
  .bos-card--switch {
    grid-column: span 1;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bos-agent-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .bos-agent-body::-webkit-scrollbar {
    display: none;
  }

  .bos-campaign-scroll {
    overflow-y: auto;
    scrollbar-width: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bos-campaign-scroll::-webkit-scrollbar {
    display: none;
  }

  .bos-campaign-row {
    padding: 10px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.04);
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color 0.15s;
  }
  .bos-campaign-row:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }
  .bos-campaign-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bos-campaign-title {
    font-size: 12px;
    font-weight: 600;
    color: #ededef;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bos-campaign-status {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #4a4a50;
  }
  .bos-campaign-status--active {
    color: #4d7cff;
    border-color: rgba(77, 124, 255, 0.3);
  }
  .bos-campaign-status--ended {
    color: #3a3a40;
    border-color: rgba(255, 255, 255, 0.04);
  }
  .bos-campaign-counts {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    color: #3a3a40;
    display: flex;
    gap: 8px;
  }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .bos-top {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto;
    }
    .bos-brand-card {
      border-right: none;
      padding-right: 0;
    }
    .bos-stats-hero {
      border-left: none;
      padding-left: 0;
      text-align: left;
    }
    .bos-stat-sub-row {
      justify-content: flex-start;
    }
    .bos-bento {
      grid-template-columns: repeat(2, 1fr);
    }
    .bos-card--studio {
      grid-column: span 2;
    }
    .bos-card--agent {
      grid-column: span 2;
      grid-row: span 1;
      min-height: 300px;
    }
    .bos-card--requests {
      grid-column: span 2;
      grid-row: span 1;
      max-height: 360px;
    }
    .bos-card--switch {
      grid-column: span 2;
    }
  }

  @media (max-width: 640px) {
    .bos-top {
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 14px;
    }
    .bos-greeting {
      font-size: 20px;
    }
    .bos-clock {
      font-size: 20px;
    }
    .bos-bento {
      grid-template-columns: 1fr;
      padding: 12px;
    }
    .bos-card--studio,
    .bos-card--campaigns,
    .bos-card--agent,
    .bos-card--requests,
    .bos-card--switch {
      grid-column: span 1;
      grid-row: span 1;
      min-height: auto;
      max-height: none;
    }
    .bos-card--agent {
      min-height: 280px;
    }
  }

  /* (requests-panel removed — now uses bos-card--requests) */
  /* (requests-panel refresh/empty/error removed — now uses bos-card styles) */
  .requests-card {
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(255, 255, 255, 0.02);
    transition: border-color 0.15s;
  }
  .requests-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }
  .requests-card__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }
  .requests-card__title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .requests-card__title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #ededef;
  }
  .requests-card__counts {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    color: #4a4a50;
  }
  .requests-card__declined {
    color: #b88;
  }
  .requests-card__status {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #4a4a50;
  }
  .requests-card__status--active,
  .requests-card__status--accepted {
    color: #7ba7d9;
    border-color: rgba(123, 167, 217, 0.4);
  }
  .requests-card__status--live {
    color: #9bdb9b;
    border-color: rgba(155, 219, 155, 0.4);
  }
  .requests-card__status--completed {
    color: #c1a0e8;
    border-color: rgba(193, 160, 232, 0.4);
  }
  .requests-card__status--declined {
    color: #b88;
    border-color: rgba(187, 136, 136, 0.4);
  }
  .requests-card__status--ended {
    color: #777;
    border-color: rgba(120, 120, 120, 0.3);
  }
  .requests-card__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .requests-card__action {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid rgba(232, 131, 58, 0.3);
    background: rgba(232, 131, 58, 0.12);
    color: #e8833a;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .requests-card__action:hover {
    background: rgba(232, 131, 58, 0.2);
    border-color: rgba(232, 131, 58, 0.5);
  }
  .requests-card__action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .requests-card__action--ghost {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.07);
    color: #4a4a50;
  }
  .requests-card__action--ghost:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.15);
    color: #6a6a72;
  }
  .requests-card__members {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .requests-card__member {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 10px;
    color: #4a4a50;
  }
  .requests-card__sub {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
  }
  .requests-card__link {
    color: #7ba7d9;
    text-decoration: underline;
  }
  .requests-card__more {
    font-size: 11px;
    color: #3a3a40;
  }

  .switch-link {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    color: #3a3a40;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.04em;
    cursor: pointer;
    padding: 6px 14px;
    transition:
      color 0.15s,
      border-color 0.15s;
  }
  .switch-link:hover {
    color: #ededef;
    border-color: rgba(255, 255, 255, 0.15);
  }

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
    border: 2px solid rgba(255, 255, 255, 0.07);
    border-top-color: #e8833a;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .enriching-text {
    font-size: 14px;
    color: #3a3a40;
    margin: 0;
  }

  .manual-search-header {
    padding: 12px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .back-to-chat {
    background: none;
    border: none;
    color: #3a3a40;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
    padding: 4px 0;
    transition: color 0.2s;
  }
  .back-to-chat:hover {
    color: #ededef;
  }

  .brand-user-rates {
    display: flex;
    gap: 8px;
    margin-top: 6px;
    font-size: 11px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    color: #6a6a72;
  }

  /* === Token-based utility classes === */
  .text-primary {
    color: #ededef;
  }
  .text-secondary {
    color: #6a6a72;
  }
  .text-muted {
    color: #3a3a40;
  }
  .section-label {
    color: #3a3a40;
  }
  .accent-secondary {
    color: #4d7cff;
  }
  .accent-tertiary {
    color: #e87fa8;
  }

  /* === Hero section === */
  .hero-label {
    color: #3a3a40;
  }
  .hero-title {
    color: #ededef;
  }
  .hero-title-accent {
    color: #6a6a72;
  }
  .hero-footer {
    color: #3a3a40;
  }
  .hero-sign-out {
    color: #3a3a40;
  }
  .hero-sign-out:hover {
    color: #ededef;
  }
  .hero-sign-in {
    color: #3a3a40;
  }
  .hero-sign-in:hover {
    color: #4d7cff;
  }

  .studio-textarea-hero {
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.035);
    color: #ededef;
  }
  .studio-textarea-hero::placeholder {
    color: #3a3a40;
  }

  .preset-chip {
    border: 1px solid #111114;
    background: rgba(255, 255, 255, 0.025);
    color: #6a6a72;
  }

  .discover-btn {
    background: #e8833a;
    color: #0a0a0c;
    box-shadow: 0 4px 16px rgba(232, 131, 58, 0.2);
    font-weight: 700;
  }
  .discover-btn:hover {
    box-shadow: 0 6px 24px rgba(232, 131, 58, 0.3);
  }

  /* === Docked prompt / Results toolbar === */
  .docked-prompt {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(10, 10, 12, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .studio-textarea-dock {
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: #111114;
    color: #ededef;
  }

  .rerun-btn {
    background: #e8833a;
    color: #0a0a0c;
    font-weight: 700;
  }

  .new-scene-btn {
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #3a3a40;
  }
  .new-scene-btn:hover {
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  /* === Results header === */
  .results-heading {
    color: #ededef;
  }
  .results-heading-muted {
    color: #3a3a40;
  }

  .toolbar-btn {
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #6a6a72;
  }
  .toolbar-btn:hover {
    border-color: rgba(255, 255, 255, 0.2);
    color: #ededef;
  }

  /* === Overview panel === */
  .overview-panel {
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.025);
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.35);
  }
  .overview-panel:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .overview-row {
    color: #6a6a72;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }
  .overview-row-last {
    border-bottom: none;
  }
  .overview-value {
    color: #ededef;
  }

  .interest-tag {
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.025);
    color: #ededef;
  }
  .behavior-tag {
    border: 1px solid rgba(77, 124, 255, 0.2);
    background: rgba(77, 124, 255, 0.1);
    color: #8babff;
  }

  /* === Mosaic === */
  .mosaic-tile {
    border: 1px solid rgba(255, 255, 255, 0.07);
  }
  .mosaic-initials {
    color: rgba(255, 255, 255, 0.9);
  }

  /* === Insight cards === */
  .insight-card {
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: linear-gradient(to bottom right, rgba(255, 255, 255, 0.025), transparent);
  }
  .insight-stat {
    color: #ededef;
  }
  .insight-title {
    color: #ededef;
  }
  .insight-caption {
    color: #3a3a40;
  }

  /* === Intel cards === */
  .intel-label {
    color: #e87fa8;
  }
  .intel-card {
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(0, 0, 0, 0.2);
  }
  .intel-card-label {
    color: #3a3a40;
  }
  .intel-card-body {
    color: #ededef;
  }

  /* === Member cards === */
  .member-card-selected {
    border-color: rgba(77, 124, 255, 0.5);
    background: rgba(77, 124, 255, 0.1);
    box-shadow: 0 0 24px rgba(77, 124, 255, 0.15);
  }
  .member-card-default {
    border-color: rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.025);
  }
  .member-card-default:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background: #111114;
  }
  .member-avatar {
    color: #ededef;
  }
  .member-card-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(0, 0, 0, 0.2);
  }
  .brief-body {
    color: #ededef;
  }
  .brief-label {
    color: #3a3a40;
  }

  /* === Campaign slide-over === */
  .campaign-aside {
    border-left: 1px solid rgba(255, 255, 255, 0.07);
    background: #0a0a0c;
  }
  .campaign-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }
  .campaign-close-btn {
    color: #3a3a40;
  }
  .campaign-close-btn:hover {
    background: rgba(255, 255, 255, 0.025);
    color: #ededef;
  }
  .campaign-option {
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.025);
  }
  .campaign-option:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }
  .campaign-option-disabled {
    border-color: rgba(255, 255, 255, 0.04);
  }
  .campaign-input {
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(0, 0, 0, 0.3);
    color: #ededef;
  }
  .campaign-input:focus {
    border-color: rgba(232, 131, 58, 0.4);
  }
  .creative-drop {
    border: 1px dashed rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.025);
  }
  .creative-drop-active {
    border-color: rgba(77, 124, 255, 0.5);
    background: rgba(77, 124, 255, 0.1);
  }
  .creative-drop-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .creative-preview-grid {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
  }
  .creative-preview-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.25);
  }
  .creative-preview-media {
    width: 100%;
    height: 96px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }
  .creative-remove {
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 248, 232, 0.65);
    font-size: 11px;
    padding: 4px 8px;
    cursor: pointer;
  }
  .creative-remove:hover {
    border-color: rgba(255, 77, 151, 0.35);
    color: #ff7fb5;
  }
  .campaign-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }

  /* Textarea focus states */
  .studio-textarea:focus {
    border-color: rgba(232, 131, 58, 0.4);
  }

  /* Preset chip hover */
  .preset-chip:hover {
    border-color: rgba(232, 131, 58, 0.3);
    background: rgba(232, 131, 58, 0.08);
    color: #e8833a;
  }

  /* Launch campaign buttons */
  .launch-btn {
    background: #e8833a;
    color: #0a0a0c;
    font-weight: 700;
    box-shadow: 0 2px 12px rgba(232, 131, 58, 0.2);
  }
  .launch-btn:hover {
    box-shadow: 0 4px 20px rgba(232, 131, 58, 0.3);
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
    border: 1px solid rgba(232, 131, 58, 0.15);
    background: rgba(232, 131, 58, 0.04);
  }

  /* Generate intelligence button */
  .generate-intel-btn {
    background: rgba(232, 131, 58, 0.12);
    border: 1px solid rgba(232, 131, 58, 0.3);
    color: #e8833a;
    font-weight: 700;
  }
  .generate-intel-btn:hover {
    background: rgba(232, 131, 58, 0.2);
  }

  /* Slider thumb */
  .slider-aud::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #e8833a;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: pointer;
  }
  .slider-aud::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 50%;
    background: #e8833a;
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
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.035);
    display: flex;
    flex-direction: column;
    gap: 24px;
    animation: card-in 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  }

  @keyframes card-in {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .confirm-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: center;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #e8833a;
    background: rgba(232, 131, 58, 0.08);
    border: 1px solid rgba(232, 131, 58, 0.2);
    border-radius: 4px;
    padding: 5px 12px;
  }

  .confirm-title {
    font-size: 20px;
    font-weight: 600;
    color: #ededef;
    text-align: center;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .confirm-sub {
    font-size: 13px;
    color: #3a3a40;
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
    .confirm-row {
      grid-template-columns: 1fr;
    }
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
    color: #3a3a40;
  }

  .confirm-input,
  .confirm-select {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: #ededef;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .confirm-input:focus,
  .confirm-select:focus {
    border-color: rgba(232, 131, 58, 0.4);
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
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(232, 131, 58, 0.08);
    color: #e8833a;
    border: 1px solid rgba(232, 131, 58, 0.15);
  }

  .confirm-tag--blue {
    background: rgba(77, 124, 255, 0.06);
    color: #4d7cff;
    border-color: rgba(77, 124, 255, 0.12);
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
    border-radius: 10px;
    background: #e8833a;
    color: #0a0a0c;
    font-size: 13px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s ease;
  }

  .confirm-btn:hover {
    transform: translateY(-1px);
  }
  .confirm-btn:active {
    transform: scale(0.98);
  }

  .confirm-btn-icon {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .confirm-back {
    background: none;
    border: none;
    color: #3a3a40;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    padding: 8px;
    text-align: center;
    transition: color 0.2s;
  }
  .confirm-back:hover {
    color: #6a6a72;
  }

  /* (portal-content-studio, studio-divider, section-intro removed — now bento cards) */

  /* ── Insight cards (rendered from portal, after follower analytics) ── */
  .bos-insights-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    grid-column: 1 / -1;
  }
  .bos-insight-card {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 12px;
    padding: 16px;
  }
  .bos-insight-green {
    border-left: 3px solid #4ade80;
  }
  .bos-insight-red {
    border-left: 3px solid #f87171;
  }
  .bos-insight-amber {
    border-left: 3px solid #e8833a;
    background: rgba(232, 131, 58, 0.04);
  }
  .bos-insight-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    display: block;
    margin-bottom: 8px;
  }
  .bos-insight-text {
    font-family: 'PP Mori', 'Inter', sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: #9a9aa0;
    margin: 0;
  }
  .bos-insight-list {
    font-family: 'PP Mori', 'Inter', sans-serif;
    font-size: 12px;
    line-height: 1.8;
    color: #9a9aa0;
    margin: 0;
    padding-left: 18px;
  }
  @media (max-width: 640px) {
    .bos-insights-row {
      grid-template-columns: 1fr;
    }
  }
</style>
