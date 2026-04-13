/**
 * Home recommendations — identity-graph-driven lifestyle picks.
 *
 * Uses the central identity graph (music, style, food, activities, professional)
 * to build specific queries for each recommendation category, then passes
 * rich search context to Claude for personalised card generation.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateHomeRecommendations } from '$lib/server/ai';
import { searchWeb, formatResultsForAI } from '$lib/server/search';
import { buildLifestyleQueries, buildEventQueries } from '$lib/server/identity';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';
import { createApiTimer } from '$lib/server/apiTiming';

export const POST: RequestHandler = async ({ request }) => {
  const timer = createApiTimer('/api/recommendations');
  let braveResults = 0;
  let searchContextChars = 0;
  let cardCount = 0;

  let body: { profile: Record<string, unknown>; googleSub?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  try {
  const { graph: g, summary } = await resolveIdentityGraph(body.googleSub, body.profile ?? {});
  timer.mark('afterResolve');
  const lifestyleQueries = buildLifestyleQueries(g);
  const { queries: eventQs, musicQuery } = buildEventQueries(g);

  // Run lifestyle + event searches in parallel (3 Brave calls: 1 + 1 + platform)
  const lifeQs = lifestyleQueries.slice(0, 1);
  const evtQs = eventQs.slice(0, 1);
  const [lifestyleResponses, eventBroadResponses, eventPlatformResponse] = await Promise.all([
    Promise.all(lifeQs.map(q => searchWeb(q, 4))),
    Promise.all(evtQs.map(q => searchWeb(q, 4))),
    searchWeb(musicQuery, 4, ['in.bookmyshow.com', 'district.in']),
  ]);

  const eventResponses = [...eventBroadResponses, eventPlatformResponse];

  // Deduplicate and merge
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

  // Tag event platform results so Claude treats them as bookable listings
  const eventUrls = new Set(eventResponses.flatMap(r => r.results.map(x => x.url)));
  const taggedResults = allResults.map(r => ({
    ...r,
    description: eventUrls.has(r.url) ? `[EVENT LISTING] ${r.description}` : r.description,
  }));

  braveResults = taggedResults.length;
  const searchContext = formatResultsForAI(taggedResults, allImages);
  searchContextChars = searchContext.length;
  timer.mark('afterBrave');

  const response = await generateHomeRecommendations(
    searchContext,
    body.profile as Parameters<typeof generateHomeRecommendations>[1],
    taggedResults,
    { graph: g, summary, googleSub: body.googleSub },
  );
  cardCount = response.cards?.length ?? 0;
  timer.mark('afterClaude');

  return json(response);
  } finally {
    timer.finish({ braveResults, searchContextChars, cardCount });
  }
};
