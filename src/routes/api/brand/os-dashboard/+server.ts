import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import type { BrandOsDashboard } from '$lib/types/brand-os';
import { guardBrandAiEndpoint, logBrandAiCall } from '$lib/server/brand/llmGovernance';
import { BRAND_OS_PROMPT_VERSIONS } from '$lib/server/prompts/brand-os';

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
      .select('ig_name,ig_username,ig_followers_count,brand_identity,identity_updated_at,brand_id')
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

  const recentPosts = (Array.isArray(latestIntel.recentPosts) ? latestIntel.recentPosts : []).slice(0, 8).map((p: any) => ({
    id: String(p.id || ''),
    thumbnail: String(p.thumbnail || ''),
    type: String(p.type || 'IMAGE'),
    likes: Number(p.likes ?? 0),
    comments: Number(p.comments ?? 0),
    permalink: String(p.permalink || ''),
  }));

  const brandVibes: string[] = Array.isArray(latestIntel.identity?.brandVibes)
    ? latestIntel.identity.brandVibes.slice(0, 6)
    : [];

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
      ],
    },
    audienceInsights: {
      summary:
        audiencePortrait.narrative ||
        'Audience signals are still building. Trigger a refresh to generate fresh audience diagnostics.',
      personas: Array.isArray(audiencePortrait.personas) ? audiencePortrait.personas.slice(0, 4) : [],
      keyInsights: [
        {
          title: 'Primary demographic',
          value:
            audiencePortrait.primaryDemographic?.ageRange ||
            strategic.brandDirection?.slice(0, 32) ||
            'Not enough data',
          rationale: 'Derived from latest audience portrait and identity synthesis.',
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
        'Performance snapshot available, but narrative synthesis has not run yet.',
      whyItHappened:
        findings[0]?.summary ||
        brief?.sections?.whats_not ||
        strategic.competitiveGaps ||
        'Run analysis to generate causal diagnostics.',
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
      messagingPillars: pillars.length
        ? pillars.map((p) => p.label).slice(0, 6)
        : Array.isArray(strategic.contentPillars)
          ? strategic.contentPillars.slice(0, 6)
        : ['Outcome', 'Proof', 'Community'],
      visualDirection: {
        palette:
          (brand.brand_identity as any)?.visual?.colorPalette?.slice?.(0, 4)?.join(', ') ||
          (brand.brand_identity as any)?.visual?.palette ||
          'Need refreshed identity extraction',
        mood:
          (brand.brand_identity as any)?.visual?.aesthetic?.tone ||
          (brand.brand_identity as any)?.aesthetic ||
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
      contentCalendar: inferCalendar(
        Array.isArray(strategic.contentPillars) ? strategic.contentPillars : [],
        bestDays,
        bestHours,
      ),
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

