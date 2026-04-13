/**
 * GET /api/home/morning-brief?sub={googleSub}&name={firstName}
 *
 * Returns personalized news + suggested reads.
 * Cached for 24hr in Redis + Supabase. LLM only on cache miss.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCached, setCached } from '$lib/server/contentCache';
import { getProfile } from '$lib/server/supabase';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';
import { searchWeb, formatResultsForAI } from '$lib/server/search';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 60_000 });

interface NewsItem {
  headline: string;
  summary: string;
  source: string;
  url: string;
  relevance: string;
}

interface ReadItem {
  title: string;
  author: string;
  type: string;
  why: string;
  url: string;
}

interface MorningBriefPayload {
  news: NewsItem[];
  reads: ReadItem[];
}

function timeGreeting(name: string): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return `Good morning, ${name}`;
  if (h >= 12 && h < 17) return `Good afternoon, ${name}`;
  if (h >= 17 && h < 21) return `Good evening, ${name}`;
  return `Hey ${name}`;
}

export const GET: RequestHandler = async ({ url }) => {
  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) return json({ ok: false, error: 'missing_sub' }, { status: 400 });

  const cached = await getCached<MorningBriefPayload>(sub, 'morning_brief');
  if (cached) {
    return json({
      ok: true,
      greeting: timeGreeting(url.searchParams.get('name') || 'there'),
      ...cached.payload,
      cached: true,
      generatedAt: cached.generatedAt,
    });
  }

  try {
    // Load profile from Supabase to resolve identity graph
    const profileRow = await getProfile(sub);
    const profileData = (profileRow?.profile_data ?? {}) as Record<string, unknown>;
    const { graph: g, summary } = await resolveIdentityGraph(sub, profileData);

    const interests = (g.activities || []).slice(0, 3);
    const city = g.city || '';
    const role = g.role || '';
    const genres = (g.topGenres || []).slice(0, 2);

    const queries: string[] = [];
    if (role) queries.push(`${role} industry news ${new Date().toISOString().slice(0, 10)}`);
    if (interests.length) queries.push(`${interests.join(' ')} trends 2026`);
    if (city) queries.push(`${city} events things to do this week`);
    if (genres.length) queries.push(`${genres.join(' ')} new music releases`);
    if (!queries.length) queries.push('technology culture lifestyle news today');

    // Search — searchWeb returns { results, query } objects
    const searchResponses = await Promise.all(
      queries.slice(0, 3).map(q => searchWeb(q, 3))
    );
    // Extract the results arrays and flatten
    const allResults = searchResponses.flatMap(r =>
      Array.isArray(r) ? r : (r as any)?.results ?? []
    );
    const formatted = formatResultsForAI(allResults);

    const prompt = `You are generating a personalized morning brief for a user.

IDENTITY: ${summary}
CITY: ${city}
ROLE: ${role}
INTERESTS: ${interests.join(', ')}

SEARCH RESULTS:
${formatted}

Generate a JSON response with:
1. "news": 3-4 most relevant news items from the search results. For each: headline, summary (1 sentence), source, url (copy verbatim from results), relevance (why this matters to THIS specific user based on their identity).
2. "reads": 2-3 book or article suggestions that would resonate with this person's interests. For each: title, author, type (book/article/podcast), why (1 sentence connecting to their identity), url (search result url or empty string).

Return ONLY valid JSON: { "news": [...], "reads": [...] }`;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    let payload: MorningBriefPayload = { news: [], reads: [] };
    try {
      const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        payload = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('[MorningBrief] Failed to parse Claude response');
    }

    await setCached(sub, 'morning_brief', payload);

    return json({
      ok: true,
      greeting: timeGreeting(url.searchParams.get('name') || 'there'),
      ...payload,
      cached: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[MorningBrief] Error:', e.message);
    return json({ ok: true, greeting: timeGreeting('there'), news: [], reads: [], cached: false });
  }
};
