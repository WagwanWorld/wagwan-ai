import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import type { BrandOsDashboard, CreatorMatch } from '$lib/types/brand-os';
import { guardBrandAiEndpoint, logBrandAiCall } from '$lib/server/brand/llmGovernance';
import { BRAND_OS_PROMPT_VERSIONS } from '$lib/server/prompts/brand-os';
import { loadCreatorPortraits, scoreCreators } from '$lib/server/marketplace/creatorScoring';
import type { BrandBrief } from '$lib/server/marketplace/brandMatchAgent';

function toDelta(current: number, previous: number): { delta: string; trend: 'up' | 'down' | 'flat' } {
  if (!previous || Number.isNaN(previous)) return { delta: '0%', trend: 'flat' };
  const pct = ((current - previous) / Math.max(previous, 1)) * 100;
  if (Math.abs(pct) < 0.5) return { delta: '0%', trend: 'flat' };
  const prefix = pct > 0 ? '+' : '';
  return { delta: `${prefix}${pct.toFixed(1)}%`, trend: pct > 0 ? 'up' : 'down' };
}

function inferCalendar(
  pillars: string[],
  bestDays: Array<{ day: string }> = [],
  bestHours: Array<{ hour: number }> = [],
) {
  const defaultDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = bestDays.length ? bestDays.map((d) => d.day) : defaultDays;
  const hours = bestHours.length ? bestHours.map((h) => `${String(h.hour).padStart(2, '0')}:00`) : ['10:00', '14:00', '19:00'];
  const safePillars = pillars.length ? pillars : ['Education', 'Proof', 'Community'];
  return Array.from({ length: 7 }).map((_, i) => ({
    day: days[i % days.length],
    slot: hours[i % hours.length],
    pillar: safePillars[i % safePillars.length],
    concept: `Ship one ${safePillars[i % safePillars.length].toLowerCase()} post with a clear CTA.`,
  }));
}

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');
  await guardBrandAiEndpoint('/api/brand/os-dashboard');

  const sb = getServiceSupabase();

  const [brandRes, snapshotsRes, briefRes, dailyBriefRes, findingsRes, pillarsRes, campaignsRes, postsRes] = await Promise.all([
    sb
      .from('brand_accounts')
      .select('ig_name,ig_username,ig_followers_count,brand_identity,identity_updated_at,brand_id,ig_access_token')
      .eq('ig_user_id', igUserId)
      .maybeSingle(),
    sb
      .from('brand_snapshots')
      .select('snapshot_date,engagement_rate,reach_7d,avg_saves,avg_shares,posts_per_week,intelligence')
      .eq('brand_ig_id', igUserId)
      .order('snapshot_date', { ascending: false })
      .limit(2),
    sb
      .from('brand_weekly_briefs')
      .select('headline,sections,key_metrics,brief_date')
      .eq('brand_ig_id', igUserId)
      .order('brief_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('daily_briefs')
      .select('headline,synopsis,actions,evidence,brief_date')
      .eq('brand_ig_id', igUserId)
      .order('brief_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('insight_findings')
      .select('finding_type,title,summary,suggested_action')
      .eq('brand_ig_id', igUserId)
      .order('created_at', { ascending: false })
      .limit(6),
    sb
      .from('content_pillars')
      .select('label,description')
      .eq('brand_ig_id', igUserId)
      .order('avg_quality_engagement', { ascending: false })
      .limit(6),
    sb
      .from('campaigns')
      .select('id,title,status,reward_inr,created_at')
      .eq('brand_id', (await sb.from('brand_accounts').select('brand_id').eq('ig_user_id', igUserId).maybeSingle()).data?.brand_id ?? '')
      .order('created_at', { ascending: false })
      .limit(20),
    sb
      .from('scheduled_posts')
      .select('id,caption,media_type,status,scheduled_at,ig_permalink')
      .eq('brand_ig_id', igUserId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (brandRes.error) throw error(500, 'Could not load brand account');
  const brand = brandRes.data;
  if (!brand) throw error(404, 'Brand account not found');

  const snapshots = snapshotsRes.data ?? [];
  const latest = snapshots[0];
  const previous = snapshots[1];
  const brief = briefRes.data;
  const dailyBrief = dailyBriefRes.data;
  const findings = findingsRes.data ?? [];
  const pillars = pillarsRes.data ?? [];
  const campaigns = campaignsRes.data ?? [];
  const posts = postsRes.data ?? [];

  const latestIntel = (latest?.intelligence as Record<string, any>) || {};

  let rawPosts = Array.isArray(latestIntel.recentPosts)
    ? latestIntel.recentPosts
    : Array.isArray(latestIntel.identity?.recentMedia)
      ? latestIntel.identity.recentMedia
      : [];

  // If no posts in intelligence, fetch directly from Instagram API
  if (rawPosts.length === 0 && brand.ig_access_token) {
    try {
      const igMediaRes = await fetch(
        `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id,media_type,thumbnail_url,media_url,like_count,comments_count,permalink&limit=8&access_token=${brand.ig_access_token}`,
      );
      if (igMediaRes.ok) {
        const igMediaJson = await igMediaRes.json();
        rawPosts = igMediaJson?.data ?? [];
      }
    } catch {
      // Non-fatal — continue without posts
    }
  }

  const recentPosts = rawPosts.slice(0, 8).map((p: any) => ({
    id: String(p.id || ''),
    thumbnail: String(p.thumbnail || p.thumbnail_url || p.media_url || ''),
    type: String(p.type || p.media_type || 'IMAGE'),
    likes: Number(p.likes ?? p.like_count ?? 0),
    comments: Number(p.comments ?? p.comments_count ?? 0),
    permalink: String(p.permalink || ''),
  }));

  const brandVibes: string[] = (
    Array.isArray(latestIntel.identity?.interests) && latestIntel.identity.interests.length > 0
      ? latestIntel.identity.interests :
    Array.isArray(latestIntel.identity?.vibes) ? latestIntel.identity.vibes :
    Array.isArray(latestIntel.identity?.brandVibes) ? latestIntel.identity.brandVibes :
    []
  ).slice(0, 6);

  const audiencePortrait = latestIntel.audiencePortrait || {};
  const strategic = latestIntel.strategicPositioning || {};
  const bestDays = latestIntel.bestDays || [];
  const bestHours = latestIntel.bestHours || [];

  const engagementNow = Number(latest?.engagement_rate ?? 0);
  const engagementPrev = Number(previous?.engagement_rate ?? 0);
  const reachNow = Number(latest?.reach_7d ?? 0);
  const reachPrev = Number(previous?.reach_7d ?? 0);
  const saveNow = Number(latest?.avg_saves ?? 0);
  const savePrev = Number(previous?.avg_saves ?? 0);
  const shareNow = Number(latest?.avg_shares ?? 0);
  const sharePrev = Number(previous?.avg_shares ?? 0);

  const campaignStatusCounts = campaigns.reduce<Record<string, number>>((acc, c) => {
    acc[c.status ?? 'unknown'] = (acc[c.status ?? 'unknown'] ?? 0) + 1;
    return acc;
  }, {});

  const contentCount = posts.reduce(
    (acc, p) => {
      acc[p.status as keyof typeof acc] = (acc[p.status as keyof typeof acc] ?? 0) + 1;
      return acc;
    },
    { draft: 0, scheduled: 0, published: 0, failed: 0 },
  );

  // ── Creator Matching ──
  // Build a lightweight brief from brand intelligence to score creators
  const brandIdentity = (brand.brand_identity ?? {}) as Record<string, any>;
  const contentThemes = Array.isArray(strategic.contentPillars) ? strategic.contentPillars
    : pillars.length ? pillars.map(p => p.label).filter(l => !l.includes(' / '))
    : brandVibes;
  const autoBrief: BrandBrief = {
    product_summary: brandIdentity.description || latestIntel.identity?.rawSummary || brand.ig_name || '',
    buyer_roles: Array.isArray(audiencePortrait.personas) ? audiencePortrait.personas.map((p: any) => p.name) : [],
    buyer_stage: ['awareness'],
    buyer_identity_signals: [
      ...(Array.isArray(latestIntel.identity?.interests) ? latestIntel.identity.interests : []),
      ...(brandVibes || []),
    ].slice(0, 8),
    bad_fit_signals: [],
    campaign_intent: 'awareness',
    content_themes_needed: contentThemes.slice(0, 6),
    budget_tier: 'micro',
    timeline: '2 weeks',
    geography: latestIntel.identity?.city ? [latestIntel.identity.city] : [],
    success_metric: 'engagement',
    brand_voice_match: brandIdentity.voice || latestIntel.identity?.personality || '',
  };

  let creatorMatches: CreatorMatch[] = [];
  try {
    const portraits = await loadCreatorPortraits();
    // Exclude the brand's own profile if they happen to be in the user table
    const filtered = portraits.filter(p => p.handle && p.handle !== brand.ig_username);
    const result = scoreCreators(filtered, autoBrief, 6);
    creatorMatches = result.matches.map(m => ({
      googleSub: m.creator.google_sub,
      name: m.creator.name || m.creator.handle,
      handle: m.creator.handle,
      followerCount: m.creator.follower_count,
      score: m.score,
      reasoning: m.reasoning,
      themes: m.creator.content_themes.slice(0, 4),
      location: m.creator.location,
      profilePic: '', // Will be filled below
    }));

    // Fetch profile pictures for matched creators
    if (creatorMatches.length > 0) {
      const subs = creatorMatches.map(c => c.googleSub);
      const { data: profileRows } = await sb
        .from('user_profiles')
        .select('google_sub, profile_data')
        .in('google_sub', subs);
      if (profileRows) {
        const picMap = new Map<string, string>();
        for (const row of profileRows) {
          const pd = (row.profile_data ?? {}) as Record<string, any>;
          const pic = pd.instagramIdentity?.profilePicture || pd.picture || '';
          if (pic) picMap.set(row.google_sub as string, pic);
        }
        for (const match of creatorMatches) {
          match.profilePic = picMap.get(match.googleSub) || '';
        }
      }
    }
  } catch {
    // Non-fatal — dashboard still renders without creator matches
  }

  const dashboard: BrandOsDashboard = {
    generatedAt: new Date().toISOString(),
    executive: {
      brandName: brand.ig_name || 'Brand',
      handle: brand.ig_username ? `@${brand.ig_username}` : '@brand',
      lastUpdated: brand.identity_updated_at ?? null,
      metrics: [
        {
          label: 'Followers',
          value: Number(brand.ig_followers_count ?? 0).toLocaleString(),
          note: 'Current audience size',
        },
        {
          label: 'Engagement Rate',
          value: `${engagementNow.toFixed(2)}%`,
          ...toDelta(engagementNow, engagementPrev),
        },
        {
          label: 'Reach (7d)',
          value: reachNow.toLocaleString(),
          ...toDelta(reachNow, reachPrev),
        },
        {
          label: 'Save Rate Proxy',
          value: saveNow.toFixed(1),
          ...toDelta(saveNow, savePrev),
        },
        {
          label: 'Share Rate Proxy',
          value: shareNow.toFixed(1),
          ...toDelta(shareNow, sharePrev),
        },
        {
          label: 'Active Campaigns',
          value: String((campaignStatusCounts.active ?? 0) + (campaignStatusCounts.live ?? 0)),
          note: `${campaigns.length} total campaigns`,
        },
        {
          label: 'Posts/Week',
          value: (Number(latest?.posts_per_week ?? 0)).toFixed(1),
          note: Number(latest?.posts_per_week ?? 0) < 2 ? 'Increase recommended' : 'Current pace',
        },
      ],
    },
    audienceInsights: {
      summary:
        audiencePortrait.narrative ||
        audiencePortrait.summary ||
        (latestIntel.demographics as any)?.narrative ||
        latestIntel.identity?.rawSummary ||
        'We\'re still getting to know your audience. Run an analysis to unlock insights.',
      personas: Array.isArray(audiencePortrait.personas) && audiencePortrait.personas.length > 0
        ? audiencePortrait.personas.slice(0, 4)
        : (latestIntel.identity?.interests || []).slice(0, 4).map((interest: string) => ({
            name: interest,
            description: `Key brand signal in the ${interest} space`,
          })),
      keyInsights: [
        {
          title: 'Primary demographic',
          value:
            audiencePortrait.primaryDemographic?.ageRange ||
            latestIntel.identity?.city ||
            strategic.brandDirection?.slice(0, 32) ||
            'Not enough data',
          rationale: latestIntel.identity?.city
            ? `Based in ${latestIntel.identity.city}`
            : 'Derived from latest audience portrait and identity synthesis.',
        },
        {
          title: 'Posts per week',
          value: `${Number(latest?.posts_per_week ?? 0).toFixed(1)}`,
          rationale: 'Cadence from latest snapshot.',
        },
        {
          title: 'Best windows',
          value:
            bestDays?.length && bestHours?.length
              ? `${bestDays[0]?.day || 'N/A'} ${String(bestHours[0]?.hour ?? 0).padStart(2, '0')}:00`
              : 'Generate timing insights',
          rationale: 'Weighted by historical engagement.',
        },
      ],
    },
    synopsis: {
      headline: dailyBrief?.headline || brief?.headline || 'No weekly synopsis yet',
      whatHappened:
        dailyBrief?.synopsis ||
        brief?.sections?.whats_working ||
        'Your numbers are here — run an analysis to turn them into a story.',
      whyItHappened:
        (dailyBrief?.evidence as any)?.whyItHappened ||
        findings[0]?.summary ||
        brief?.sections?.whats_not ||
        strategic.competitiveGaps ||
        'We need a deeper look to figure out the why. Hit Run Analysis above.',
      whatNext: (() => {
        const dailyActions = Array.isArray(dailyBrief?.actions)
          ? dailyBrief.actions.map((a: any) => String(a?.action || a?.title || '')).filter(Boolean)
          : [];
        if (dailyActions.length) return dailyActions.slice(0, 3);
        const strategicQuickWins = Array.isArray(strategic.quickWins) ? strategic.quickWins : [];
        if (strategicQuickWins.length) return strategicQuickWins.slice(0, 3);
        return ['Run full analysis', 'Review content mix', 'Refresh campaign targets'];
      })(),
      confidenceLabel: latest ? 'Model confidence: medium' : 'Model confidence: low',
    },
    brandKit: {
      messagingPillars: (() => {
        // Filter out raw classification labels like "generic / save" — they're format/interaction types, not pillars
        const meaningfulPillars = pillars
          .filter((p) => !p.label.includes(' / ') && p.label.toLowerCase() !== 'generic' && p.label.toLowerCase() !== 'none')
          .map((p) => p.label);
        // If we have real pillar labels from the DB, use those
        if (meaningfulPillars.length >= 2) return meaningfulPillars.slice(0, 6);
        // Otherwise try descriptions from content_pillars (often more meaningful)
        const fromDescriptions = pillars
          .filter((p) => p.description && p.description.length > 3)
          .map((p) => p.description);
        if (fromDescriptions.length >= 2) return fromDescriptions.slice(0, 6);
        // Fall back to strategic positioning data
        if (Array.isArray(strategic.contentPillars) && strategic.contentPillars.length > 0) return strategic.contentPillars.slice(0, 6);
        // Fall back to brand identity pillars
        const identityPillars = (brand.brand_identity as any)?.messaging?.pillars
          || (brand.brand_identity as any)?.contentPillars
          || (latestIntel.identity as any)?.contentPillars;
        if (Array.isArray(identityPillars) && identityPillars.length > 0) return identityPillars.slice(0, 6);
        return ['Outcome', 'Proof', 'Community'];
      })(),
      visualDirection: {
        palette:
          (brand.brand_identity as any)?.visual?.colorPalette?.slice?.(0, 4)?.join(', ') ||
          (brand.brand_identity as any)?.visual?.palette ||
          (latestIntel.identity as any)?.aesthetic?.palette ||
          (latestIntel.identity as any)?.colorPalette ||
          (latestIntel.identity as any)?.aesthetic?.colorPalette ||
          'Need refreshed identity extraction',
        mood:
          (brand.brand_identity as any)?.visual?.aesthetic?.tone ||
          (brand.brand_identity as any)?.aesthetic ||
          latestIntel.identity?.aesthetic ||
          latestIntel.identity?.musicVibe ||
          'Confident, modern, human',
        composition:
          (brand.brand_identity as any)?.visual?.aesthetic?.composition || 'Mixed composition',
        doDonts: [
          'Do keep hooks specific and audience-facing.',
          'Do keep visual language consistent by pillar.',
          'Do not over-index one format for >2 weeks.',
          'Do not publish without a clear CTA objective.',
        ],
      },
      campaignRules: [
        'Prioritize creators with accepted → live completion history.',
        'Use one campaign intent per brief (awareness or conversion, not both).',
        'Require concept + expected outcome before launch.',
        'Close stale campaigns quickly and recycle insights into next brief.',
      ],
      audiencePersonas: Array.isArray(audiencePortrait.personas)
        ? audiencePortrait.personas.slice(0, 4)
        : [],
      contentCalendar: (() => {
        const quickWins: string[] = Array.isArray(strategic.quickWins) ? strategic.quickWins : [];
        const safePillars = pillars.length
          ? pillars.map((p) => p.label)
          : Array.isArray(strategic.contentPillars)
            ? strategic.contentPillars
            : ['Education', 'Proof', 'Community'];
        if (quickWins.length >= 3) {
          return quickWins.slice(0, 7).map((win, i) => ({
            day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i % 7],
            slot: bestHours.length ? `${String(bestHours[i % bestHours.length]?.hour ?? 10).padStart(2, '0')}:00` : '10:00',
            pillar: safePillars[i % safePillars.length],
            concept: win,
          }));
        }
        return inferCalendar(safePillars, bestDays, bestHours);
      })(),
    },
    campaignOps: {
      activeCount: (campaignStatusCounts.active ?? 0) + (campaignStatusCounts.live ?? 0),
      campaigns: campaigns.map((c) => ({
        id: c.id as string,
        title: (c.title as string) || 'Untitled campaign',
        status: (c.status as string) || 'unknown',
        rewardInr: Number(c.reward_inr ?? 0),
        createdAt: c.created_at as string,
        counts: {},
      })),
    },
    recentPosts,
    brandVibes,
    creatorMatches,
    brandScheme: latestIntel.brandScheme || undefined,
    contentOps: {
      draft: contentCount.draft,
      scheduled: contentCount.scheduled,
      published: contentCount.published,
      failed: contentCount.failed,
      latestPosts: posts.map((p) => ({
        id: p.id as string,
        caption: ((p.caption as string) || '').slice(0, 140),
        mediaType: p.media_type as string,
        status: p.status as string,
        scheduledAt: (p.scheduled_at as string | null) ?? null,
        permalink: (p.ig_permalink as string | null) ?? null,
      })),
    },
  };

  await logBrandAiCall({
    brandIgId: igUserId,
    endpoint: '/api/brand/os-dashboard',
    promptVersion: BRAND_OS_PROMPT_VERSIONS.insights,
    model: 'aggregator-v1',
    metadata: {
      campaigns: dashboard.campaignOps.campaigns.length,
      posts: dashboard.contentOps.latestPosts.length,
      findings: findings.length,
    },
  });

  return json({ ok: true, dashboard });
};

