// src/lib/server/brandCompetitors.ts
//
// Competitor analysis: fetch public profile + posts,
// run lightweight Claude analysis, build competitive matrix.

import Anthropic from '@anthropic-ai/sdk';

export interface CompetitorProfile {
  username: string;
  name: string;
  biography: string;
  followers: number;
  mediaCount: number;
  profilePicture: string;
}

export interface CompetitorAnalysis {
  username: string;
  followers: number;
  engagementRate: number;
  postsPerWeek: number;
  aesthetic: string;
  contentThemes: string[];
  hashtagStrategy: string[];
  formatMix: Record<string, number>; // e.g. { REEL: 40, IMAGE: 35, CAROUSEL: 25 }
  summary: string;
}

export interface CompetitiveMatrix {
  competitors: CompetitorAnalysis[];
  overlaps: string;
  gaps: string;
  positioning: string;
}

/**
 * Fetch a public Instagram profile by user ID.
 * Note: discovering user IDs from usernames requires the Facebook Business API
 * or ig_username search. For now, if we only have a username, we store it
 * and resolve the ID on first analysis via the brand's token.
 */
export async function fetchCompetitorData(
  competitorIgId: string,
  brandToken: string,
): Promise<{ profile: CompetitorProfile; posts: Array<{ caption: string; mediaType: string; timestamp: string; likes: number; comments: number }> } | null> {
  try {
    // Fetch profile
    const profileRes = await fetch(
      `https://graph.instagram.com/v25.0/${competitorIgId}?fields=id,username,name,biography,profile_picture_url,followers_count,media_count&access_token=${brandToken}`,
    );
    if (!profileRes.ok) return null;
    const p = await profileRes.json();

    // Fetch recent posts
    const mediaRes = await fetch(
      `https://graph.instagram.com/v25.0/${competitorIgId}/media?fields=caption,media_type,timestamp,like_count,comments_count&limit=12&access_token=${brandToken}`,
    );
    const mediaData = mediaRes.ok ? await mediaRes.json() : { data: [] };

    return {
      profile: {
        username: p.username || '',
        name: p.name || '',
        biography: p.biography || '',
        followers: p.followers_count || 0,
        mediaCount: p.media_count || 0,
        profilePicture: p.profile_picture_url || '',
      },
      posts: (mediaData.data || []).map((m: any) => ({
        caption: (m.caption || '').slice(0, 200),
        mediaType: m.media_type || 'IMAGE',
        timestamp: m.timestamp || '',
        likes: m.like_count || 0,
        comments: m.comments_count || 0,
      })),
    };
  } catch {
    return null;
  }
}

export async function analyseCompetitor(
  data: NonNullable<Awaited<ReturnType<typeof fetchCompetitorData>>>,
  apiKey: string,
): Promise<CompetitorAnalysis> {
  const { profile, posts } = data;

  // Deterministic metrics
  const totalEng = posts.reduce((s, p) => s + p.likes + p.comments, 0);
  const engagementRate = profile.followers > 0 && posts.length > 0
    ? +((totalEng / posts.length) / profile.followers * 100).toFixed(2)
    : 0;

  let postsPerWeek = 0;
  if (posts.length >= 2) {
    const newest = new Date(posts[0].timestamp).getTime();
    const oldest = new Date(posts[posts.length - 1].timestamp).getTime();
    const daySpan = (newest - oldest) / (1000 * 60 * 60 * 24);
    postsPerWeek = daySpan > 0 ? Math.round((posts.length / daySpan) * 7 * 10) / 10 : 0;
  }

  const formatCounts: Record<string, number> = {};
  for (const p of posts) {
    formatCounts[p.mediaType] = (formatCounts[p.mediaType] || 0) + 1;
  }
  const formatMix: Record<string, number> = {};
  for (const [type, count] of Object.entries(formatCounts)) {
    formatMix[type] = Math.round((count / posts.length) * 100);
  }

  // Claude analysis
  let aesthetic = 'unknown';
  let contentThemes: string[] = [];
  let hashtagStrategy: string[] = [];
  let summary = '';

  try {
    const client = new Anthropic({ apiKey });
    const captionSample = posts.slice(0, 6).map((p, i) =>
      `${i + 1}. [${p.mediaType}] ${p.likes} likes — "${p.caption}"`
    ).join('\n');

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Briefly analyse this Instagram competitor. Return ONLY valid JSON.

@${profile.username} — ${profile.name} (${profile.followers} followers)
Bio: ${profile.biography}
Engagement rate: ${engagementRate}%
Format mix: ${JSON.stringify(formatMix)}

Captions:
${captionSample}

Return:
{
  "aesthetic": "one word (minimal/bold/playful/editorial/raw/polished)",
  "contentThemes": ["theme1", "theme2", "theme3"],
  "hashtagStrategy": ["top hashtag pattern 1", "pattern 2"],
  "summary": "2 sentence competitive summary"
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    aesthetic = parsed.aesthetic || aesthetic;
    contentThemes = parsed.contentThemes || contentThemes;
    hashtagStrategy = parsed.hashtagStrategy || hashtagStrategy;
    summary = parsed.summary || summary;
  } catch {}

  return {
    username: profile.username,
    followers: profile.followers,
    engagementRate,
    postsPerWeek,
    aesthetic,
    contentThemes,
    hashtagStrategy,
    formatMix,
    summary,
  };
}

export async function buildCompetitiveMatrix(
  brandProfile: { username: string; followers_count: number; engagement_rate: number },
  competitors: CompetitorAnalysis[],
  apiKey: string,
): Promise<CompetitiveMatrix> {
  const matrix: CompetitiveMatrix = {
    competitors,
    overlaps: '',
    gaps: '',
    positioning: '',
  };

  if (competitors.length === 0) return matrix;

  try {
    const client = new Anthropic({ apiKey });
    const compSummary = competitors.map(c =>
      `@${c.username}: ${c.followers} followers, ${c.engagementRate}% eng, aesthetic=${c.aesthetic}, themes=${c.contentThemes.join('/')}`
    ).join('\n');

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Compare this brand against its competitors. Return ONLY valid JSON.

Brand: @${brandProfile.username} (${brandProfile.followers_count} followers, ${brandProfile.engagement_rate}% engagement)

Competitors:
${compSummary}

Return:
{
  "overlaps": "1-2 sentences on where the brand and competitors overlap in content/audience",
  "gaps": "1-2 sentences on niches or formats competitors aren't covering that the brand could own",
  "positioning": "2-3 sentences on how the brand should position against these competitors"
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    matrix.overlaps = parsed.overlaps || '';
    matrix.gaps = parsed.gaps || '';
    matrix.positioning = parsed.positioning || '';
  } catch {}

  return matrix;
}
