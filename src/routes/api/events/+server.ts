/**
 * Events & Experiences — identity-graph-driven event discovery.
 *
 * Uses actual artist names from Spotify, aesthetic from Instagram,
 * and activity signals from YouTube to build highly targeted queries.
 * Prioritises BookMyShow/District for platform links where indexed.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchWeb, formatResultsForAI, finalizeSearchBackedCards } from '$lib/server/search';
import { buildEventQueries } from '$lib/server/identity';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { createApiTimer } from '$lib/server/apiTiming';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 60_000 });

export const POST: RequestHandler = async ({ request }) => {
  const timer = createApiTimer('/api/events');
  let braveResults = 0;
  let searchContextChars = 0;
  try {
  const body = await request.json();
  const { graph: g, summary: identityStr } = await resolveIdentityGraph(body.googleSub, body.profile ?? {});
  timer.mark('afterResolve');
  const { queries, musicQuery } = buildEventQueries(g);

  // Hybrid: broad searches (guaranteed results) + BookMyShow/District bonus
  const broadQs = queries.slice(0, 2);
  const [broadResponses, platformResponse] = await Promise.all([
    Promise.all(broadQs.map(q => searchWeb(q, 4))),
    searchWeb(musicQuery, 4, ['in.bookmyshow.com', 'district.in']),
  ]);

  const seenUrls = new Set<string>();
  const allResults = [
    ...broadResponses.flatMap(r => r.results),
    ...platformResponse.results,
  ].filter(r => {
    if (seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    return true;
  });

  if (!allResults.length) {
    return json({ message: '', cards: [] });
  }

  braveResults = allResults.length;
  const searchContext = formatResultsForAI(allResults, []);
  searchContextChars = searchContext.length;
  timer.mark('afterBrave');

  const systemPrompt = `You are surfacing real events and experiences for someone with this identity: ${identityStr}.

From the search results, pick the 4 most relevant real events. Prioritise listings in or near ${g.city} when location is unclear. Strongly prefer events that align with their stated artists/genres (${g.musicQueryStr || g.musicVibe || 'their taste'}) and vibe (${g.queryStyleHint || g.aesthetic || 'general'}).

Return JSON (no markdown):
{
  "message": "1 sentence — what's on this month that matches their specific vibe",
  "cards": [
    {
      "title": "Event name — Venue, City",
      "description": "1 sentence: what it is + date if found.",
      "price": "Ticket price, 'Free', or ''",
      "url": "EXACT URL from search results — prefer bookmyshow/district/urbanaut links",
      "category": "nightlife",
      "match_score": 85,
      "match_reason": "1 sentence naming the specific identity signal (e.g. 'Matches your ${g.topArtists[0] ?? g.musicVibe ?? 'music taste'}')",
      "emoji": "🎟️",
      "image_hint": "event vibe",
      "image_url": "Thumbnail URL from the same numbered result as url when present, else empty"
    }
  ]
}

Rules:
- Only use URLs from search results.
- Extract the actual event name, venue, and date from the listing text.
- category must be "nightlife" or "experience".
- match_reason must cite a concrete identity fact (artist, genre, city, aesthetic, or activity) — not generic text.
- If fewer than 4 real events found, return only what's real — don't fabricate.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Find events for this person.\n\nListings:\n${searchContext}\n\nReturn JSON.` }],
    });
    timer.mark('afterClaude');

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
      const parsed = JSON.parse(stripped);
      const cards = Array.isArray(parsed.cards) ? finalizeSearchBackedCards(parsed.cards, allResults) : [];
      return json({ message: parsed.message ?? '', cards });
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          const cards = Array.isArray(parsed.cards) ? finalizeSearchBackedCards(parsed.cards, allResults) : [];
          return json({ message: parsed.message ?? '', cards });
        } catch {}
      }
      return json({ message: '', cards: [] });
    }
  } catch (e) {
    console.error('Events API error:', e);
    return json({ message: '', cards: [] });
  }
  } finally {
    timer.finish({ braveResults, searchContextChars });
  }
};
