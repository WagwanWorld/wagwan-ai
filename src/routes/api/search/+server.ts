/**
 * JSON (non-streaming) search endpoint — used by the explore page.
 * Returns a plain ChatResponse.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateChatResponse } from '$lib/server/ai';
import { searchWeb, buildSearchQueries, formatResultsForAI } from '$lib/server/search';

export const POST: RequestHandler = async ({ request }) => {
  let body: { message: string; profile: Record<string, unknown>; googleSub?: string };

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const { message, profile } = body;
  if (!message?.trim()) throw error(400, 'message is required');

  const profileArg = profile as Parameters<typeof buildSearchQueries>[1];
  const { queries, useEventDomains } = buildSearchQueries(message, profileArg);

  const igCity = (profile.instagramIdentity as { city?: string } | null | undefined)?.city;
  const city = (profile.city as string | undefined) ?? igCity ?? 'Mumbai';

  let searchResponses: Awaited<ReturnType<typeof searchWeb>>[];
  if (useEventDomains) {
    const [broadResponses, platformResponse] = await Promise.all([
      Promise.all(queries.slice(0, 2).map(q => searchWeb(q, 4))),
      searchWeb(`${message} ${city}`, 4, ['in.bookmyshow.com', 'district.in']),
    ]);
    searchResponses = [...broadResponses, platformResponse];
  } else {
    searchResponses = await Promise.all(queries.map(q => searchWeb(q, 4)));
  }

  const seenUrls = new Set<string>();
  const allResults = searchResponses.flatMap(r => r.results).filter(r => {
    if (seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    return true;
  });

  const seenImages = new Set<string>();
  const allImages = searchResponses.flatMap(r => r.images).filter(img => {
    if (seenImages.has(img)) return false;
    seenImages.add(img);
    return true;
  });

  const searchContext = formatResultsForAI(allResults, allImages, { maxResults: 6 });
  const response = await generateChatResponse(
    message,
    searchContext,
    profile as Parameters<typeof generateChatResponse>[2],
    allResults,
    { googleSub: body.googleSub },
  );

  return json(response);
};
