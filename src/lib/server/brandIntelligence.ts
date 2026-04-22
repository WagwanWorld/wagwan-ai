// src/lib/server/brandIntelligence.ts
//
// Core brand intelligence engine.
// Fetches all Instagram metrics (account insights, per-post insights, demographics)
// and runs an 8-phase Claude analysis pipeline.

import Anthropic from '@anthropic-ai/sdk';
import {
  fetchInstagramProfile,
  fetchInstagramMedia,
  analyseInstagramIdentity,
  type InstagramProfile,
  type InstagramMedia,
} from './instagram';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AccountInsights {
  impressions7d: number;
  reach7d: number;
  profileViews7d: number;
  onlineFollowers: Record<string, number[]> | null; // day -> 24 hourly values
}

export interface PostInsight {
  mediaId: string;
  mediaType: string;
  timestamp: string;
  caption: string;
  permalink: string;
  thumbnail: string;
  likes: number;
  comments: number;
  impressions: number;
  reach: number;
  saved: number;
  shares: number;
  videoViews: number;
  engagement: number; // likes + comments + saves + shares
}

export interface AudienceDemographics {
  ageBuckets: Record<string, number>;   // e.g. "18-24": 0.22
  genderSplit: { male: number; female: number; unknown: number };
  topCities: Array<{ city: string; pct: number }>;
  topCountries: Array<{ country: string; pct: number }>;
}

export interface ContentPerformance {
  formatBreakdown: Record<string, {
    count: number;
    avgReach: number;
    avgSaves: number;
    avgShares: number;
    avgEngagement: number;
  }>;
  topPostIds: string[];
  bottomPostIds: string[];
  contentArchetypes: Array<{
    archetype: string;
    description: string;
    avgReach: number;
    avgSaves: number;
    bestFormat: string;
    examplePostIds: string[];
  }>;
  reachDrivers: string;
  saveDrivers: string;
  shareDrivers: string;
}

export interface AudiencePortrait {
  narrative: string;
  primaryDemographic: {
    ageRange: string;
    gender: string;
    topCities: string[];
    topCountries: string[];
  };
  personas: Array<{ name: string; description: string }>;
}

export interface StrategicPositioning {
  brandDirection: string;
  contentPillars: string[];
  voiceGuidelines: string;
  competitiveGaps: string;
  bigBet: string;
  quickWins: string[];
}

export interface BrandIntelligenceResult {
  profile: InstagramProfile;
  postInsights: PostInsight[];
  accountInsights: AccountInsights;
  demographics: AudienceDemographics;
  contentPerformance: ContentPerformance;
  audiencePortrait: AudiencePortrait;
  strategicPositioning: StrategicPositioning;
  identity: Record<string, unknown>; // full Phase 1-5 identity
  postingHeatmap: Array<{ day: number; hour: number; avg: number }>;
  bestHours: Array<{ hour: number; avgEng: number }>;
  bestDays: Array<{ day: string; avgEng: number }>;
  topHashtags: Array<{ tag: string; count: number }>;
  engagementRate: number;
  avgPerPost: number;
  postsPerWeek: number;
  growthTrend: number;
}

// ── Instagram API fetchers ─────────────────────────────────────────────────

/** Fetch account-level insights (impressions, reach, profile_views) */
export async function fetchAccountInsights(
  igUserId: string,
  token: string,
): Promise<AccountInsights> {
  const result: AccountInsights = {
    impressions7d: 0,
    reach7d: 0,
    profileViews7d: 0,
    onlineFollowers: null,
  };

  // Daily metrics for last 7 days
  // Note: 'impressions' is NOT valid for Instagram API v25.0 — use 'reach', 'profile_views', 'accounts_engaged', 'total_interactions'
  const metricsToFetch = ['reach', 'profile_views', 'total_interactions'];
  for (const metric of metricsToFetch) {
    try {
      const res = await fetch(
        `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=${metric}&period=day&since=${Math.floor(Date.now() / 1000) - 7 * 86400}&until=${Math.floor(Date.now() / 1000)}&access_token=${token}`,
      );
      if (res.ok) {
        const data = await res.json();
        const values = data?.data?.[0]?.values || [];
        const sum = values.reduce((s: number, v: { value: number }) => s + (v.value || 0), 0);
        if (metric === 'reach') result.reach7d = sum;
        if (metric === 'profile_views') result.profileViews7d = sum;
        if (metric === 'total_interactions') result.impressions7d = sum; // repurpose field for total interactions
      }
    } catch {
      // Metric not available for this account type — skip
    }
  }

  // Online followers (lifetime, hourly breakdown by day)
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=online_followers&period=lifetime&access_token=${token}`,
    );
    if (res.ok) {
      const data = await res.json();
      result.onlineFollowers = data?.data?.[0]?.values?.[0]?.value || null;
    }
  } catch {}

  return result;
}

/** Fetch audience demographics (age, gender, city, country) */
export async function fetchDemographics(
  igUserId: string,
  token: string,
): Promise<AudienceDemographics> {
  const result: AudienceDemographics = {
    ageBuckets: {},
    genderSplit: { male: 0, female: 0, unknown: 0 },
    topCities: [],
    topCountries: [],
  };

  // Fetch each demographic breakdown separately — batching all breakdowns causes 500 errors
  const breakdownsToFetch = ['age', 'gender', 'city', 'country'];
  for (const breakdown of breakdownsToFetch) {
    try {
      const res = await fetch(
        `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=${breakdown}&access_token=${token}`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      const metric = data?.data?.[0];
      const bdResults = metric?.total_value?.breakdowns?.[0]?.results || [];

      if (breakdown === 'age') {
        for (const r of bdResults) {
          const age = r.dimension_values?.[0] || 'unknown';
          result.ageBuckets[age] = (result.ageBuckets[age] || 0) + (r.value || 0);
        }
      }
      if (breakdown === 'gender') {
        for (const r of bdResults) {
          const gender = r.dimension_values?.[0] || 'U';
          if (gender === 'M') result.genderSplit.male += r.value || 0;
          else if (gender === 'F') result.genderSplit.female += r.value || 0;
          else result.genderSplit.unknown += r.value || 0;
        }
      }
      if (breakdown === 'city') {
        const cities: Record<string, number> = {};
        for (const r of bdResults) {
          const city = r.dimension_values?.[0] || 'unknown';
          cities[city] = (cities[city] || 0) + (r.value || 0);
        }
        result.topCities = Object.entries(cities)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([city, count]) => ({ city, pct: count }));
      }
      if (breakdown === 'country') {
        const countries: Record<string, number> = {};
        for (const r of bdResults) {
          const country = r.dimension_values?.[0] || 'unknown';
          countries[country] = (countries[country] || 0) + (r.value || 0);
        }
        result.topCountries = Object.entries(countries)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([country, count]) => ({ country, pct: count }));
      }
    } catch {
      // This breakdown not available — continue with others
    }
  }

    // Normalize demographics to percentages
    const totalAge = Object.values(result.ageBuckets).reduce((s, v) => s + v, 0);
    if (totalAge > 0) {
      for (const key of Object.keys(result.ageBuckets)) {
        result.ageBuckets[key] = +(result.ageBuckets[key] / totalAge * 100).toFixed(1);
      }
    }
    const totalGender = result.genderSplit.male + result.genderSplit.female + result.genderSplit.unknown;
    if (totalGender > 0) {
      result.genderSplit.male = +(result.genderSplit.male / totalGender * 100).toFixed(1);
      result.genderSplit.female = +(result.genderSplit.female / totalGender * 100).toFixed(1);
      result.genderSplit.unknown = +(result.genderSplit.unknown / totalGender * 100).toFixed(1);
    }
    const totalCities = result.topCities.reduce((s, c) => s + c.pct, 0);
    if (totalCities > 0) {
      result.topCities = result.topCities.map(c => ({ ...c, pct: +(c.pct / totalCities * 100).toFixed(1) }));
    }
    const totalCountries = result.topCountries.reduce((s, c) => s + c.pct, 0);
    if (totalCountries > 0) {
      result.topCountries = result.topCountries.map(c => ({ ...c, pct: +(c.pct / totalCountries * 100).toFixed(1) }));
    }

  return result;
}

/** Fetch per-post insights (impressions, reach, saved, shares) for an array of media */
export async function fetchPostInsights(
  posts: InstagramMedia[],
  token: string,
): Promise<PostInsight[]> {
  const insights: PostInsight[] = [];

  // Only fetch insights for top 5 posts by engagement to avoid rate limiting
  const sorted = [...posts].sort((a, b) => ((b.like_count || 0) + (b.comments_count || 0)) - ((a.like_count || 0) + (a.comments_count || 0)));
  const insightPosts = new Set(sorted.slice(0, 5).map(p => p.id));

  for (const post of posts.slice(0, 25)) {
    const base: PostInsight = {
      mediaId: post.id,
      mediaType: post.media_type,
      timestamp: post.timestamp,
      caption: (post.caption || '').slice(0, 200),
      permalink: post.permalink || '',
      thumbnail: post.thumbnail_url || post.media_url || '',
      likes: post.like_count || 0,
      comments: post.comments_count || 0,
      impressions: 0,
      reach: 0,
      saved: 0,
      shares: 0,
      videoViews: 0,
      engagement: (post.like_count || 0) + (post.comments_count || 0),
    };

    // Only fetch per-post insights for top 5 posts to avoid rate limiting
    if (!insightPosts.has(post.id)) {
      insights.push(base);
      continue;
    }

    const isVideo = ['VIDEO', 'REELS'].includes(post.media_type);
    const metricsToTry = isVideo
      ? ['reach', 'saved', 'shares', 'plays']
      : ['reach', 'saved', 'shares'];

    for (const metric of metricsToTry) {
      try {
        const res = await fetch(
          `https://graph.instagram.com/v25.0/${post.id}/insights?metric=${metric}&access_token=${token}`,
        );
        if (res.ok) {
          const data = await res.json();
          const val = data?.data?.[0]?.values?.[0]?.value || 0;
          if (metric === 'reach') base.reach = val;
          if (metric === 'saved') base.saved = val;
          if (metric === 'shares') base.shares = val;
          if (metric === 'plays') base.videoViews = val;
        }
      } catch {
        // Individual metric not available — skip
      }
    }
    base.impressions = base.reach; // use reach as proxy for impressions
    base.engagement = base.likes + base.comments + base.saved + base.shares;

    insights.push(base);
  }

  return insights;
}

// ── Computation helpers ────────────────────────────────────────────────────

export function computePostingHeatmap(posts: PostInsight[]) {
  const hourDayMap: Record<string, { total: number; count: number }> = {};
  const hourMap: Record<number, { total: number; count: number }> = {};
  const dayMap: Record<number, { total: number; count: number }> = {};

  for (const p of posts) {
    const d = new Date(p.timestamp);
    const hour = d.getUTCHours();
    const day = d.getUTCDay();
    const key = `${day}-${hour}`;
    const eng = p.engagement;

    if (!hourDayMap[key]) hourDayMap[key] = { total: 0, count: 0 };
    hourDayMap[key].total += eng;
    hourDayMap[key].count += 1;

    if (!hourMap[hour]) hourMap[hour] = { total: 0, count: 0 };
    hourMap[hour].total += eng;
    hourMap[hour].count += 1;

    if (!dayMap[day]) dayMap[day] = { total: 0, count: 0 };
    dayMap[day].total += eng;
    dayMap[day].count += 1;
  }

  const heatmap = Object.entries(hourDayMap).map(([key, v]) => {
    const [d, h] = key.split('-').map(Number);
    return { day: d, hour: h, avg: Math.round(v.total / v.count) };
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const bestHours = Object.entries(hourMap)
    .map(([h, v]) => ({ hour: +h, avgEng: Math.round(v.total / v.count) }))
    .sort((a, b) => b.avgEng - a.avgEng)
    .slice(0, 5);

  const bestDays = Object.entries(dayMap)
    .map(([d, v]) => ({ day: dayNames[+d], avgEng: Math.round(v.total / v.count) }))
    .sort((a, b) => b.avgEng - a.avgEng);

  return { heatmap, bestHours, bestDays };
}

export function computeHashtags(posts: InstagramMedia[]) {
  const counts: Record<string, number> = {};
  for (const p of posts) {
    const tags = (p.caption || '').match(/#[\w]+/g) || [];
    for (const t of tags) {
      const lower = t.toLowerCase();
      counts[lower] = (counts[lower] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));
}

export function computeFormatBreakdown(posts: PostInsight[]) {
  const breakdown: Record<string, { count: number; totalReach: number; totalSaves: number; totalShares: number; totalEng: number }> = {};
  for (const p of posts) {
    if (!breakdown[p.mediaType]) breakdown[p.mediaType] = { count: 0, totalReach: 0, totalSaves: 0, totalShares: 0, totalEng: 0 };
    breakdown[p.mediaType].count += 1;
    breakdown[p.mediaType].totalReach += p.reach;
    breakdown[p.mediaType].totalSaves += p.saved;
    breakdown[p.mediaType].totalShares += p.shares;
    breakdown[p.mediaType].totalEng += p.engagement;
  }
  const result: ContentPerformance['formatBreakdown'] = {};
  for (const [type, v] of Object.entries(breakdown)) {
    result[type] = {
      count: v.count,
      avgReach: Math.round(v.totalReach / v.count),
      avgSaves: Math.round(v.totalSaves / v.count),
      avgShares: Math.round(v.totalShares / v.count),
      avgEngagement: Math.round(v.totalEng / v.count),
    };
  }
  return result;
}

export function computeGrowthTrend(posts: PostInsight[]): number {
  const half = Math.floor(posts.length / 2);
  if (half === 0) return 0;
  const recentAvg = posts.slice(0, half).reduce((s, p) => s + p.engagement, 0) / half;
  const olderAvg = posts.slice(half).reduce((s, p) => s + p.engagement, 0) / (posts.length - half);
  return olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;
}

// ── Phase 6: Audience Portrait (Claude) ────────────────────────────────────

export async function analyseAudiencePortrait(
  demographics: AudienceDemographics,
  profile: InstagramProfile,
  postInsights: PostInsight[],
  apiKey: string,
): Promise<AudiencePortrait> {
  const fallback: AudiencePortrait = {
    narrative: 'Audience data not yet available. Requires a business account with 100+ followers.',
    primaryDemographic: { ageRange: 'unknown', gender: 'unknown', topCities: [], topCountries: [] },
    personas: [],
  };

  const hasDemo = Object.keys(demographics?.ageBuckets || {}).length > 0;

  // Build context from whatever data we have
  const avgLikes = Math.round(postInsights.reduce((s, p) => s + p.likes, 0) / (postInsights.length || 1));
  const avgComments = Math.round(postInsights.reduce((s, p) => s + p.comments, 0) / (postInsights.length || 1));
  const captionSample = postInsights.slice(0, 5).map(p => p.caption).filter(Boolean).join(' | ');

  try {
    const client = new Anthropic({ apiKey });

    const demoContext = hasDemo
      ? `Demographic data available:
Age distribution: ${JSON.stringify(demographics?.ageBuckets || {})}
Gender: Male ${demographics?.genderSplit?.male || 0}%, Female ${demographics?.genderSplit?.female || 0}%
Top cities: ${(demographics?.topCities || []).map((c: any) => `${c.city} (${c.pct}%)`).join(', ') || 'none'}
Top countries: ${(demographics?.topCountries || []).map((c: any) => `${c.country} (${c.pct}%)`).join(', ') || 'none'}`
      : `No Instagram demographic API data — infer the audience from the brand's identity, content themes, bio, and engagement patterns below.`;

    // Pull identity signals for richer context
    const id = (profile as any);
    const identityContext = postInsights.length > 0
      ? `Content themes from recent posts: ${captionSample.slice(0, 400)}
Avg likes/post: ${avgLikes}, Avg comments/post: ${avgComments}
Engagement pattern: ${avgLikes > 50 ? 'strong' : avgLikes > 20 ? 'moderate' : 'growing'} engagement`
      : '';

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are a brand strategist. Analyse this Instagram account and describe who their audience is. Be specific and insightful — don't give generic answers. Return ONLY valid JSON, no markdown wrapping.

Account: @${profile.username} — ${profile.name || ''} (${profile.followers_count || 0} followers)
Bio: ${profile.biography || 'none'}

${demoContext}

${identityContext}

Return:
{
  "narrative": "2-3 sentence audience portrait. Be specific about WHO these people are, what motivates them, and why they follow this brand.",
  "primaryDemographic": { "ageRange": "e.g. 18-34", "gender": "e.g. predominantly male", "topCities": ["city1","city2"], "topCountries": ["country1"] },
  "personas": [
    { "name": "a descriptive persona name", "description": "1-2 sentence behavioral description of this audience segment" },
    { "name": "a descriptive persona name", "description": "1-2 sentence behavioral description of this audience segment" }
  ]
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

// ── Phase 7: Content Performance Matrix (Claude) ───────────────────────────

export async function analyseContentMatrix(
  postInsights: PostInsight[],
  profile: InstagramProfile,
  formatBreakdown: ContentPerformance['formatBreakdown'],
  apiKey: string,
): Promise<Pick<ContentPerformance, 'contentArchetypes' | 'reachDrivers' | 'saveDrivers' | 'shareDrivers'>> {
  const fallback = { contentArchetypes: [], reachDrivers: '', saveDrivers: '', shareDrivers: '' };
  if (postInsights.length < 3) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    // Use reach/saves if available, fall back to likes/comments
    const hasInsights = postInsights.some(p => p.reach > 0 || p.saved > 0);
    const postSummary = postInsights
      .slice(0, 15)
      .map((p, i) => {
        if (hasInsights) {
          return `${i + 1}. [${p.mediaType}] reach=${p.reach} saves=${p.saved} shares=${p.shares} eng=${p.engagement} — "${p.caption.slice(0, 120)}"`;
        }
        return `${i + 1}. [${p.mediaType}] likes=${p.likes} comments=${p.comments} eng=${p.engagement} — "${p.caption.slice(0, 120)}"`;
      })
      .join('\n');

    const metricsNote = hasInsights
      ? 'Metrics include reach, saves, and shares from Instagram Insights.'
      : 'Only likes and comments are available (personal account). Infer reach/save/share potential from content themes and engagement patterns.';

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Analyse this brand's content performance. ${metricsNote} Return ONLY valid JSON.

@${profile.username} — ${profile.followers_count} followers
Format breakdown: ${JSON.stringify(formatBreakdown)}

Post performance (sorted by engagement):
${postSummary}

Return:
{
  "contentArchetypes": [
    { "archetype": "name", "description": "what this type of content is", "avgReach": 0, "avgSaves": 0, "bestFormat": "REEL|IMAGE|CAROUSEL", "examplePostIds": [] }
  ],
  "reachDrivers": "1-2 sentences on what content likely drives discovery",
  "saveDrivers": "1-2 sentences on what content people would bookmark",
  "shareDrivers": "1-2 sentences on what content is most shareable"
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

// ── Phase 8: Strategic Positioning (Claude) ────────────────────────────────

export async function analyseStrategicPositioning(
  profile: InstagramProfile,
  identity: Record<string, unknown>,
  audiencePortrait: AudiencePortrait,
  contentMatrix: Pick<ContentPerformance, 'contentArchetypes' | 'reachDrivers' | 'saveDrivers' | 'shareDrivers'>,
  competitorSummary: string,
  engagementRate: number,
  growthTrend: number,
  topHashtags: Array<{ tag: string; count: number }>,
  apiKey: string,
): Promise<StrategicPositioning> {
  const fallback: StrategicPositioning = {
    brandDirection: 'Not enough data for strategic analysis.',
    contentPillars: [],
    voiceGuidelines: '',
    competitiveGaps: '',
    bigBet: '',
    quickWins: [],
  };

  try {
    const client = new Anthropic({ apiKey });
    const id = identity as any;

    // Build a rich identity context from the full graph
    const identityLines: string[] = [];
    if (id.aesthetic) identityLines.push(`Aesthetic: ${id.aesthetic}`);
    if (id.lifestyle) identityLines.push(`Lifestyle: ${id.lifestyle}`);
    if (id.interests?.length) identityLines.push(`Interests: ${id.interests.join(', ')}`);
    if (id.brandVibes?.length) identityLines.push(`Brand vibes: ${id.brandVibes.join(', ')}`);
    if (id.captionIntent) identityLines.push(`Caption intent: ${id.captionIntent}`);
    if (id.musicVibe) identityLines.push(`Music vibe: ${id.musicVibe}`);
    if (id.foodVibe) identityLines.push(`Food vibe: ${id.foodVibe}`);
    if (id.travelStyle) identityLines.push(`Travel style: ${id.travelStyle}`);
    if (id.personality) identityLines.push(`Personality: expressive=${id.personality.expressive}, humor=${id.personality.humor}, introspective=${id.personality.introspective}`);
    if (id.igPostingCadence) identityLines.push(`Posting cadence: ${id.igPostingCadence}`);
    if (id.igCreatorTier) identityLines.push(`Creator tier: ${id.igCreatorTier}`);
    if (id.rawSummary) identityLines.push(`AI summary: ${id.rawSummary.slice(0, 400)}`);

    // Visual identity
    if (id.visual) {
      const v = id.visual;
      if (v.aesthetic) identityLines.push(`Visual: brightness=${v.aesthetic.brightness}, tone=${v.aesthetic.tone}, composition=${v.aesthetic.composition}`);
      if (v.colorPalette?.length) identityLines.push(`Color palette: ${v.colorPalette.join(', ')}`);
      if (v.sceneCategories) identityLines.push(`Scene categories: ${Object.entries(v.sceneCategories).map(([k,v]) => `${k}(${v})`).join(', ')}`);
      if (v.indoorOutdoorRatio) identityLines.push(`Indoor/outdoor: ${v.indoorOutdoorRatio}`);
    }

    // Bio signals
    if (id.bioRoles?.length) identityLines.push(`Bio roles: ${id.bioRoles.join(', ')}`);
    if (id.bioKeywords?.length) identityLines.push(`Bio keywords: ${id.bioKeywords.join(', ')}`);

    // Temporal
    if (id.temporal) {
      identityLines.push(`Activity pattern: ${id.temporal.activityPattern}, peak days: ${id.temporal.peakDays?.join(', ')}, consistency: ${id.temporal.consistency}`);
    }

    // Engagement
    if (id.engagement) {
      identityLines.push(`Engagement tier: ${id.engagement.engagementTier}, top content type: ${id.engagement.topContentType}, visibility: ${id.engagement.socialVisibility}`);
    }

    // Comment graph
    if (id.commentGraph) {
      identityLines.push(`Community: density=${id.commentGraph.circleDensity}, tone=${id.commentGraph.communityTone}`);
      if (id.commentGraph.externalPerception?.length) identityLines.push(`External perception: ${id.commentGraph.externalPerception.join(', ')}`);
    }

    const identityBlock = identityLines.join('\n');

    const contentDrivers = contentMatrix.reachDrivers
      ? `Content performance insights:\n- Reach drivers: ${contentMatrix.reachDrivers}\n- Save drivers: ${contentMatrix.saveDrivers}\n- Share drivers: ${contentMatrix.shareDrivers}`
      : '';

    const audienceStr = audiencePortrait.narrative && !audiencePortrait.narrative.includes('not yet available')
      ? `Audience portrait: ${audiencePortrait.narrative}`
      : '';

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are a senior brand strategist with deep experience in Instagram growth and positioning. You have complete access to this brand's identity graph. Synthesise ALL signals below into a sharp, actionable strategic direction. Be specific and bold — no generic advice. Return ONLY valid JSON, no markdown wrapping.

=== BRAND PROFILE ===
Account: @${profile.username} — ${profile.name || ''} (${profile.followers_count} followers)
Bio: ${profile.biography || 'none'}
Engagement rate: ${engagementRate}%
Growth trend: ${growthTrend > 0 ? '+' : ''}${growthTrend}%
Posts per week: ~${topHashtags.length > 0 ? 'active' : 'low activity'}

=== FULL IDENTITY GRAPH ===
${identityBlock}

=== AUDIENCE ===
${audienceStr || 'Infer audience from identity signals, content themes, and engagement patterns above.'}

=== CONTENT PERFORMANCE ===
${contentDrivers || 'Use the identity graph and engagement data to infer what content works.'}
Top hashtags: ${topHashtags.slice(0, 10).map(h => `${h.tag}(${h.count}x)`).join(', ') || 'none found'}

=== COMPETITIVE LANDSCAPE ===
${competitorSummary || 'No competitors tracked yet — provide general positioning advice for this niche.'}

Return this exact JSON structure with detailed, specific answers:
{
  "brandDirection": "2-3 sentences: What is this brand's unique positioning? What should they own in their niche? How should they be perceived?",
  "contentPillars": ["4 specific content pillars based on their identity and audience"],
  "voiceGuidelines": "2-3 sentences: What tone, vocabulary, and caption structure fits this brand? Be specific to their personality.",
  "competitiveGaps": "1-2 sentences: What opportunities exist in their niche that they could own?",
  "bigBet": "2-3 sentences: One bold, specific strategic recommendation that could 10x their growth. Not generic advice — something unique to THIS brand.",
  "quickWins": ["3 specific, actionable things they can do THIS WEEK to improve"]
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[Brand Intelligence] Strategic positioning failed:', e);
    return fallback;
  }
}

// ── Full pipeline orchestrator ─────────────────────────────────────────────

export async function runBrandIntelligence(
  igUserId: string,
  token: string,
  apiKey: string,
  competitorSummary?: string,
): Promise<BrandIntelligenceResult> {
  console.log(`[Brand Intelligence] Starting full analysis for ${igUserId}`);

  // Phase 1: Fetch all data in parallel
  const [profile, media] = await Promise.all([
    fetchInstagramProfile(token),
    fetchInstagramMedia(token, 25),
  ]);

  const [accountInsights, demographics, postInsights] = await Promise.all([
    fetchAccountInsights(igUserId, token),
    fetchDemographics(igUserId, token),
    fetchPostInsights(media, token),
  ]);

  // Phase 2-5: Run existing identity pipeline
  const identity = await analyseInstagramIdentity(profile, media, token);

  // Compute deterministic metrics
  const { heatmap, bestHours, bestDays } = computePostingHeatmap(postInsights);
  const topHashtags = computeHashtags(media);
  const formatBreakdown = computeFormatBreakdown(postInsights);
  const growthTrend = computeGrowthTrend(postInsights);

  const totalEng = postInsights.reduce((s, p) => s + p.engagement, 0);
  const avgPerPost = postInsights.length ? Math.round(totalEng / postInsights.length) : 0;
  const engagementRate = profile.followers_count
    ? +((totalEng / postInsights.length) / profile.followers_count * 100).toFixed(2)
    : 0;

  let postsPerWeek = 0;
  if (media.length >= 2) {
    const newest = new Date(media[0].timestamp).getTime();
    const oldest = new Date(media[media.length - 1].timestamp).getTime();
    const daySpan = (newest - oldest) / (1000 * 60 * 60 * 24);
    postsPerWeek = daySpan > 0 ? Math.round((media.length / daySpan) * 7 * 10) / 10 : 0;
  }

  // Phases 6-8: Claude analyses (sequential — each builds on previous)
  const audiencePortrait = await analyseAudiencePortrait(demographics, profile, postInsights, apiKey);

  const contentMatrixResult = await analyseContentMatrix(postInsights, profile, formatBreakdown, apiKey);

  const contentPerformance: ContentPerformance = {
    formatBreakdown,
    topPostIds: [...postInsights].sort((a, b) => b.engagement - a.engagement).slice(0, 3).map(p => p.mediaId),
    bottomPostIds: [...postInsights].sort((a, b) => a.engagement - b.engagement).slice(0, 3).map(p => p.mediaId),
    ...contentMatrixResult,
  };

  const strategicPositioning = await analyseStrategicPositioning(
    profile,
    identity as unknown as Record<string, unknown>,
    audiencePortrait,
    contentMatrixResult,
    competitorSummary || '',
    engagementRate,
    growthTrend,
    topHashtags,
    apiKey,
  );

  console.log(`[Brand Intelligence] Analysis complete for @${profile.username}`);

  return {
    profile,
    postInsights,
    accountInsights,
    demographics,
    contentPerformance,
    audiencePortrait,
    strategicPositioning,
    identity: identity as unknown as Record<string, unknown>,
    postingHeatmap: heatmap,
    bestHours,
    bestDays,
    topHashtags,
    engagementRate,
    avgPerPost,
    postsPerWeek,
    growthTrend,
  };
}
