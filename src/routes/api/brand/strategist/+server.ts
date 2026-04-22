import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import Anthropic from '@anthropic-ai/sdk';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw error(500, 'Supabase not configured');

  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(igUserId)}&select=ig_access_token,ig_username,ig_name,ig_profile_picture,ig_followers_count,brand_identity,identity_updated_at&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const brands = await brandRes.json();
  if (!brands.length) throw error(404, 'Brand not found');
  const brand = brands[0];
  const token = brand.ig_access_token;

  const profileRes = await fetch(
    `https://graph.instagram.com/v25.0/me?fields=id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count&access_token=${token}`,
  );
  const profile = profileRes.ok ? await profileRes.json() : {};

  const mediaRes = await fetch(
    `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink,thumbnail_url,media_url&limit=25&access_token=${token}`,
  );
  const mediaJson = mediaRes.ok ? await mediaRes.json() : { data: [] };
  const posts = (mediaJson.data || []) as Array<{
    id: string; caption?: string; media_type: string; timestamp: string;
    like_count?: number; comments_count?: number; permalink?: string;
    thumbnail_url?: string; media_url?: string;
  }>;

  let totalLikes = 0, totalComments = 0;
  const postMetrics: Array<{
    id: string; type: string; timestamp: string; likes: number;
    comments: number; engagement: number; caption: string;
    permalink: string; thumbnail: string;
  }> = [];

  for (const p of posts) {
    const likes = p.like_count || 0;
    const comments = p.comments_count || 0;
    totalLikes += likes;
    totalComments += comments;
    postMetrics.push({
      id: p.id,
      type: p.media_type,
      timestamp: p.timestamp,
      likes,
      comments,
      engagement: likes + comments,
      caption: (p.caption || '').slice(0, 200),
      permalink: p.permalink || '',
      thumbnail: p.thumbnail_url || p.media_url || '',
    });
  }

  const avgEngagement = posts.length ? Math.round((totalLikes + totalComments) / posts.length) : 0;
  const engagementRate = profile.followers_count
    ? +((totalLikes + totalComments) / posts.length / profile.followers_count * 100).toFixed(2)
    : 0;

  const hourDayMap: Record<string, { total: number; count: number }> = {};
  const hourMap: Record<number, { total: number; count: number }> = {};
  const dayMap: Record<number, { total: number; count: number }> = {};

  for (const p of postMetrics) {
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

  const bestHours = Object.entries(hourMap)
    .map(([h, v]) => ({ hour: +h, avgEng: Math.round(v.total / v.count) }))
    .sort((a, b) => b.avgEng - a.avgEng)
    .slice(0, 5);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const bestDays = Object.entries(dayMap)
    .map(([d, v]) => ({ day: dayNames[+d], avgEng: Math.round(v.total / v.count) }))
    .sort((a, b) => b.avgEng - a.avgEng);

  const heatmap: Array<{ day: number; hour: number; avg: number }> = [];
  for (const [key, v] of Object.entries(hourDayMap)) {
    const [d, h] = key.split('-').map(Number);
    heatmap.push({ day: d, hour: h, avg: Math.round(v.total / v.count) });
  }

  let postsPerWeek = 0;
  if (posts.length >= 2) {
    const newest = new Date(posts[0].timestamp).getTime();
    const oldest = new Date(posts[posts.length - 1].timestamp).getTime();
    const daySpan = (newest - oldest) / (1000 * 60 * 60 * 24);
    postsPerWeek = daySpan > 0 ? Math.round((posts.length / daySpan) * 7 * 10) / 10 : 0;
  }

  const typeBreakdown: Record<string, { count: number; totalEng: number }> = {};
  for (const p of postMetrics) {
    if (!typeBreakdown[p.type]) typeBreakdown[p.type] = { count: 0, totalEng: 0 };
    typeBreakdown[p.type].count += 1;
    typeBreakdown[p.type].totalEng += p.engagement;
  }
  const contentTypes = Object.entries(typeBreakdown)
    .map(([type, v]) => ({ type, count: v.count, avgEng: Math.round(v.totalEng / v.count) }))
    .sort((a, b) => b.avgEng - a.avgEng);

  const sorted = [...postMetrics].sort((a, b) => b.engagement - a.engagement);
  const topPosts = sorted.slice(0, 3);
  const bottomPosts = sorted.slice(-3).reverse();

  const half = Math.floor(postMetrics.length / 2);
  const recentHalf = postMetrics.slice(0, half);
  const olderHalf = postMetrics.slice(half);
  const recentAvg = recentHalf.length
    ? recentHalf.reduce((s, p) => s + p.engagement, 0) / recentHalf.length
    : 0;
  const olderAvg = olderHalf.length
    ? olderHalf.reduce((s, p) => s + p.engagement, 0) / olderHalf.length
    : 0;
  const growthTrend = olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;

  const hashtagCounts: Record<string, number> = {};
  for (const p of posts) {
    const tags = (p.caption || '').match(/#[\w]+/g) || [];
    for (const t of tags) {
      const lower = t.toLowerCase();
      hashtagCounts[lower] = (hashtagCounts[lower] || 0) + 1;
    }
  }
  const topHashtags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const brandIdentity = brand.brand_identity || null;

  let strategy: {
    brandDirection: string;
    audienceSummary: string;
    contentPillars: string[];
    contentIdeas: Array<{ title: string; format: string; hook: string; why: string }>;
    captionStyle: string;
    competitiveEdge: string;
    quickWins: string[];
  } | null = null;

  const anthropicKey = env.ANTHROPIC_API_KEY;
  if (anthropicKey && posts.length >= 3) {
    try {
      const client = new Anthropic({ apiKey: anthropicKey });
      const captionSample = posts
        .filter(p => p.caption)
        .slice(0, 8)
        .map((p, i) => `Post ${i + 1} (${p.media_type}, ${p.like_count} likes): ${(p.caption || '').slice(0, 300)}`)
        .join('\n');

      const identityContext = brandIdentity
        ? `Brand identity signals: aesthetic=${brandIdentity.aesthetic || '?'}, lifestyle=${brandIdentity.lifestyle || '?'}, interests=${(brandIdentity.interests || []).join(', ')}, brandVibes=${(brandIdentity.brandVibes || []).join(', ')}, captionIntent=${brandIdentity.captionIntent || '?'}, personality=${JSON.stringify(brandIdentity.personality || {})}`
        : 'No prior brand identity extraction available.';

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `You are a brand strategist analysing an Instagram account. Return ONLY valid JSON, no markdown.

Account: @${profile.username || brand.ig_username} — ${profile.name || brand.ig_name}
Bio: ${profile.biography || 'none'}
Followers: ${profile.followers_count || brand.ig_followers_count}
Engagement rate: ${engagementRate}%
Posts/week: ${postsPerWeek}
Best content type: ${contentTypes[0]?.type || 'unknown'}
Growth trend: ${growthTrend > 0 ? '+' : ''}${growthTrend}%
Top hashtags: ${topHashtags.slice(0, 6).map(h => h.tag).join(', ')}
${identityContext}

Recent captions:
${captionSample}

Return this exact JSON structure:
{
  "brandDirection": "2-3 sentence strategic positioning recommendation for this brand",
  "audienceSummary": "1-2 sentences describing who their audience likely is based on content + engagement patterns",
  "contentPillars": ["pillar1", "pillar2", "pillar3", "pillar4"],
  "contentIdeas": [
    {"title": "idea title", "format": "REEL|IMAGE|CAROUSEL", "hook": "opening hook line", "why": "why this will work for their audience"},
    {"title": "idea title", "format": "REEL|IMAGE|CAROUSEL", "hook": "opening hook line", "why": "why this will work"},
    {"title": "idea title", "format": "REEL|IMAGE|CAROUSEL", "hook": "opening hook line", "why": "why this will work"},
    {"title": "idea title", "format": "REEL|IMAGE|CAROUSEL", "hook": "opening hook line", "why": "why this will work"},
    {"title": "idea title", "format": "REEL|IMAGE|CAROUSEL", "hook": "opening hook line", "why": "why this will work"}
  ],
  "captionStyle": "1-2 sentence recommendation for caption voice and tone",
  "competitiveEdge": "1-2 sentences on what makes this brand's content unique or what they should lean into",
  "quickWins": ["quick win 1", "quick win 2", "quick win 3"]
}`
        }]
      });

      const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
      strategy = JSON.parse(text);
    } catch {
      // Claude analysis failed — dashboard still works without it
    }
  }

  const scheduledRes = await fetch(
    `${supabaseUrl}/rest/v1/scheduled_posts?brand_ig_id=eq.${encodeURIComponent(igUserId)}&select=status`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const scheduledPosts = scheduledRes.ok ? await scheduledRes.json() : [];

  return json({
    ok: true,
    profile: {
      username: profile.username || brand.ig_username,
      name: profile.name || brand.ig_name,
      biography: profile.biography || '',
      profilePicture: profile.profile_picture_url || brand.ig_profile_picture,
      followersCount: profile.followers_count || brand.ig_followers_count || 0,
      followingCount: profile.follows_count || 0,
      mediaCount: profile.media_count || 0,
    },
    engagement: {
      rate: engagementRate,
      avgPerPost: avgEngagement,
      totalLikes,
      totalComments,
      postsPerWeek,
      growthTrend,
    },
    postingTimes: {
      bestHours,
      bestDays,
      heatmap,
    },
    contentTypes,
    topPosts,
    bottomPosts,
    topHashtags,
    strategy,
    brandIdentity,
    scheduling: {
      scheduled: scheduledPosts.filter((p: { status: string }) => p.status === 'scheduled').length,
      published: scheduledPosts.filter((p: { status: string }) => p.status === 'published').length,
    },
  });
};
