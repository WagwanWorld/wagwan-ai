/**
 * Consolidated home feed — runs recs + news in parallel server-side.
 * Reduces client HTTP connections from 4-5 to 2-3 on first load.
 */
import { createHash } from 'node:crypto';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateHomeRecommendations, extractToolUseInput } from '$lib/server/ai';
import { searchWeb, formatResultsForAI, sanitizeNewsFactUrls } from '$lib/server/search';
import {
  buildLifestyleQueries,
  buildEventQueries,
  buildNewsQueries,
  type IdentityGraph,
} from '$lib/server/identity';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';
import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { createApiTimer } from '$lib/server/apiTiming';
import { redisGetJson, redisSetJson } from '$lib/server/redisCache';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 60_000 });

const EMIT_NEWS_FACTS_TOOL: Tool = {
  name: 'emit_news_facts',
  description:
    'Return one personalised news fact. The url must be copied verbatim from the article list in the user message.',
  input_schema: {
    type: 'object',
    properties: {
      facts: {
        type: 'array',
        maxItems: 2,
        items: {
          type: 'object',
          properties: {
            fact: { type: 'string' },
            url: { type: 'string' },
            source: { type: 'string' },
            topic: { type: 'string' },
            emoji: { type: 'string' },
          },
          required: ['fact', 'url'],
        },
      },
    },
    required: ['facts'],
  },
};

function homeFeedRedisKey(
  googleSub: string | undefined,
  summary: string,
  profile: Record<string, unknown>,
): string {
  const sub = googleSub?.trim() || 'anon';
  const day = new Date().toISOString().slice(0, 10);
  const rev = typeof profile.profileUpdatedAt === 'string' ? profile.profileUpdatedAt : '0';
  const h = createHash('sha256').update(`${summary}\n${rev}`).digest('hex').slice(0, 24);
  return `wagwan:homefeed:v1:${sub}:${day}:${h}`;
}

export const POST: RequestHandler = async ({ request }) => {
  const timer = createApiTimer('/api/home-feed');
  let body: { profile: Record<string, unknown>; googleSub?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const { graph: g, summary } = await resolveIdentityGraph(body.googleSub, body.profile ?? {});
  timer.mark('afterResolve');

  const cacheKey = homeFeedRedisKey(body.googleSub, summary, body.profile ?? {});
  type FeedPayload = {
    recs: Awaited<ReturnType<typeof fetchRecs>>;
    news: Awaited<ReturnType<typeof fetchNews>>;
  };
  const cached = await redisGetJson<FeedPayload>(cacheKey);
  if (cached && cached.recs != null && cached.news != null) {
    timer.mark('redisHit');
    timer.finish({
      redisHit: true,
      recsCards: cached.recs.cards?.length ?? 0,
      newsFacts: cached.news.facts?.length ?? 0,
    });
    return json(cached);
  }

  const [recsResult, newsResult] = await Promise.all([
    fetchRecs(g, summary, body.profile, body.googleSub),
    fetchNews(g, summary),
  ]);
  timer.mark('afterParallel');

  const payload: FeedPayload = { recs: recsResult, news: newsResult };
  const ttlRaw = env.HOME_FEED_REDIS_TTL_SEC;
  const ttlSec =
    ttlRaw != null && String(ttlRaw).trim() !== ''
      ? Math.min(Math.max(Number(ttlRaw), 60), 86400)
      : 720;
  void redisSetJson(cacheKey, payload, ttlSec);

  timer.finish({
    recsCards: recsResult.cards?.length ?? 0,
    newsFacts: newsResult.facts?.length ?? 0,
    summaryChars: summary.length,
  });

  return json(payload);
};

async function fetchRecs(
  g: IdentityGraph,
  summary: string,
  profile: Record<string, unknown>,
  googleSub?: string,
) {
  try {
    const lifestyleQueries = buildLifestyleQueries(g);
    const { queries: eventQs, musicQuery } = buildEventQueries(g);

    const lifeQs = lifestyleQueries.slice(0, 1);
    const evtQs = eventQs.slice(0, 1);

    const [lifestyleResponses, eventBroadResponses, eventPlatformResponse] = await Promise.all([
      Promise.all(lifeQs.map(q => searchWeb(q, 4))),
      Promise.all(evtQs.map(q => searchWeb(q, 4))),
      searchWeb(musicQuery, 4, ['in.bookmyshow.com', 'district.in']),
    ]);

    const eventResponses = [...eventBroadResponses, eventPlatformResponse];

    const seenUrls = new Set<string>();
    const allResults = [
      ...lifestyleResponses.flatMap(r => r.results),
      ...eventResponses.flatMap(r => r.results),
    ].filter(r => {
      if (seenUrls.has(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });

    const seenImages = new Set<string>();
    const allImages = [
      ...lifestyleResponses.flatMap(r => r.images),
      ...eventResponses.flatMap(r => r.images),
    ].filter(img => {
      if (seenImages.has(img)) return false;
      seenImages.add(img);
      return true;
    });

    const eventUrls = new Set(eventResponses.flatMap(r => r.results.map(x => x.url)));
    const taggedResults = allResults.map(r => ({
      ...r,
      description: eventUrls.has(r.url) ? `[EVENT LISTING] ${r.description}` : r.description,
    }));

    const searchContext = formatResultsForAI(taggedResults, allImages);
    return await generateHomeRecommendations(
      searchContext,
      profile as Parameters<typeof generateHomeRecommendations>[1],
      taggedResults,
      { graph: g, summary, googleSub },
    );
  } catch (e) {
    console.error('Home feed recs error:', e);
    return { message: '', cards: [] };
  }
}

async function fetchNews(g: IdentityGraph, summary: string) {
  try {
    const deduped = buildNewsQueries(g);
    const searchResponses = await Promise.all(deduped.map(q => searchWeb(q, 3)));

    const seenUrls = new Set<string>();
    const allResults = searchResponses.flatMap(r => r.results).filter(r => {
      if (seenUrls.has(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });

    if (!allResults.length) return { facts: [] };

    const resultsStr = allResults
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.description?.slice(0, 160) ?? ''}`)
      .join('\n\n');

    const identityStr = summary;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      tools: [EMIT_NEWS_FACTS_TOOL],
      tool_choice: { type: 'tool', name: EMIT_NEWS_FACTS_TOOL.name },
      messages: [
        {
          role: 'user',
          content: `Articles:\n${resultsStr}\n\nCall emit_news_facts with exactly one fact object in the facts array.`,
        },
      ],
      system: `You are curating a personalised daily briefing for someone with this identity: ${identityStr}

From the news articles below, pick the single best story they'd genuinely find interesting.
Write it as a short, punchy fact — not a headline rewrite.

Rules:
- Pick the one story that best matches their interests
- Write the fact in a casual, interesting way
- Use a real URL from search results only (copy verbatim)`,
    });

    const toolIn = extractToolUseInput<{ facts?: Array<Record<string, string>> }>(
      response.content,
      EMIT_NEWS_FACTS_TOOL.name,
    );
    if (toolIn?.facts && Array.isArray(toolIn.facts) && toolIn.facts.length > 0) {
      const grounded = sanitizeNewsFactUrls(toolIn.facts.slice(0, 1), allResults);
      return { facts: grounded };
    }

    const textBlock = response.content.find(b => b.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '[]';
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
      const parsed = JSON.parse(stripped.match(/\[[\s\S]*\]/)?.[0] ?? '[]');
      const rawFacts = Array.isArray(parsed) ? parsed.slice(0, 1) : [];
      return { facts: sanitizeNewsFactUrls(rawFacts, allResults) };
    } catch {
      return { facts: [] };
    }
  } catch (e) {
    console.error('Home feed news error:', e);
    return { facts: [] };
  }
}
