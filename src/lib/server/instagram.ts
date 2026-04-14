/**
 * Instagram API with Instagram Login helpers.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 *
 * Setup:
 *  1. Create a Facebook App at https://developers.facebook.com/apps/
 *  2. Add the "Instagram" product → "Instagram API with Instagram Login"
 *  3. Set redirect URI to: {PUBLIC_BASE_URL}/auth/instagram/callback
 *  4. Copy App ID → INSTAGRAM_APP_ID, App Secret → INSTAGRAM_APP_SECRET
 *  5. During development, add yourself as a Test User in the app dashboard
 *
 * Note: Only works with Instagram business or creator accounts (not personal).
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  INSTAGRAM_APP_ID,
  INSTAGRAM_APP_SECRET,
  ANTHROPIC_API_KEY,
} from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const REDIRECT_URI = `${PUBLIC_BASE_URL}/auth/instagram/callback`;

// ── OAuth URLs ─────────────────────────────────────────────────────────────

export function getInstagramAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'instagram_business_basic,instagram_business_manage_insights',
    response_type: 'code',
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

// ── Token exchange ─────────────────────────────────────────────────────────

export async function exchangeCodeForToken(code: string): Promise<string> {
  console.log('[IG Token] Exchanging code, redirect_uri:', REDIRECT_URI);

  const body = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    client_secret: INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code,
  });

  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[IG Token] Exchange failed:', res.status, err);
    throw new Error(`Instagram token exchange failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const shortLivedToken = data.access_token;
  if (!shortLivedToken) {
    console.error('[IG Token] No access_token in response:', JSON.stringify(data).slice(0, 200));
    throw new Error('Instagram returned no access token');
  }
  console.log('[IG Token] Short-lived token obtained, exchanging for long-lived...');

  const longRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`
  );

  if (!longRes.ok) {
    console.warn('[IG Token] Long-lived exchange failed, using short-lived token');
    return shortLivedToken as string;
  }

  const { access_token: longLivedToken } = await longRes.json();
  console.log('[IG Token] Long-lived token obtained');
  return longLivedToken as string;
}

// ── Data types ──────────────────────────────────────────────────────────────

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: string;
  timestamp: string;
  media_url?: string;
  thumbnail_url?: string;
  like_count?: number;
  comments_count?: number;
  permalink?: string;
}

export interface InstagramProfile {
  id: string;
  username: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
  biography?: string;
}

export interface InstagramComment {
  id: string;
  text: string;
  timestamp: string;
  username: string;
}

// ── Fetch user data (Phase 1: expanded fields) ─────────────────────────────

export async function fetchInstagramProfile(token: string): Promise<InstagramProfile> {
  const fields = 'id,username,name,account_type,profile_picture_url,followers_count,media_count,biography';
  const res = await fetch(
    `https://graph.instagram.com/v25.0/me?fields=${fields}&access_token=${token}`
  );
  if (!res.ok) throw new Error('Failed to fetch Instagram profile');
  return res.json();
}

export async function fetchInstagramMedia(token: string, limit = 100): Promise<InstagramMedia[]> {
  const fields = 'id,caption,media_type,timestamp,media_url,thumbnail_url,like_count,comments_count,permalink';
  const res = await fetch(
    `https://graph.instagram.com/v25.0/me/media?fields=${fields}&limit=${limit}&access_token=${token}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

const CAROUSEL_CHILD_FIELDS = 'id,caption,media_type,timestamp,media_url,thumbnail_url,like_count,comments_count';

/**
 * Expand CAROUSEL_ALBUM items with up to `maxChildrenPerCarousel` child media (capped total `maxCarousels`).
 * Gives vision/caption more signal without exploding API cost.
 */
export async function expandCarouselChildren(
  token: string,
  media: InstagramMedia[],
  maxCarousels = 8,
  maxChildrenPerCarousel = 4,
): Promise<InstagramMedia[]> {
  const carousels = media.filter(m => m.media_type === 'CAROUSEL_ALBUM').slice(0, maxCarousels);
  if (!carousels.length) return media;

  const childLists = await Promise.all(
    carousels.map(async parent => {
      try {
        const res = await fetch(
          `https://graph.instagram.com/v25.0/${parent.id}/children?fields=${CAROUSEL_CHILD_FIELDS}&access_token=${token}`,
        );
        if (!res.ok) return [] as InstagramMedia[];
        const data = await res.json();
        const children: InstagramMedia[] = data.data || [];
        return children.slice(0, maxChildrenPerCarousel).map(ch => ({
          ...ch,
          caption: ch.caption || parent.caption,
        }));
      } catch {
        return [];
      }
    }),
  );

  const merged = [...media];
  for (const kids of childLists) merged.push(...kids);
  return merged;
}

export async function fetchPostComments(
  token: string,
  mediaId: string,
  limit = 10,
): Promise<InstagramComment[]> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${mediaId}/comments?fields=text,timestamp,username&limit=${limit}&access_token=${token}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

async function fetchCommentsForTopPosts(
  token: string,
  media: InstagramMedia[],
  maxPosts = 5,
  commentsPerPost = 15,
): Promise<InstagramComment[]> {
  const sorted = [...media]
    .filter(m => (m.comments_count ?? 0) > 0)
    .sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0))
    .slice(0, maxPosts);

  const results = await Promise.all(
    sorted.map(m => fetchPostComments(token, m.id, commentsPerPost))
  );
  return results.flat().slice(0, 30);
}

// ── Deterministic caption signals (hashtags, cadence) ───────────────────────

const HASHTAG_NOISE = new Set([
  'fyp', 'foryou', 'reels', 'reel', 'instagood', 'instagram', 'explore', 'explorepage', 'viral',
  'trending', 'photooftheday', 'picoftheday', 'love', 'like4like', 'followme', 'follow', 'insta',
  'igdaily', 'ootd', 'vsco', 'shotoniphone',
]);

export type IgPostingCadence = 'active' | 'steady' | 'quiet';
export type IgCreatorTier = 'micro' | 'hobby' | 'private';

export function extractMediaCaptionSignals(media: InstagramMedia[]): {
  topHashtags: string[];
  captionMentions: string[];
  igPostingCadence: IgPostingCadence;
} {
  const tagCounts = new Map<string, number>();
  const mentionOrder: string[] = [];
  const seenM = new Set<string>();

  for (const m of media) {
    const cap = m.caption ?? '';
    for (const match of cap.matchAll(/#([a-zA-Z0-9_]+)/g)) {
      const t = match[1].toLowerCase();
      if (t.length < 2 || HASHTAG_NOISE.has(t)) continue;
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    for (const match of cap.matchAll(/@([a-zA-Z0-9._]+)/g)) {
      const h = match[1].toLowerCase();
      if (h.length < 2 || seenM.has(h)) continue;
      seenM.add(h);
      mentionOrder.push(h);
    }
  }

  const topHashtags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);

  const captionMentions = mentionOrder.slice(0, 3);

  const now = Date.now();
  const ms30 = 30 * 86400000;
  const ms90 = 90 * 86400000;
  let in30 = 0;
  let in90 = 0;
  for (const m of media) {
    const t = new Date(m.timestamp).getTime();
    if (!Number.isFinite(t)) continue;
    if (now - t <= ms30) in30++;
    if (now - t <= ms90) in90++;
  }

  let igPostingCadence: IgPostingCadence;
  if (in30 >= 4 || in90 >= 8) igPostingCadence = 'active';
  else if (in90 >= 2) igPostingCadence = 'steady';
  else igPostingCadence = 'quiet';

  return { topHashtags, captionMentions, igPostingCadence };
}

export function computeIgCreatorTier(
  followers: number | undefined,
  mediaCount: number | undefined,
  cadence: IgPostingCadence,
): IgCreatorTier {
  const f = followers ?? 0;
  const mc = mediaCount ?? 0;
  if (f >= 5000) return 'micro';
  if (f >= 300 || mc >= 10 || cadence === 'active') return 'hobby';
  return 'private';
}

// ── Phase 3A: Bio parsing (deterministic) ──────────────────────────────────

const EMOJI_CATEGORY_MAP: Record<string, string> = {
  '🧘': 'wellness', '🏋': 'fitness', '💪': 'fitness', '🏃': 'fitness',
  '🍣': 'food', '🍕': 'food', '☕': 'coffee', '🍷': 'nightlife', '🍸': 'nightlife',
  '✈': 'travel', '🌍': 'travel', '🏖': 'travel', '⛰': 'travel',
  '📸': 'photography', '🎨': 'art', '🎵': 'music', '🎶': 'music', '🎤': 'music',
  '💻': 'tech', '👨‍💻': 'tech', '📱': 'tech',
  '📚': 'reading', '🎮': 'gaming', '🎬': 'cinema',
  '👗': 'fashion', '👟': 'fashion', '💄': 'beauty',
  '🐶': 'pets', '🐱': 'pets',
  '🏠': 'home', '🌱': 'nature', '🌿': 'wellness',
};

const BIO_ROLE_PATTERNS = [
  'founder', 'ceo', 'cto', 'designer', 'developer', 'engineer', 'photographer',
  'filmmaker', 'artist', 'musician', 'writer', 'blogger', 'influencer', 'creator',
  'student', 'chef', 'coach', 'trainer', 'consultant', 'freelancer', 'entrepreneur',
  'producer', 'dj', 'model', 'journalist', 'marketer', 'strategist',
];

export interface BioSignals {
  keywords: string[];
  roles: string[];
  emojis: string[];
  emojiCategories: string[];
  locationMention?: string;
}

export function parseBio(biography: string | undefined): BioSignals {
  if (!biography?.trim()) return { keywords: [], roles: [], emojis: [], emojiCategories: [] };

  const bio = biography.trim();
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const emojis = [...bio.matchAll(emojiRegex)].map(m => m[0]);

  const emojiCategories = [...new Set(
    emojis.map(e => {
      for (const [prefix, cat] of Object.entries(EMOJI_CATEGORY_MAP)) {
        if (e.startsWith(prefix)) return cat;
      }
      return null;
    }).filter((c): c is string => c !== null)
  )];

  const lower = bio.toLowerCase();
  const roles = BIO_ROLE_PATTERNS.filter(r => {
    const re = new RegExp(`\\b${r}\\b`, 'i');
    return re.test(lower);
  });

  const words = lower
    .replace(/[^\w\s#@]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'from', 'that', 'this'].includes(w));
  const keywords = [...new Set(words)].slice(0, 10);

  const cityPatterns = /(?:📍|based in|from|living in)\s*([A-Z][a-zA-Z\s]{2,20})/i;
  const locationMatch = bio.match(cityPatterns);
  const locationMention = locationMatch?.[1]?.trim();

  return { keywords, roles, emojis, emojiCategories, locationMention };
}

// ── Phase 2: Visual Analysis Engine ────────────────────────────────────────

export interface VisualIdentity {
  sceneCategories: Record<string, number>;
  aesthetic: {
    brightness: 'high' | 'medium' | 'low';
    tone: 'warm' | 'cool' | 'neutral';
    composition: 'minimal' | 'balanced' | 'busy';
    indoorOutdoorRatio: string;
  };
  colorPalette: string[];
  fashionStyle?: string;
  cuisineTypes?: string[];
  locationTypes?: string[];
}

function selectRepresentativeImages(media: InstagramMedia[]): InstagramMedia[] {
  const imageTypes = media.filter(m =>
    m.media_url && (m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM')
  );
  if (imageTypes.length === 0) return [];

  const byLikes = [...imageTypes].sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0));
  const byRecent = [...imageTypes].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const selected = new Map<string, InstagramMedia>();
  for (const m of byLikes.slice(0, 3)) selected.set(m.id, m);
  for (const m of byRecent) {
    if (selected.size >= 6) break;
    if (!selected.has(m.id)) selected.set(m.id, m);
  }
  return [...selected.values()].slice(0, 6);
}

export async function analyseVisualIdentity(media: InstagramMedia[]): Promise<VisualIdentity | null> {
  const selected = selectRepresentativeImages(media);
  if (selected.length < 2) return null;

  console.log(`[IG Visual] Analysing ${selected.length} images...`);

  const imageContent: Anthropic.Messages.ContentBlockParam[] = selected.flatMap((m, i) => [
    { type: 'text' as const, text: `Image ${i + 1} (${m.media_type}, ${m.like_count ?? 0} likes):` },
    { type: 'image' as const, source: { type: 'url' as const, url: m.media_url! } },
  ]);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: `Analyse these Instagram photos to understand this person's visual identity. Return ONLY a JSON object:
{
  "sceneCategories": {"food": N, "travel": N, "fitness": N, "nightlife": N, "cafe": N, "nature": N, "urban": N, "fashion": N, "tech": N, "social": N},
  "aesthetic": {
    "brightness": "high|medium|low",
    "tone": "warm|cool|neutral",
    "composition": "minimal|balanced|busy",
    "indoorOutdoorRatio": "e.g. 60% outdoor"
  },
  "colorPalette": ["3-4 dominant color families, e.g. warm beige, forest green"],
  "fashionStyle": "style description if people visible, else null",
  "cuisineTypes": ["cuisine types if food posts exist, else empty"],
  "locationTypes": ["location types seen, e.g. urban cafes, beaches"]
}
Only include scene categories with count > 0. Be specific and concise.`,
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as VisualIdentity;
    const cleaned: VisualIdentity = {
      sceneCategories: parsed.sceneCategories ?? {},
      aesthetic: {
        brightness: parsed.aesthetic?.brightness ?? 'medium',
        tone: parsed.aesthetic?.tone ?? 'neutral',
        composition: parsed.aesthetic?.composition ?? 'balanced',
        indoorOutdoorRatio: parsed.aesthetic?.indoorOutdoorRatio ?? '50/50',
      },
      colorPalette: (parsed.colorPalette ?? []).slice(0, 4),
      fashionStyle: parsed.fashionStyle || undefined,
      cuisineTypes: (parsed.cuisineTypes ?? []).filter(Boolean),
      locationTypes: (parsed.locationTypes ?? []).filter(Boolean),
    };
    console.log('[IG Visual] Analysis complete:', JSON.stringify(cleaned.sceneCategories));
    return cleaned;
  } catch (e) {
    console.error('[IG Visual] Analysis failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ── Phase 4A: Temporal behavioral analysis ─────────────────────────────────

export interface TemporalProfile {
  activityPattern: 'morning' | 'afternoon' | 'evening' | 'night';
  peakDays: string[];
  consistency: 'daily' | 'weekly' | 'sporadic';
  seasonalTrend?: string;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function analyseTemporalPatterns(media: InstagramMedia[]): TemporalProfile {
  const hourBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const dayBuckets = new Array(7).fill(0);
  const monthBuckets = new Array(12).fill(0);

  for (const m of media) {
    const d = new Date(m.timestamp);
    if (!Number.isFinite(d.getTime())) continue;

    const h = d.getHours();
    if (h >= 6 && h < 12) hourBuckets.morning++;
    else if (h >= 12 && h < 17) hourBuckets.afternoon++;
    else if (h >= 17 && h < 22) hourBuckets.evening++;
    else hourBuckets.night++;

    dayBuckets[d.getDay()]++;
    monthBuckets[d.getMonth()]++;
  }

  const pattern = (Object.entries(hourBuckets) as [TemporalProfile['activityPattern'], number][])
    .sort((a, b) => b[1] - a[1])[0][0];

  const maxDay = Math.max(...dayBuckets);
  const peakDays = dayBuckets
    .map((c, i) => ({ day: DAY_NAMES[i], count: c }))
    .filter(d => d.count >= maxDay * 0.7 && d.count > 0)
    .map(d => d.day);

  const totalPosts = media.length;
  const timestamps = media.map(m => new Date(m.timestamp).getTime()).filter(Number.isFinite);
  let consistency: TemporalProfile['consistency'] = 'sporadic';
  if (timestamps.length >= 2) {
    const span = Math.max(...timestamps) - Math.min(...timestamps);
    const spanDays = span / 86400000;
    const avgPostsPerWeek = spanDays > 7 ? (totalPosts / spanDays) * 7 : totalPosts;
    if (avgPostsPerWeek >= 5) consistency = 'daily';
    else if (avgPostsPerWeek >= 1) consistency = 'weekly';
  }

  const topMonth = monthBuckets.indexOf(Math.max(...monthBuckets));
  const bottomMonth = monthBuckets.indexOf(Math.min(...monthBuckets));
  let seasonalTrend: string | undefined;
  if (Math.max(...monthBuckets) > Math.min(...monthBuckets) * 2 && totalPosts > 8) {
    seasonalTrend = `more active in ${MONTH_NAMES[topMonth]}, quieter in ${MONTH_NAMES[bottomMonth]}`;
  }

  return { activityPattern: pattern, peakDays, consistency, seasonalTrend };
}

// ── Phase 4B: Engagement scoring ───────────────────────────────────────────

export interface EngagementProfile {
  avgLikeRate: number;
  engagementTier: 'high' | 'medium' | 'low';
  topContentType: string;
  socialVisibility: 'public-facing' | 'niche' | 'private';
}

export function analyseEngagement(
  media: InstagramMedia[],
  followersCount: number | undefined,
): EngagementProfile {
  const followers = followersCount ?? 0;
  const withLikes = media.filter(m => m.like_count !== undefined);

  const totalLikes = withLikes.reduce((s, m) => s + (m.like_count ?? 0), 0);
  const avgLikes = withLikes.length > 0 ? totalLikes / withLikes.length : 0;
  const avgLikeRate = followers > 0 ? avgLikes / followers : 0;

  let engagementTier: EngagementProfile['engagementTier'];
  if (avgLikeRate > 0.05) engagementTier = 'high';
  else if (avgLikeRate > 0.02) engagementTier = 'medium';
  else engagementTier = 'low';

  const typeLikes = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  for (const m of withLikes) {
    typeLikes.set(m.media_type, (typeLikes.get(m.media_type) ?? 0) + (m.like_count ?? 0));
    typeCounts.set(m.media_type, (typeCounts.get(m.media_type) ?? 0) + 1);
  }

  let topContentType = 'IMAGE';
  let topAvg = 0;
  for (const [type, total] of typeLikes) {
    const avg = total / (typeCounts.get(type) ?? 1);
    if (avg > topAvg) { topAvg = avg; topContentType = type; }
  }

  let socialVisibility: EngagementProfile['socialVisibility'];
  if (followers >= 1000 && engagementTier !== 'low') socialVisibility = 'public-facing';
  else if (followers >= 200 || engagementTier === 'high') socialVisibility = 'niche';
  else socialVisibility = 'private';

  return { avgLikeRate: Math.round(avgLikeRate * 1000) / 1000, engagementTier, topContentType, socialVisibility };
}

// ── Phase 4C: Comment graph analysis ───────────────────────────────────────

export interface CommentGraphProfile {
  circleDensity: 'tight' | 'mixed' | 'wide';
  externalPerception: string[];
  communityTone: 'supportive' | 'humorous' | 'professional' | 'mixed';
}

export async function analyseCommentGraph(
  comments: InstagramComment[],
): Promise<CommentGraphProfile | null> {
  if (comments.length < 3) return null;

  const usernameCounts = new Map<string, number>();
  for (const c of comments) {
    usernameCounts.set(c.username, (usernameCounts.get(c.username) ?? 0) + 1);
  }

  const uniqueUsers = usernameCounts.size;
  const repeaters = [...usernameCounts.values()].filter(c => c >= 2).length;
  const repeaterRatio = uniqueUsers > 0 ? repeaters / uniqueUsers : 0;

  let circleDensity: CommentGraphProfile['circleDensity'];
  if (repeaterRatio > 0.5) circleDensity = 'tight';
  else if (repeaterRatio > 0.2) circleDensity = 'mixed';
  else circleDensity = 'wide';

  const commentTexts = comments.map(c => `@${c.username}: ${c.text}`).slice(0, 20).join('\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `These are comments on someone's Instagram posts. Analyse what the comments reveal about this person.
Return ONLY JSON:
{
  "externalPerception": ["2-4 identity labels others associate with this person, e.g. foodie, always traveling, party person"],
  "communityTone": "supportive|humorous|professional|mixed"
}

Comments:
${commentTexts}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { circleDensity, externalPerception: [], communityTone: 'mixed' };

    const parsed = JSON.parse(match[0]);
    return {
      circleDensity,
      externalPerception: (parsed.externalPerception ?? []).slice(0, 4),
      communityTone: parsed.communityTone ?? 'mixed',
    };
  } catch (e) {
    console.error('[IG Comments] Analysis failed:', e instanceof Error ? e.message : e);
    return { circleDensity, externalPerception: [], communityTone: 'mixed' };
  }
}

// ── Phase 3B: Enhanced caption + bio Claude analysis ───────────────────────

export interface InstagramIdentity {
  /** Stable Instagram Graph user id (`me.id`) — used as `ig:<id>` account key when Google is absent */
  igUserId?: string;
  username: string;
  displayName?: string;
  profilePicture?: string;
  followersCount?: number;
  mediaCount?: number;
  city: string;
  interests: string[];
  aesthetic: string;
  lifestyle: string;
  brandVibes: string[];
  musicVibe: string;
  foodVibe: string;
  travelStyle: string;
  activityPattern: string;
  rawSummary: string;
  topHashtags?: string[];
  captionMentions?: string[];
  igPostingCadence?: IgPostingCadence;
  igCreatorTier?: IgCreatorTier;

  // NEW: Visual identity (Phase 2)
  visual?: VisualIdentity;

  // NEW: Bio signals (Phase 3A)
  bioKeywords?: string[];
  bioRoles?: string[];
  bioEmojis?: string[];

  // NEW: Personality (Phase 3B)
  personality?: { expressive: number; humor: number; introspective: number };
  captionIntent?: string;

  // NEW: Temporal (Phase 4A)
  temporal?: TemporalProfile;

  // NEW: Engagement (Phase 4B)
  engagement?: EngagementProfile;

  // NEW: Comment graph (Phase 4C)
  commentGraph?: CommentGraphProfile;

  /** Engagement / cadence tags merged from computeInstagramInsights (refresh-signals). */
  igInsightsTags?: string[];
}

async function analyseCaptionsWithClaude(
  profile: InstagramProfile,
  media: InstagramMedia[],
): Promise<{
  username: string;
  city: string;
  interests: string[];
  aesthetic: string;
  lifestyle: string;
  brandVibes: string[];
  musicVibe: string;
  foodVibe: string;
  travelStyle: string;
  activityPattern: string;
  rawSummary: string;
  personality: { expressive: number; humor: number; introspective: number };
  captionIntent: string;
}> {
  const captions = media
    .filter(m => m.caption)
    .map(m => `[${m.media_type}] ${m.caption!.slice(0, 200)}`)
    .join('\n');

  const postCount = media.length;
  const types = media.map(m => m.media_type).join(', ');
  const bioLine = profile.biography ? `Bio: ${profile.biography}` : '';

  // Posting time patterns
  const postingHours: number[] = [];
  const postingDays: number[] = [];
  for (const m of media) {
    if (m.timestamp) {
      const d = new Date(m.timestamp);
      postingHours.push(d.getHours());
      postingDays.push(d.getDay());
    }
  }

  const peakHour = postingHours.length > 0
    ? (() => { const counts: Record<number, number> = {}; postingHours.forEach(h => counts[h] = (counts[h] ?? 0) + 1); return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''; })()
    : '';

  const peakDay = postingDays.length > 0
    ? (() => { const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; const counts: Record<number, number> = {}; postingDays.forEach(d => counts[d] = (counts[d] ?? 0) + 1); const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]; return top ? days[Number(top[0])] : ''; })()
    : '';

  const allHashtags: string[] = [];
  for (const m of media) {
    if (m.caption) {
      const tags = m.caption.match(/#\w+/g) ?? [];
      allHashtags.push(...tags.map(t => t.toLowerCase()));
    }
  }
  const topHashtags = [...new Set(allHashtags)]
    .map(tag => ({ tag, count: allHashtags.filter(t => t === tag).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(t => t.tag);

  const prompt = `You are analysing someone's Instagram to understand their identity, lifestyle, and taste.

Username: @${profile.username}
${bioLine}
Total recent posts analysed: ${postCount}
Post types: ${types}
Peak posting hour: ${peakHour ? peakHour + ':00' : 'unknown'}
Most active day: ${peakDay || 'unknown'}
Top hashtags: ${topHashtags.slice(0, 15).join(', ') || 'none'}
Total posts analyzed: ${media.length}

Post captions (most recent first):
${captions || '(no captions found — infer from context)'}

Return ONLY a JSON object (no markdown, no explanation):
{
  "username": "${profile.username}",
  "city": "city they appear to be based in (infer from location tags, place mentions, bio, or captions — e.g. 'Mumbai', 'Delhi', 'London'. If unclear, use empty string)",
  "interests": ["up to 6 specific interest tags"],
  "aesthetic": "2-4 word aesthetic description",
  "lifestyle": "one sentence describing their lifestyle pattern",
  "brandVibes": ["3-5 brand names that match their vibe"],
  "musicVibe": "short music taste description",
  "foodVibe": "short food/dining taste description",
  "travelStyle": "short travel style description",
  "activityPattern": "when and how they are active socially",
  "rawSummary": "2-3 sentence human summary of who this person is",
  "personality": {
    "expressive": 0.0-1.0,
    "humor": 0.0-1.0,
    "introspective": 0.0-1.0
  },
  "captionIntent": "documenting|flexing|storytelling|sharing|promoting"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

  const fallback = {
    username: profile.username,
    city: '',
    interests: ['lifestyle', 'food', 'music'],
    aesthetic: 'modern minimal',
    lifestyle: 'Active and social',
    brandVibes: [] as string[],
    musicVibe: 'varied',
    foodVibe: 'eclectic',
    travelStyle: 'exploratory',
    activityPattern: 'evenings and weekends',
    rawSummary: `@${profile.username} — identity signals extracted from Instagram.`,
    personality: { expressive: 0.5, humor: 0.5, introspective: 0.5 },
    captionIntent: 'sharing',
  };

  try {
    const parsed = JSON.parse(text);
    return { ...fallback, ...parsed, personality: { ...fallback.personality, ...parsed.personality } };
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return { ...fallback, ...parsed, personality: { ...fallback.personality, ...parsed.personality } };
      } catch { /* fall through */ }
    }
    return fallback;
  }
}

// ── Phase 5: Full identity pipeline ────────────────────────────────────────

export async function analyseInstagramIdentity(
  profile: InstagramProfile,
  media: InstagramMedia[],
  token?: string,
): Promise<InstagramIdentity> {
  console.log(`[IG Identity] Starting full analysis for @${profile.username} (${media.length} posts)`);

  const captionSignals = extractMediaCaptionSignals(media);
  const igCreatorTier = computeIgCreatorTier(
    profile.followers_count,
    profile.media_count,
    captionSignals.igPostingCadence,
  );

  const bioSignals = parseBio(profile.biography);
  const temporal = analyseTemporalPatterns(media);
  const engagement = analyseEngagement(media, profile.followers_count);

  // Run Claude analyses in parallel (visual + captions + comments)
  const [captionResult, visualResult, commentsRaw] = await Promise.all([
    analyseCaptionsWithClaude(profile, media),
    analyseVisualIdentity(media),
    token ? fetchCommentsForTopPosts(token, media) : Promise.resolve([]),
  ]);

  const commentGraph = commentsRaw.length >= 3
    ? await analyseCommentGraph(commentsRaw)
    : null;

  // Use bio location as city fallback
  const city = captionResult.city || bioSignals.locationMention || '';

  // Merge bio-derived interests with Claude-derived ones
  const bioInterests = bioSignals.emojiCategories.filter(
    c => !captionResult.interests.some(i => i.toLowerCase() === c.toLowerCase())
  );
  const mergedInterests = [...captionResult.interests, ...bioInterests].slice(0, 8);

  const identity: InstagramIdentity = {
    ...captionResult,
    city,
    interests: mergedInterests,
    displayName: profile.name,
    profilePicture: profile.profile_picture_url,
    followersCount: profile.followers_count,
    mediaCount: profile.media_count,
    ...captionSignals,
    igCreatorTier,
    visual: visualResult ?? undefined,
    bioKeywords: bioSignals.keywords,
    bioRoles: bioSignals.roles,
    bioEmojis: bioSignals.emojis,
    temporal,
    engagement,
    commentGraph: commentGraph ?? undefined,
    igUserId: profile.id,
  };

  console.log('[IG Identity] Full analysis complete:', {
    aesthetic: identity.aesthetic,
    interests: identity.interests.length,
    hasVisual: !!identity.visual,
    hasCommentGraph: !!identity.commentGraph,
    personality: identity.personality,
    engagement: identity.engagement?.engagementTier,
    temporal: identity.temporal?.activityPattern,
  });

  return identity;
}

// ── Home “live snapshot” (top posts + comments; token required) ─────────────

export interface InstagramHomeSnapshotPost {
  id: string;
  thumbUrl: string;
  captionSnippet: string;
  likeCount?: number;
  commentsCount?: number;
  permalink?: string;
}

export interface InstagramHomeSnapshotComment {
  text: string;
  username: string;
  postId: string;
}

export interface InstagramHomeSnapshot {
  username: string;
  followersCount?: number;
  mediaCount?: number;
  posts: InstagramHomeSnapshotPost[];
  recentComments: InstagramHomeSnapshotComment[];
}

export async function fetchInstagramHomeSnapshot(token: string): Promise<InstagramHomeSnapshot | null> {
  try {
    const profile = await fetchInstagramProfile(token);
    const media = await fetchInstagramMedia(token, 12);
    const sorted = [...media].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const top3 = sorted.slice(0, 3);

    const posts: InstagramHomeSnapshotPost[] = top3.map(m => ({
      id: m.id,
      thumbUrl: (m.thumbnail_url || m.media_url || '').trim(),
      captionSnippet: (m.caption ?? '').replace(/\s+/g, ' ').trim().slice(0, 140),
      likeCount: m.like_count,
      commentsCount: m.comments_count,
      permalink: m.permalink,
    }));

    const commentLists = await Promise.all(top3.map(m => fetchPostComments(token, m.id, 6)));
    const recentComments: InstagramHomeSnapshotComment[] = [];
    for (let i = 0; i < top3.length; i++) {
      for (const c of commentLists[i] ?? []) {
        const text = (c.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
        if (!text) continue;
        recentComments.push({
          text,
          username: (c.username ?? '').trim() || 'user',
          postId: top3[i].id,
        });
        if (recentComments.length >= 8) break;
      }
      if (recentComments.length >= 8) break;
    }

    return {
      username: profile.username,
      followersCount: profile.followers_count,
      mediaCount: profile.media_count,
      posts,
      recentComments,
    };
  } catch (e) {
    console.error('[IG Snapshot]', e instanceof Error ? e.message : e);
    return null;
  }
}
