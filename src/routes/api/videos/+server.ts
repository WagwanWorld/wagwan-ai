/**
 * "Watch This" — video content recommendations tailored to the user.
 *
 * Identity-graph-driven queries; two parallel searches (Brave cap).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchWeb, formatResultsForAI, finalizeSearchBackedCards } from '$lib/server/search';
import type { ChatResponse, SpotifyIdentity, AppleMusicIdentity, GoogleIdentity, YouTubeIdentity, LinkedInIdentity } from '$lib/utils';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { buildVideoQueries, identitySummary, type IdentityGraph } from '$lib/server/identity';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

interface VideoProfile {
  instagramIdentity?: Record<string, unknown> | null;
  spotifyIdentity?: SpotifyIdentity | null;
  appleMusicIdentity?: AppleMusicIdentity | null;
  googleIdentity?: GoogleIdentity | null;
  youtubeIdentity?: YouTubeIdentity | null;
  linkedinIdentity?: LinkedInIdentity | null;
  interests?: string[];
  city?: string;
  budget?: string;
}

function videoIdentityBlock(g: IdentityGraph): string {
  const lines: string[] = [identitySummary(g)];
  if (g.signalMeta.hasInstagram) {
    const igBits = [
      g.aesthetic && `aesthetic: ${g.aesthetic}`,
      g.interests.length && `interests: ${g.interests.slice(0, 4).join(', ')}`,
      g.musicVibe && `music: ${g.musicVibe}`,
      g.foodVibe && `food: ${g.foodVibe}`,
      g.travelStyle && `travel: ${g.travelStyle}`,
      `city: ${g.city}`,
    ].filter(Boolean);
    lines.push(`INSTAGRAM: ${igBits.join(' | ')}`);
  }
  if (g.topArtists.length) {
    lines.push(`MUSIC: ${g.topArtists.slice(0, 5).join(', ')} | ${g.topGenres.slice(0, 3).join(', ')}`);
  }
  if (g.topChannels.length) {
    lines.push(`YOUTUBE: ${g.topChannels.slice(0, 5).join(', ')} | personality: ${g.contentPersonality}`);
  }
  if (g.signalMeta.hasLinkedIn) {
    lines.push(`LINKEDIN: ${g.role} at ${g.company} | ${g.industry}`);
  }
  return lines.join('\n');
}

export const POST: RequestHandler = async ({ request }) => {
  const body: { profile: VideoProfile; googleSub?: string } = await request.json();
  const { profile } = body;

  const { graph: g } = await resolveIdentityGraph(body.googleSub, profile as Record<string, unknown>);
  const finalQueries = buildVideoQueries(g);

  const searchResponses = await Promise.all(finalQueries.map(q => searchWeb(q, 4)));

  const seenUrls = new Set<string>();
  const allResults = searchResponses.flatMap(r => r.results).filter(r => {
    if (seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    return true;
  });

  const allImages = searchResponses.flatMap(r => r.images).slice(0, 10);
  const searchContext = formatResultsForAI(allResults, allImages);
  const identityBlock = videoIdentityBlock(g);

  const systemPrompt = `You are curating video content for someone with this identity across platforms:

${identityBlock}

Find videos that feel made for this person. Mix music videos from artists they listen to, channels they follow, and lifestyle content for their vibe.

Return JSON (no markdown):
{
  "message": "1 punchy sentence about what you found for them",
  "cards": [
    {
      "title": "Video title — Creator/Artist",
      "description": "2 sentences. What the video is and why they'd love it.",
      "price": "",
      "url": "MUST be a real YouTube/video URL from search results. If none, use https://www.youtube.com/results?search_query=ENCODED_QUERY",
      "category": "video",
      "match_score": 90,
      "match_reason": "Cite specific signals (artist, channel, aesthetic, city, tags) from their identity — not generic.",
      "emoji": "▶️",
      "image_hint": "2-3 word scene",
      "image_url": "Thumbnail from the same result row as url when listed; else Available images; else empty"
    }
  ]
}

Rules:
- Exactly 4 cards.
- Prioritise real YouTube URLs from search results.
- category MUST be "video" for all cards.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1800,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Find videos for this person.\n\nSearch results:\n${searchContext}\n\nReturn JSON.` }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
      const parsed = JSON.parse(stripped) as ChatResponse;
      const cards = Array.isArray(parsed.cards) ? finalizeSearchBackedCards(parsed.cards, allResults) : [];
      return json({ message: parsed.message ?? '', cards });
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as ChatResponse;
        const cards = Array.isArray(parsed.cards) ? finalizeSearchBackedCards(parsed.cards, allResults) : [];
        return json({ message: parsed.message ?? '', cards });
      }
      return json({ message: '', cards: [] });
    }
  } catch (e) {
    console.error('Videos API error:', e);
    return json({ message: '', cards: [] });
  }
};
