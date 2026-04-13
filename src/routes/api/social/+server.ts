/**
 * "Your Tribe Is Into" — social proof recommendation engine.
 *
 * Identity-graph-driven queries + Claude cards. Two parallel searches (Brave cap).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchWeb, formatResultsForAI, finalizeSearchBackedCards } from '$lib/server/search';
import type { SpotifyIdentity, AppleMusicIdentity, GoogleIdentity, YouTubeIdentity, LinkedInIdentity } from '$lib/utils';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { buildTribeQueries, identitySummary, type IdentityGraph } from '$lib/server/identity';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

interface TribeProfile {
  city?: string;
  interests?: string[];
  budget?: string;
  instagramIdentity?: Record<string, unknown> | null;
  spotifyIdentity?: SpotifyIdentity | null;
  appleMusicIdentity?: AppleMusicIdentity | null;
  googleIdentity?: GoogleIdentity | null;
  youtubeIdentity?: YouTubeIdentity | null;
  linkedinIdentity?: LinkedInIdentity | null;
}

function tribeIdentityBlock(g: IdentityGraph): string {
  const lines: string[] = [identitySummary(g)];
  if (g.signalMeta.hasInstagram) {
    const bits = [
      g.aesthetic && `aesthetic: ${g.aesthetic}`,
      g.interests.length && `interests: ${g.interests.slice(0, 4).join(', ')}`,
      g.brandVibes.length && `brandVibes: ${g.brandVibes.slice(0, 3).join(', ')}`,
      g.musicVibe && `musicVibe: ${g.musicVibe}`,
      g.lifestyle && `lifestyle: ${g.lifestyle}`,
    ].filter(Boolean);
    if (bits.length) lines.push(`INSTAGRAM: ${bits.join(' | ')}`);
  }
  if (g.topArtists.length) {
    lines.push(
      `MUSIC (Spotify or Apple Music): top artists: ${g.topArtists.slice(0, 5).join(', ')} | genres: ${g.topGenres.slice(0, 3).join(', ')}`,
    );
  }
  if (g.topChannels.length) {
    lines.push(`YOUTUBE: subscribes: ${g.topChannels.slice(0, 5).join(', ')} | categories: ${g.contentCategories.slice(0, 3).join(', ')}`);
  }
  if (g.signalMeta.hasLinkedIn) {
    lines.push(`LINKEDIN: ${[g.role, g.company].filter(Boolean).join(' at ')} | ${g.industry}`);
  }
  return lines.filter(Boolean).join('\n');
}

export const POST: RequestHandler = async ({ request }) => {
  const body: { profile: TribeProfile; googleSub?: string } = await request.json();
  const { profile } = body;

  const { graph: g } = await resolveIdentityGraph(body.googleSub, profile as Record<string, unknown>);
  const finalQueries = buildTribeQueries(g);

  const searchResponses = await Promise.all(finalQueries.map(q => searchWeb(q, 4)));

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

  const searchContext = formatResultsForAI(allResults, allImages);
  const identityBlock = tribeIdentityBlock(g);

  const systemPrompt = `You are Wagwan AI finding what's trending in this person's exact tribe.

Their cross-platform identity:
${identityBlock}

Surface what people with this exact identity stack are into right now.
Mix categories: music/culture, experiences, style, digital/creator content.

Return JSON (no markdown):
{
  "message": "1 punchy sentence about what their tribe is into right now",
  "cards": [
    {
      "title": "Exact name",
      "description": "2 sentences. Why their tribe loves this right now.",
      "price": "exact price or 'Free' or empty",
      "url": "real URL from search results",
      "category": "music|food|nightlife|fitness|fashion|travel|experience|deal|tech|wellness|culture|other",
      "match_score": 85,
      "match_reason": "Name specific signals from their profile (artists, channels, aesthetic, brands, city, tags) — not generic.",
      "emoji": "single emoji",
      "image_hint": "2-3 word scene",
      "image_url": "Thumbnail from the same result row as url when listed; else Available images; else empty"
    }
  ]
}

Rules:
- Exactly 4 cards. Mix categories.
- Tone: social proof, FOMO, exciting.
- Use REAL URLs from search results only.
- match_reason must cite concrete facts from the identity block above.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Find what's trending for this person's tribe right now.\n\nSearch results:\n${searchContext}\n\nReturn the JSON.` }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
      const parsed = JSON.parse(stripped);
      const cards = Array.isArray(parsed.cards) ? finalizeSearchBackedCards(parsed.cards, allResults) : [];
      return json({ message: parsed.message ?? '', cards });
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const cards = Array.isArray(parsed.cards) ? finalizeSearchBackedCards(parsed.cards, allResults) : [];
        return json({ message: parsed.message ?? '', cards });
      }
      return json({ message: '', cards: [] });
    }
  } catch (e) {
    console.error('Tribe signal error:', e);
    return json({ message: '', cards: [] });
  }
};
