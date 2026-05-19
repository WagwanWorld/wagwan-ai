import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { tryBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import type { BrandOsDashboard, CreatorMatch } from '$lib/types/brand-os';
import { guardBrandAiEndpoint, logBrandAiCall } from '$lib/server/brand/llmGovernance';
import { BRAND_OS_PROMPT_VERSIONS } from '$lib/server/prompts/brand-os';
import { loadCreatorPortraits, scoreCreators } from '$lib/server/marketplace/creatorScoring';
import type { BrandBrief } from '$lib/server/marketplace/brandMatchAgent';

/** Fetch live Instagram account insights for a given period */
async function fetchLiveInsights(igUserId: string, token: string, periodDays: number) {
  const result = {
    reach: 0,
    profileViews: 0,
    totalInteractions: 0,
    followerCount: 0,
    accountsEngaged: 0,
    debug: '',
  };
  const until = Math.floor(Date.now() / 1000);
  const since = until - periodDays * 86400;

  // Account-level metrics — try multiple metric names for compatibility
  const metricGroups = [
    { metric: 'reach', field: 'reach' as const },
    { metric: 'profile_views', field: 'profileViews' as const },
    { metric: 'total_interactions', field: 'totalInteractions' as const },
    { metric: 'accounts_engaged', field: 'accountsEngaged' as const },
  ];

  const fetches = metricGroups.map(async ({ metric, field }) => {
    try {
      const url = `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=${metric}&period=day&since=${since}&until=${until}&access_token=${token}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.log(`[live-insights] ${metric} failed (${res.status}): ${errBody.slice(0, 200)}`);
        return;
      }
      const data = await res.json();
      const values = data?.data?.[0]?.values || [];
      const sum = values.reduce((s: number, v: { value: number }) => s + (v.value || 0), 0);
      (result as any)[field] = sum;
      console.log(`[live-insights] ${metric} = ${sum} (${values.length} days)`);
    } catch (e) {
      console.log(`[live-insights] ${metric} exception:`, e);
    }
  });
  await Promise.all(fetches);

  // Use accounts_engaged as fallback for total_interactions
  if (result.totalInteractions === 0 && result.accountsEngaged > 0) {
    result.totalInteractions = result.accountsEngaged;
  }

  // Follower count + media count from profile
  try {
    const profileRes = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}?fields=followers_count,follows_count,media_count&access_token=${token}`,
    );
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      result.followerCount = profileData?.followers_count || 0;
      console.log(
        `[live-insights] followers=${result.followerCount}, media=${profileData?.media_count}`,
      );
    }
  } catch {
    /* non-fatal */
  }

  return result;
}

function toDelta(
  current: number,
  previous: number,
): { delta: string; trend: 'up' | 'down' | 'flat' } {
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
  const hours = bestHours.length
    ? bestHours.map((h) => `${String(h.hour).padStart(2, '0')}:00`)
    : ['10:00', '14:00', '19:00'];
  const safePillars = pillars.length ? pillars : ['Education', 'Proof', 'Community'];
  return Array.from({ length: 7 }).map((_, i) => ({
    day: days[i % days.length],
    slot: hours[i % hours.length],
    pillar: safePillars[i % safePillars.length],
    concept: `Ship one ${safePillars[i % safePillars.length].toLowerCase()} post with a clear CTA.`,
  }));
}

export const GET: RequestHandler = async ({ request, url }) => {
  const { igUserId, error: authError } = tryBrandAccess(request);
  if (authError) {
    console.error('[os-dashboard] auth failed:', authError);
    return json({ ok: false, error: authError }, { status: 401 });
  }
  if (!igUserId)
    return json({ ok: false, error: 'Brand session required — please re-login' }, { status: 401 });

  try {
    await guardBrandAiEndpoint('/api/brand/os-dashboard');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI endpoint blocked';
    console.error('[os-dashboard] guardBrandAiEndpoint threw:', msg);
    return json({ ok: false, error: `AI guard: ${msg}` }, { status: 503 });
  }

  // Period: 1d (daily), 7d (weekly, default), 30d (monthly)
  const periodParam = url.searchParams.get('period') || '7d';
  const periodDays = periodParam === '1d' ? 1 : periodParam === '30d' ? 30 : 7;
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString();
  const prevPeriodStart = new Date(
    now.getTime() - periodDays * 2 * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const sb = getServiceSupabase();

    const [
      brandRes,
      snapshotsRes,
      briefRes,
      dailyBriefRes,
      findingsRes,
      pillarsRes,
      campaignsRes,
      postsRes,
    ] = await Promise.all([
      sb
        .from('brand_accounts')
        .select(
          'ig_name,ig_username,ig_followers_count,brand_identity,identity_updated_at,brand_id,ig_access_token',
        )
        .eq('ig_user_id', igUserId)
        .maybeSingle(),
      sb
        .from('brand_snapshots')
        .select(
          'snapshot_date,engagement_rate,reach_7d,avg_saves,avg_shares,posts_per_week,intelligence',
        )
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
        .eq(
          'brand_id',
          (
            await sb
              .from('brand_accounts')
              .select('brand_id')
              .eq('ig_user_id', igUserId)
              .maybeSingle()
          ).data?.brand_id ?? '',
        )
        .order('created_at', { ascending: false })
        .limit(20),
      sb
        .from('scheduled_posts')
        .select('id,caption,media_type,status,scheduled_at,ig_permalink')
        .eq('brand_ig_id', igUserId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    // ── Compute time-windowed metrics from post_fingerprints ──
    const [fpCurrentRes, fpPrevRes] = await Promise.all([
      sb
        .from('post_fingerprints')
        .select('likes,comments,saves,shares,reach,posted_at')
        .eq('brand_ig_id', igUserId)
        .gte('posted_at', periodStart)
        .order('posted_at', { ascending: false }),
      sb
        .from('post_fingerprints')
        .select('likes,comments,saves,shares,reach,posted_at')
        .eq('brand_ig_id', igUserId)
        .gte('posted_at', prevPeriodStart)
        .lt('posted_at', periodStart)
        .order('posted_at', { ascending: false }),
    ]);

    const fpCurrent = fpCurrentRes.data ?? [];
    const fpPrev = fpPrevRes.data ?? [];

    function computePeriodMetrics(fps: typeof fpCurrent, followers: number, days: number) {
      if (fps.length === 0)
        return {
          engRate: 0,
          reach: 0,
          avgSaves: 0,
          avgShares: 0,
          postsPerWeek: 0,
          postCount: 0,
          totalLikes: 0,
          totalComments: 0,
        };
      const totalLikes = fps.reduce((s, p) => s + (p.likes || 0), 0);
      const totalComments = fps.reduce((s, p) => s + (p.comments || 0), 0);
      const totalSaves = fps.reduce((s, p) => s + (p.saves || 0), 0);
      const totalShares = fps.reduce((s, p) => s + (p.shares || 0), 0);
      const totalReach = fps.reduce((s, p) => s + (p.reach || 0), 0);
      const n = fps.length;
      // Engagement rate = avg (likes + comments) per post / followers * 100
      const engRate = followers > 0 ? ((totalLikes + totalComments) / n / followers) * 100 : 0;
      // If no reach data from insights, estimate reach as total engagement * 5 (rough IG heuristic)
      const estimatedReach = totalReach > 0 ? totalReach : (totalLikes + totalComments) * 5;
      return {
        engRate,
        reach: estimatedReach,
        avgSaves: totalSaves / n,
        avgShares: totalShares / n,
        postsPerWeek: (n / Math.max(1, days)) * 7,
        postCount: n,
        totalLikes,
        totalComments,
      };
    }

    if (brandRes.error) {
      console.error(
        '[os-dashboard] brand_accounts query error:',
        brandRes.error.message,
        'igUserId:',
        igUserId,
      );
      return json(
        { ok: false, error: `Brand account query failed: ${brandRes.error.message}` },
        { status: 500 },
      );
    }
    const brand = brandRes.data;
    if (!brand) {
      console.error('[os-dashboard] No brand_accounts row for igUserId:', igUserId);
      return json(
        {
          ok: false,
          error: `No brand account found for this Instagram session. Try re-connecting your brand Instagram.`,
        },
        { status: 404 },
      );
    }

    // Auto-link brand_id if missing
    if (!brand.brand_id) {
      const brandName = (brand.ig_name as string) || (brand.ig_username as string) || 'Brand';
      const { data: newBrand } = await sb
        .from('brands')
        .insert({ name: brandName })
        .select('id')
        .single();
      if (newBrand?.id) {
        brand.brand_id = newBrand.id;
        await sb
          .from('brand_accounts')
          .update({ brand_id: newBrand.id })
          .eq('ig_user_id', igUserId);
      }
    }

    // ── Fetch live Instagram insights for the selected period ──
    let liveInsights = { reach: 0, profileViews: 0, totalInteractions: 0, followerCount: 0 };
    if (brand.ig_access_token) {
      try {
        liveInsights = await fetchLiveInsights(
          igUserId,
          brand.ig_access_token as string,
          periodDays,
        );
      } catch (e) {
        console.error('[os-dashboard] fetchLiveInsights failed:', e);
      }
    }
    // Update follower count from live data if available
    if (liveInsights.followerCount > 0) {
      brand.ig_followers_count = liveInsights.followerCount;
    }

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
        ? latestIntel.identity.interests
        : Array.isArray(latestIntel.identity?.vibes)
          ? latestIntel.identity.vibes
          : Array.isArray(latestIntel.identity?.brandVibes)
            ? latestIntel.identity.brandVibes
            : []
    ).slice(0, 6);

    const audiencePortrait = latestIntel.audiencePortrait || {};
    const strategic = latestIntel.strategicPositioning || {};
    const bestDays = latestIntel.bestDays || [];
    const bestHours = latestIntel.bestHours || [];

    // ── Time-windowed metrics: live IG insights > fingerprints > snapshot ──
    const followerCount = Number(brand.ig_followers_count ?? 0);
    const currentMetrics = computePeriodMetrics(fpCurrent, followerCount, periodDays);
    const prevMetrics = computePeriodMetrics(fpPrev, followerCount, periodDays);

    // Also query ALL fingerprints as fallback when current period is empty
    let allTimeMetrics = currentMetrics;
    if (currentMetrics.postCount === 0) {
      const { data: fpAll } = await sb
        .from('post_fingerprints')
        .select('likes,comments,saves,shares,reach,posted_at')
        .eq('brand_ig_id', igUserId)
        .order('posted_at', { ascending: false })
        .limit(50);
      allTimeMetrics = computePeriodMetrics(fpAll ?? [], followerCount, 30);
    }

    const hasLiveInsights =
      liveInsights.reach > 0 ||
      liveInsights.totalInteractions > 0 ||
      liveInsights.accountsEngaged > 0;
    const hasFpData = currentMetrics.postCount > 0 || allTimeMetrics.postCount > 0;
    const fpMetrics = currentMetrics.postCount > 0 ? currentMetrics : allTimeMetrics;

    // Engagement rate: live interactions / followers, or fingerprint-based, or snapshot
    const liveInteractions = liveInsights.totalInteractions || liveInsights.accountsEngaged;
    const engagementNow =
      hasLiveInsights && followerCount > 0 && liveInteractions > 0
        ? (liveInteractions / followerCount) * 100
        : hasFpData
          ? fpMetrics.engRate
          : Number(latest?.engagement_rate ?? 0);
    const engagementPrev =
      prevMetrics.postCount > 0 ? prevMetrics.engRate : Number(previous?.engagement_rate ?? 0);

    // Reach: live from IG API, or fingerprint-based, or snapshot
    const reachNow = hasLiveInsights
      ? liveInsights.reach
      : hasFpData
        ? fpMetrics.reach
        : Number(latest?.reach_7d ?? 0);
    const reachPrev =
      prevMetrics.postCount > 0 ? prevMetrics.reach : Number(previous?.reach_7d ?? 0);

    // Saves/shares: from fingerprints (IG API doesn't have account-level saves)
    const saveNow = hasFpData ? fpMetrics.avgSaves : Number(latest?.avg_saves ?? 0);
    const savePrev =
      prevMetrics.postCount > 0 ? prevMetrics.avgSaves : Number(previous?.avg_saves ?? 0);
    const shareNow = hasFpData ? fpMetrics.avgShares : Number(latest?.avg_shares ?? 0);
    const sharePrev =
      prevMetrics.postCount > 0 ? prevMetrics.avgShares : Number(previous?.avg_shares ?? 0);
    const postsPerWeekNow = hasFpData
      ? fpMetrics.postsPerWeek
      : Number(latest?.posts_per_week ?? 0);

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
    const contentThemes = Array.isArray(strategic.contentPillars)
      ? strategic.contentPillars
      : pillars.length
        ? pillars.map((p) => p.label).filter((l) => !l.includes(' / '))
        : brandVibes;
    const autoBrief: BrandBrief = {
      product_summary:
        brandIdentity.description || latestIntel.identity?.rawSummary || brand.ig_name || '',
      buyer_roles: Array.isArray(audiencePortrait.personas)
        ? audiencePortrait.personas.map((p: any) => p.name)
        : [],
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
      const filtered = portraits.filter((p) => p.handle && p.handle !== brand.ig_username);
      const result = scoreCreators(filtered, autoBrief, 6);
      creatorMatches = result.matches.map((m) => ({
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
        const subs = creatorMatches.map((c) => c.googleSub);
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
            value: followerCount.toLocaleString(),
            note: hasLiveInsights ? 'Live from Instagram' : 'Current audience size',
          },
          {
            label: 'Engagement Rate',
            value: `${engagementNow.toFixed(2)}%`,
            ...toDelta(engagementNow, engagementPrev),
            note:
              hasLiveInsights && liveInteractions > 0
                ? `${liveInteractions.toLocaleString()} interactions (${periodParam})`
                : hasFpData
                  ? `From ${fpMetrics.postCount} posts`
                  : undefined,
          },
          {
            label: `Reach (${periodParam})`,
            value: reachNow.toLocaleString(),
            ...toDelta(reachNow, reachPrev),
            note: hasLiveInsights ? 'Live from Instagram' : hasFpData ? 'Estimated' : undefined,
          },
          {
            label: 'Avg Saves',
            value: saveNow.toFixed(1),
            ...toDelta(saveNow, savePrev),
            note: 'per post',
          },
          {
            label: 'Avg Shares',
            value: shareNow.toFixed(1),
            ...toDelta(shareNow, sharePrev),
            note: 'per post',
          },
          {
            label: `Profile Views (${periodParam})`,
            value: liveInsights.profileViews > 0 ? liveInsights.profileViews.toLocaleString() : '—',
            note: hasLiveInsights ? 'Live from Instagram' : 'Run Refresh to fetch',
          },
          {
            label: 'Posts/Week',
            value: postsPerWeekNow.toFixed(1),
            note:
              postsPerWeekNow < 2
                ? 'Increase recommended'
                : `${fpMetrics.postCount} posts in period`,
          },
        ],
      },
      audienceInsights: {
        summary:
          audiencePortrait.narrative ||
          audiencePortrait.summary ||
          (latestIntel.demographics as any)?.narrative ||
          latestIntel.identity?.rawSummary ||
          "We're still getting to know your audience. Run an analysis to unlock insights.",
        personas:
          Array.isArray(audiencePortrait.personas) && audiencePortrait.personas.length > 0
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
            value: `${postsPerWeekNow.toFixed(1)}`,
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
            ? dailyBrief.actions
                .map((a: any) => String(a?.action || a?.title || ''))
                .filter(Boolean)
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
            .filter(
              (p) =>
                !p.label.includes(' / ') &&
                p.label.toLowerCase() !== 'generic' &&
                p.label.toLowerCase() !== 'none',
            )
            .map((p) => p.label);
          // If we have real pillar labels from the DB, use those
          if (meaningfulPillars.length >= 2) return meaningfulPillars.slice(0, 6);
          // Otherwise try descriptions from content_pillars (often more meaningful)
          const fromDescriptions = pillars
            .filter((p) => p.description && p.description.length > 3)
            .map((p) => p.description);
          if (fromDescriptions.length >= 2) return fromDescriptions.slice(0, 6);
          // Fall back to strategic positioning data
          if (Array.isArray(strategic.contentPillars) && strategic.contentPillars.length > 0)
            return strategic.contentPillars.slice(0, 6);
          // Fall back to brand identity pillars
          const identityPillars =
            (brand.brand_identity as any)?.messaging?.pillars ||
            (brand.brand_identity as any)?.contentPillars ||
            (latestIntel.identity as any)?.contentPillars;
          if (Array.isArray(identityPillars) && identityPillars.length > 0)
            return identityPillars.slice(0, 6);
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
          // Filter out raw classification labels like "generic / save" — same filtering as messagingPillars
          const meaningfulPillarLabels = pillars
            .filter(
              (p) =>
                !p.label.includes(' / ') &&
                p.label.toLowerCase() !== 'generic' &&
                p.label.toLowerCase() !== 'none',
            )
            .map((p) => p.label);
          const safePillars =
            meaningfulPillarLabels.length >= 2
              ? meaningfulPillarLabels
              : Array.isArray(strategic.contentPillars) && strategic.contentPillars.length > 0
                ? strategic.contentPillars
                : ['Education', 'Proof', 'Community'];
          if (quickWins.length >= 3) {
            return quickWins.slice(0, 7).map((win, i) => ({
              day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i % 7],
              slot: bestHours.length
                ? `${String(bestHours[i % bestHours.length]?.hour ?? 10).padStart(2, '0')}:00`
                : '10:00',
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

    try {
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
    } catch (logErr: unknown) {
      console.error('[os-dashboard] logBrandAiCall failed (non-fatal):', logErr);
    }

    const periodLabel =
      periodParam === '1d' ? 'Today' : periodParam === '30d' ? 'This Month' : 'This Week';
    return json({
      ok: true,
      dashboard,
      period: periodParam,
      periodLabel,
      postCount: fpMetrics.postCount,
      liveInsights: hasLiveInsights,
    });
  } catch (e: any) {
    const msg = e?.body?.message ?? (e instanceof Error ? e.message : String(e));
    const status = e?.status ?? 500;
    console.error('[os-dashboard] Unhandled error for igUserId:', igUserId, msg);
    return json({ ok: false, error: msg }, { status });
  }
};
