/**
 * YouTube Data API v3 via Google OAuth 2.0.
 *
 * Extracts lifestyle signals from subscriptions and liked videos:
 * - Music channels → genre/artist signals
 * - Food/travel/fashion channels → lifestyle signals
 * - Fitness/wellness channels → activity patterns
 *
 * Setup:
 *  1. Google Cloud Console → new project
 *  2. Enable "YouTube Data API v3"
 *  3. APIs & Services → Credentials → OAuth 2.0 Client ID (Web application)
 *  4. Add redirect URI: {PUBLIC_BASE_URL}/auth/youtube/callback
 *  5. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';
import type { YouTubeIdentity } from '$lib/utils';

export { type YouTubeIdentity };

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const REDIRECT_URI = `${PUBLIC_BASE_URL}/auth/youtube/callback`;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

export function isYouTubeConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

export function getYouTubeAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    state,
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/auth?${params}`;
}

export async function exchangeYouTubeCode(code: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube token exchange failed: ${err}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

// ── YouTube API helpers ────────────────────────────────────────────────────

function ytHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

interface YTChannel { snippet?: { title?: string; description?: string } }
interface YTVideo { snippet?: { title?: string; categoryId?: string; tags?: string[] } }

const YT_CATEGORY_MAP: Record<string, string> = {
  '10': 'music', '17': 'sports', '19': 'travel', '22': 'lifestyle',
  '23': 'comedy', '24': 'entertainment', '26': 'lifestyle', '28': 'tech',
  '29': 'fashion', '1': 'film', '2': 'cars', '15': 'pets',
};

export async function fetchYouTubeData(token: string): Promise<{
  channels: string[];
  categories: string[];
  tags: string[];
}> {
  const headers = ytHeaders(token);

  const [subsRes, likesRes] = await Promise.all([
    fetch(`${YT_BASE}/subscriptions?mine=true&part=snippet&maxResults=50&order=relevance`, { headers }),
    fetch(`${YT_BASE}/videos?myRating=like&part=snippet&maxResults=20`, { headers }),
  ]);

  const subs: YTChannel[] = subsRes.ok ? ((await subsRes.json()).items ?? []) : [];
  const likes: YTVideo[] = likesRes.ok ? ((await likesRes.json()).items ?? []) : [];

  const channels = subs
    .map(s => s.snippet?.title)
    .filter((t): t is string => !!t)
    .slice(0, 20);

  const categoryIds = likes
    .map(v => v.snippet?.categoryId)
    .filter((c): c is string => !!c);

  const categoryCounts: Record<string, number> = {};
  for (const id of categoryIds) {
    const cat = YT_CATEGORY_MAP[id] ?? 'entertainment';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }
  const categories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat)
    .slice(0, 6);

  const tagSet = new Set<string>();
  likes.forEach(v => (v.snippet?.tags ?? []).slice(0, 3).forEach(t => tagSet.add(t.toLowerCase())));
  const tags = [...tagSet].slice(0, 15);

  return { channels, categories, tags };
}

export async function analyseYouTubeIdentity(
  channels: string[],
  categories: string[],
  tags: string[]
): Promise<YouTubeIdentity> {
  if (!channels.length && !categories.length) {
    return { topChannels: [], topCategories: categories, contentPersonality: '', lifestyleSignals: [] };
  }

  const prompt = `Analyse this YouTube data to understand someone's lifestyle, interests, and personality.

Subscribed channels: ${channels.slice(0, 15).join(', ')}
Content categories they like: ${categories.join(', ')}
Tags from liked videos: ${tags.slice(0, 10).join(', ')}

Return JSON only (no markdown):
{
  "contentPersonality": "1-sentence description of their content taste and personality",
  "lifestyleSignals": ["up to 5 lifestyle signal tags inferred from their YouTube activity, e.g. 'fitness enthusiast', 'foodie', 'music lover', 'sneakerhead', 'travel lover'"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    return {
      topChannels: channels.slice(0, 10),
      topCategories: categories,
      contentPersonality: parsed.contentPersonality ?? categories.join(', '),
      lifestyleSignals: Array.isArray(parsed.lifestyleSignals) ? parsed.lifestyleSignals : [],
    };
  } catch {
    return { topChannels: channels.slice(0, 10), topCategories: categories, contentPersonality: '', lifestyleSignals: [] };
  }
}
