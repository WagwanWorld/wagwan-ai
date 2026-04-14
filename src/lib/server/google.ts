/**
 * Unified Google integration: YouTube + Gmail + Google Calendar.
 *
 * One OAuth flow requests all scopes at once:
 *   - youtube.readonly       → subscriptions & liked videos (lifestyle signals)
 *   - gmail.readonly         → email themes & important senders
 *   - gmail.compose          → create drafts (user finishes in Gmail)
 *   - calendar.readonly      → upcoming events
 *   - calendar.events        → push reminders to calendar
 *
 * Setup:
 *  1. Google Cloud Console → new project (or existing)
 *  2. Enable: YouTube Data API v3, Gmail API, Google Calendar API
 *  3. OAuth Consent Screen → add all scopes listed above
 *  4. Credentials → OAuth 2.0 Client ID (Web) → redirect URI: {PUBLIC_BASE_URL}/auth/google/callback
 *  5. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';
import type { GoogleIdentity } from '$lib/utils';
import {
  fetchCalendarEvents as fetchCalendarEventsInner,
  type CalendarEvent,
} from '$lib/server/google/calendar';

export { type GoogleIdentity };
export type { CalendarEvent } from '$lib/server/google/calendar';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const REDIRECT_URI = `${PUBLIC_BASE_URL}/auth/google/callback`;

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

// ── Auth ──────────────────────────────────────────────────────────────────────

export function isGoogleConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    state,
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
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
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  const data = await res.json();
  return { accessToken: data.access_token as string, refreshToken: (data.refresh_token ?? '') as string };
}

export async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error('Token refresh failed');
  const data = await res.json();
  return data.access_token as string;
}

// ── YouTube ───────────────────────────────────────────────────────────────────

const YT_BASE = 'https://www.googleapis.com/youtube/v3';
const YT_CATEGORY_MAP: Record<string, string> = {
  '10': 'music', '17': 'sports', '19': 'travel', '22': 'lifestyle',
  '23': 'comedy', '24': 'entertainment', '26': 'lifestyle', '28': 'tech',
  '29': 'fashion', '1': 'film', '2': 'cars', '15': 'pets',
};

async function fetchYouTubeData(token: string) {
  const h = { Authorization: `Bearer ${token}` };
  const [subsRes, likesRes] = await Promise.allSettled([
    fetch(`${YT_BASE}/subscriptions?mine=true&part=snippet&maxResults=50&order=relevance`, { headers: h }),
    fetch(`${YT_BASE}/videos?myRating=like&part=snippet&maxResults=20`, { headers: h }),
  ]);

  const subs = subsRes.status === 'fulfilled' && subsRes.value.ok
    ? ((await subsRes.value.json()).items ?? []) : [];
  const likes = likesRes.status === 'fulfilled' && likesRes.value.ok
    ? ((await likesRes.value.json()).items ?? []) : [];

  const channels: string[] = subs
    .map((s: { snippet?: { title?: string } }) => s.snippet?.title)
    .filter((t: unknown): t is string => !!t)
    .slice(0, 20);

  const catCounts: Record<string, number> = {};
  likes.forEach((v: { snippet?: { categoryId?: string } }) => {
    const cat = YT_CATEGORY_MAP[v.snippet?.categoryId ?? ''] ?? 'entertainment';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const categories = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 6);

  return { channels, categories };
}

// ── Gmail ─────────────────────────────────────────────────────────────────────

export async function fetchGmailSummary(token: string): Promise<{ threads: string[]; senders: string[] }> {
  const h = { Authorization: `Bearer ${token}` };

  // Only emails from the last 24 hours
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000); // Unix timestamp
  const q24h = `after:${since}`;

  const [unreadRes, allRecentRes] = await Promise.allSettled([
    fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=20&q=is:unread+${q24h}`, { headers: h }),
    fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=10&q=${q24h}`, { headers: h }),
  ]);

  const msgIds: string[] = [];
  if (unreadRes.status === 'fulfilled' && unreadRes.value.ok) {
    const d = await unreadRes.value.json();
    (d.messages ?? []).slice(0, 12).forEach((m: { id: string }) => msgIds.push(m.id));
  }
  if (allRecentRes.status === 'fulfilled' && allRecentRes.value.ok) {
    const d = await allRecentRes.value.json();
    (d.messages ?? []).slice(0, 5).forEach((m: { id: string }) => { if (!msgIds.includes(m.id)) msgIds.push(m.id); });
  }

  if (!msgIds.length) return { threads: [], senders: [] };

  // Fetch headers only (format=metadata) for the messages
  const metaResults = await Promise.allSettled(
    msgIds.slice(0, 12).map(id =>
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, { headers: h })
        .then(r => r.ok ? r.json() : null)
    )
  );

  const threads: string[] = [];
  const senderSet = new Set<string>();

  for (const r of metaResults) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    const headers: { name: string; value: string }[] = r.value.payload?.headers ?? [];
    const subject = headers.find(h => h.name === 'Subject')?.value ?? '';
    const from = headers.find(h => h.name === 'From')?.value ?? '';
    if (subject) threads.push(subject.slice(0, 80));
    const senderName = from.replace(/<.*?>/, '').trim().replace(/"/g, '');
    if (senderName) senderSet.add(senderName.split(',')[0].trim());
  }

  return { threads: threads.slice(0, 10), senders: [...senderSet].slice(0, 8) };
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export async function fetchCalendarEvents(token: string, daysAhead = 7): Promise<CalendarEvent[]> {
  return fetchCalendarEventsInner(token, daysAhead);
}

/** Create a Gmail draft (requires gmail.compose). Returns draft id or null. */
export async function createGmailDraft(
  token: string,
  params: { to: string; subject: string; body: string },
): Promise<{ id: string } | null> {
  const lines = [
    `To: ${params.to.replace(/[\r\n]/g, ' ').trim()}`,
    `Subject: ${params.subject.replace(/[\r\n]/g, ' ').slice(0, 500)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    params.body.replace(/\r\n/g, '\n').slice(0, 100_000),
  ];
  const raw = lines.join('\r\n');
  const b64 = Buffer.from(raw, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw: b64 } }),
  });
  if (!res.ok) {
    console.error('[Gmail draft]', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const id = data.id ?? data.draft?.id;
  return id ? { id: String(id) } : null;
}

export async function pushCalendarEvent(token: string, event: {
  title: string;
  start: string;   // ISO datetime
  end: string;
  description?: string;
}): Promise<{ id: string } | null> {
  const body = {
    summary: event.title,
    description: event.description,
    start: { dateTime: event.start, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: { dateTime: event.end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  };
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { id: data.id };
}

// ── Identity analysis ─────────────────────────────────────────────────────────

export async function analyseGoogleIdentity(
  ytChannels: string[],
  ytCategories: string[],
  gmailThreads: string[],
  gmailSenders: string[],
  email: string,
  name?: string,
  picture?: string,
  lifestylePatterns?: {
    events_by_day_of_week: Record<string, number>;
    events_by_time_block: { morning: number; afternoon: number; evening: number; night: number };
    recurring_event_titles: string[];
    frequent_event_titles: string[];
    total_events: number;
  },
): Promise<GoogleIdentity> {
  const calendarContext = lifestylePatterns && lifestylePatterns.total_events > 0
    ? `
Calendar lifestyle patterns (past 30 days, ${lifestylePatterns.total_events} events):
  Active days: ${Object.entries(lifestylePatterns.events_by_day_of_week).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${d}(${c})`).join(', ') || 'none'}
  Time blocks: morning=${lifestylePatterns.events_by_time_block.morning}, afternoon=${lifestylePatterns.events_by_time_block.afternoon}, evening=${lifestylePatterns.events_by_time_block.evening}, night=${lifestylePatterns.events_by_time_block.night}
  Recurring events: ${lifestylePatterns.recurring_event_titles.slice(0, 8).join(', ') || 'none'}
  Frequent events: ${lifestylePatterns.frequent_event_titles.slice(0, 8).join(', ') || 'none'}`
    : '';

  const prompt = `Analyse this Google account data to understand someone's lifestyle and interests.
Prioritise YouTube **subscription channel names** and **liked-video categories** as ground truth for what they actually watch; use subject lines only as supporting hints.
Use calendar lifestyle patterns (when present) as strong behavioural evidence for routines and habits.

YouTube subscriptions (highest signal): ${ytChannels.slice(0, 12).join(', ') || 'none'}
YouTube liked-video categories: ${ytCategories.join(', ') || 'none'}
Recent subject-line themes: ${gmailThreads.slice(0, 8).join(' | ') || 'none'}
Sender labels: ${gmailSenders.slice(0, 6).join(', ') || 'none'}${calendarContext}

Return JSON only (no markdown):
{
  "contentPersonality": "1-sentence description of their content/digital taste",
  "lifestyleSignals": ["up to 5 lifestyle tags e.g. 'fitness enthusiast', 'traveller', 'foodie', 'entrepreneur'"],
  "emailThemes": ["2-3 short phrases summarising inbox themes e.g. 'Startup newsletters', 'Flight bookings', 'Team standups'"],
  "importantSenders": ["up to 4 notable sender names worth surfacing"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    return {
      email, name, picture,
      topChannels: ytChannels.slice(0, 10),
      topCategories: ytCategories,
      contentPersonality: parsed.contentPersonality ?? '',
      lifestyleSignals: parsed.lifestyleSignals ?? [],
      emailThemes: parsed.emailThemes ?? [],
      importantSenders: parsed.importantSenders ?? gmailSenders.slice(0, 4),
    };
  } catch {
    return {
      email, name, picture,
      topChannels: ytChannels.slice(0, 10),
      topCategories: ytCategories,
      contentPersonality: '',
      lifestyleSignals: [],
      emailThemes: [],
      importantSenders: [],
    };
  }
}

// Re-export for convenience so callers can do one import
export { fetchYouTubeData };
