/**
 * Shop Your Vibe — identity + Expression Engine: vibe-mapped objects, ranked by strength × relevance × novelty.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchWeb, formatResultsForAI, finalizeSearchBackedCards } from '$lib/server/search';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';
import { getOrBuildExpressionLayer } from '$lib/server/expression/buildExpressionLayer';
import { rankShopIdeas, expressionSeed } from '$lib/server/expression/modules';
import { tierFromConfidence } from '$lib/types/expressionLayer';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const PRODUCT_DOMAINS = ['amazon.in', 'flipkart.com', 'myntra.com', 'nykaa.com', 'ajio.com'];

const BUDGET_RANGE: Record<string, string> = {
  low: 'under ₹1000',
  mid: '₹500–₹5000',
  high: 'up to ₹20000+',
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const profile = (body.profile ?? {}) as Record<string, unknown>;
  const { graph: g, summary: identityStr } = await resolveIdentityGraph(body.googleSub, profile);
  const budgetRange = BUDGET_RANGE[g.budget] ?? BUDGET_RANGE.mid;

  const layer = await getOrBuildExpressionLayer(g, profile, identityStr);
  const seed = expressionSeed(
    typeof body.googleSub === 'string' ? body.googleSub : undefined,
    typeof profile.profileUpdatedAt === 'string' ? profile.profileUpdatedAt : undefined,
  );

  const vibeBlock = layer
    ? `Named vibes (lead with these):\n${layer.vibes.map(v => `- ${v.name} (strength ${v.strength.toFixed(2)}): ${v.atoms.slice(0, 6).join(', ')}`).join('\n')}\n\nConcrete atoms:\n${layer.atoms.slice(0, 24).map(a => `- ${a.label} (${a.category})`).join('\n')}`
    : 'No vibe layer yet — use aesthetic and interests below.';

  const ideaPrompt = `You are a personal shopper. Recommend SPECIFIC PHYSICAL OBJECTS (things you can buy), not categories or vague styles.

${vibeBlock}

Their identity summary: ${identityStr}

Budget: ${budgetRange}
Brand hints: ${g.brandVibes.join(', ') || 'none'}
Music: ${g.topArtists.slice(0, 4).join(', ') || 'none'}
Aesthetic: ${g.aesthetic || 'general'}

Return JSON array only (no markdown), exactly 4 objects:
[
  {
    "product": "Exact product name + brand",
    "query": "India buy search query for Amazon/Flipkart/Myntra",
    "why": "One short sentence tying to their vibe",
    "emoji": "single emoji"
  }
]

Rules:
- Only objects — no abstract "minimal style" without a product.
- Map picks to the named vibes when possible.
- Diverse objects (not four near-duplicates).`;

  let productIdeas: Array<{ product: string; query: string; why: string; emoji: string }> = [];

  try {
    const ideaRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: ideaPrompt }],
    });
    const ideaText = ideaRes.content[0].type === 'text' ? ideaRes.content[0].text : '[]';
    const stripped = ideaText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const parsed = JSON.parse(stripped.match(/\[[\s\S]*\]/)?.[0] ?? '[]');
    productIdeas = Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch (e) {
    console.error('Shop idea generation error:', e);
  }

  if (!productIdeas.length) return json({ message: '', cards: [] });

  const ranked =
    layer != null
      ? rankShopIdeas(productIdeas, layer, seed).sort((a, b) => b.confidence - a.confidence)
      : productIdeas.map((p, i) => ({
          ...p,
          confidence: 0.75 - i * 0.04,
          tier: tierFromConfidence(0.75 - i * 0.04),
        }));

  const rotated = ranked.slice(0, 4);
  const primaryIdeas = rotated.slice(0, 2);
  const ideaByProduct = new Map(ranked.map(r => [r.product, r]));

  const searchResponses = await Promise.all(
    primaryIdeas.map(p => searchWeb(p.query, 4, PRODUCT_DOMAINS)),
  );

  const productResults = searchResponses.flatMap(r => r.results);
  let supplementary: typeof productResults = [];
  if (productResults.length < 2) {
    const merged = rotated
      .slice(0, 3)
      .map(p => p.query)
      .join(' ')
      .slice(0, 380);
    if (merged.trim()) {
      supplementary = (await searchWeb(merged, 6)).results;
    }
  }

  const seenUrls = new Set<string>();
  const allResults = [...productResults, ...supplementary].filter(r => {
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

  const searchContext = formatResultsForAI(allResults, allImages);

  const productContext = rotated
    .map((p, i) => {
      const meta = ideaByProduct.get(p.product);
      const conf = meta?.confidence ?? 0.7;
      const tier = meta?.tier ?? tierFromConfidence(conf);
      return `${i + 1}. ${p.product} — ${p.why} (${p.emoji}) [${tier}, ${conf.toFixed(2)}]`;
    })
    .join('\n');

  const formatPrompt = `Format product search results into personalised shopping cards.

Identity: ${identityStr}

Intended picks (ranked; respect tier — high tier first in output order):
${productContext}

Search results:
${searchContext}

Match each intended pick to the closest real listing. Skip if no match.

Return JSON (no markdown):
{
  "message": "One sentence — the vibe thread connecting these picks",
  "cards": [
    {
      "title": "Exact product name + brand from listing",
      "description": "One sentence why it fits them.",
      "price": "Price from listing or empty",
      "url": "Real product URL from results",
      "category": "product",
      "match_score": 88,
      "match_reason": "Tie to their vibe or atom",
      "emoji": "single emoji",
      "image_hint": "short",
      "image_url": "thumbnail if listed",
      "confidence": 0.82,
      "tier": "high"
    }
  ]
}

Use category "product" for all. confidence and tier must mirror the intended pick when possible.`;

  try {
    const formatRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1400,
      messages: [{ role: 'user', content: formatPrompt }],
    });

    const text = formatRes.content[0].type === 'text' ? formatRes.content[0].text : '{}';
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
      const parsed = JSON.parse(stripped);
      const rawCards = Array.isArray(parsed.cards) ? parsed.cards : [];
      const cards = finalizeSearchBackedCards(rawCards, allResults).map((c, i) => {
        const idea = rotated[i];
        const meta = idea ? ideaByProduct.get(idea.product) : undefined;
        const conf = typeof c.confidence === 'number' ? c.confidence : meta?.confidence ?? 0.72;
        return {
          ...c,
          confidence: conf,
          tier: (c.tier as 'high' | 'medium' | 'low' | undefined) ?? meta?.tier ?? tierFromConfidence(conf),
        };
      });
      return json({ message: parsed.message ?? '', cards });
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          const rawCards = Array.isArray(parsed.cards) ? parsed.cards : [];
          const cards = finalizeSearchBackedCards(rawCards, allResults).map((c, i) => {
            const idea = rotated[i];
            const meta = idea ? ideaByProduct.get(idea.product) : undefined;
            const conf = typeof c.confidence === 'number' ? c.confidence : meta?.confidence ?? 0.72;
            return {
              ...c,
              confidence: conf,
              tier: (c.tier as 'high' | 'medium' | 'low' | undefined) ?? meta?.tier ?? tierFromConfidence(conf),
            };
          });
          return json({ message: parsed.message ?? '', cards });
        } catch {}
      }
      return json({ message: '', cards: [] });
    }
  } catch (e) {
    console.error('Shop format error:', e);
    return json({ message: '', cards: [] });
  }
};
