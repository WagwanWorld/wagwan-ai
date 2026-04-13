/**
 * Interesting facts & news — identity-driven daily briefing.
 *
 * One Brave search + one curated fact (cost control). Uses buildNewsQueries (single diverse query).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchWeb } from '$lib/server/search';
import { buildNewsQueries } from '$lib/server/identity';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { graph: g, summary: identityStr } = await resolveIdentityGraph(body.googleSub, body.profile ?? {});
  const deduped = buildNewsQueries(g);

  const searchResponses = await Promise.all(deduped.map(q => searchWeb(q, 3)));

  const seenUrls = new Set<string>();
  const allResults = searchResponses.flatMap(r => r.results).filter(r => {
    if (seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    return true;
  });

  if (!allResults.length) return json({ facts: [] });

  const resultsStr = allResults
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.description?.slice(0, 180) ?? ''}`)
    .join('\n\n');

  const systemPrompt = `You are curating a personalised daily briefing for someone with this identity: ${identityStr}

From the news articles below, pick the single best story they'd genuinely find interesting.
Write it as a short, punchy fact — not a headline rewrite.
Think "did you know" style but with actual news.

Return JSON array with exactly ONE object (no markdown):
[
  {
    "fact": "Short punchy fact (1–2 sentences max). Make it interesting, not a news headline.",
    "url": "Article URL from search results",
    "source": "Domain name only (e.g. 'NME', 'Rolling Stone', 'TechCrunch')",
    "topic": "1-2 word topic tag",
    "emoji": "single relevant emoji"
  }
]

Rules:
- Pick the one story that best matches their interests — music, brands, industry, or tags when listed above.
- Write the fact in a casual, interesting way — not just the headline
- Use a real URL from search results`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: `Articles:\n${resultsStr}\n\nReturn a JSON array with exactly 1 fact object.` }],
      system: systemPrompt,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
      const parsed = JSON.parse(stripped.match(/\[[\s\S]*\]/)?.[0] ?? '[]');
      return json({ facts: Array.isArray(parsed) ? parsed.slice(0, 1) : [] });
    } catch {
      return json({ facts: [] });
    }
  } catch (e) {
    console.error('News API error:', e);
    return json({ facts: [] });
  }
};
