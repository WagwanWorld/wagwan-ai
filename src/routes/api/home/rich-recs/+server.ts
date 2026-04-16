/**
 * POST /api/home/rich-recs
 * Returns image-rich recommendations across categories: movies, books, music, restaurants, events.
 * Uses Claude to generate personalized picks, then fetches real images from TMDB + Google Books.
 * Cached for 24hr.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCached, setCached } from '$lib/server/contentCache';
import { getProfile } from '$lib/server/supabase';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';
import { backgroundCompleteJson } from '$lib/server/llm/backgroundLlm';
import { searchMovies, searchBooks } from '$lib/server/richRecs';

interface RecItem {
  title: string;
  subtitle: string;
  image: string;
  tag: string;
  matchReason: string;
  ctaLabel: string;
  ctaUrl: string;
}

interface RichRecsPayload {
  movies: RecItem[];
  books: RecItem[];
  music: RecItem[];
  restaurants: RecItem[];
}

export const POST: RequestHandler = async ({ request }) => {
  let body: { googleSub?: string; profile?: Record<string, unknown> };
  try { body = await request.json(); } catch { return json({ ok: false }, { status: 400 }); }

  const sub = (body.googleSub || '').trim();
  if (!sub) return json({ ok: false, error: 'missing_sub' }, { status: 400 });

  // Check cache
  const cached = await getCached<RichRecsPayload>(sub, 'rich_recs');
  if (cached) return json({ ok: true, ...cached.payload, cached: true });

  try {
    const profileRow = await getProfile(sub);
    const profileData = (profileRow?.profile_data ?? body.profile ?? {}) as Record<string, unknown>;
    const { graph: g, summary } = await resolveIdentityGraph(sub, profileData);

    const city = (profileData.city as string)?.trim() || g.city || 'India';
    const musicArtists = (g.topArtists || []).slice(0, 5).join(', ');
    const genres = (g.topGenres || []).slice(0, 5).join(', ');
    const interests = (g.activities || []).slice(0, 5).join(', ');

    // Ask Claude for personalized picks across categories
    const llmResult = await backgroundCompleteJson<{
      movies: { title: string; why: string }[];
      books: { title: string; author: string; why: string }[];
      restaurants: { name: string; cuisine: string; why: string }[];
    }>(
      'You are their closest friend recommending stuff. Confident, casual, no hedging. Return only valid JSON.',
      `You know this person inside out. Recommend things they would genuinely love.

WHO THEY ARE: ${summary}
CITY: ${city}
MUSIC TASTE: ${musicArtists}
GENRES: ${genres}
INTO: ${interests}

Return JSON with:
- "movies": 4 movies/shows. Each: { "title": "exact title", "why": "casual 1-liner like a friend would say it — no data speak" }
- "books": 3 books. Each: { "title": "exact title", "author": "author", "why": "casual 1-liner" }
- "restaurants": 3 spots in ${city}. Each: { "name": "real restaurant name", "cuisine": "type", "why": "casual 1-liner" }

Rules:
- Pick REAL, SPECIFIC titles and places — not generic filler
- "why" should sound like texting a friend: "trust me you'll love this" not "aligns with your preferences"
- No hedging, no "you might enjoy", no "based on your profile"
Return ONLY valid JSON: { "movies": [...], "books": [...], "restaurants": [...] }`,
      2000
    );

    const movieTitles = llmResult?.movies?.map(m => m.title) ?? [];
    const bookItems = llmResult?.books?.map(b => ({ title: b.title, author: b.author })) ?? [];

    // Fetch real images in parallel
    const [movieImages, bookImages] = await Promise.all([
      searchMovies(movieTitles),
      searchBooks(bookItems),
    ]);

    // Build movie recs
    const movies: RecItem[] = (llmResult?.movies ?? []).map(m => {
      const img = movieImages[m.title];
      return {
        title: img?.title || m.title,
        subtitle: img?.year ? `${img.year} · ${(img.rating || 0).toFixed(1)}` : '',
        image: img?.posterUrl || '',
        tag: 'Movie',
        matchReason: m.why || '',
        ctaLabel: 'Watch on Netflix',
        ctaUrl: `https://www.netflix.com/search?q=${encodeURIComponent(m.title)}`,
      };
    });

    // Build book recs
    const books: RecItem[] = (llmResult?.books ?? []).map(b => {
      const img = bookImages[b.title];
      return {
        title: img?.title || b.title,
        subtitle: img?.author || b.author || '',
        image: img?.coverUrl || '',
        tag: 'Book',
        matchReason: b.why || '',
        ctaLabel: 'Buy on Amazon',
        ctaUrl: img?.buyUrl || `https://www.amazon.in/s?k=${encodeURIComponent(`${b.title} ${b.author}`)}`,
      };
    });

    // Build music recs from existing identity data
    const am = profileData.appleMusicIdentity as Record<string, unknown> | undefined;
    const sp = profileData.spotifyIdentity as Record<string, unknown> | undefined;
    const artworkMap = (am as any)?.artworkMap as Record<string, string> | undefined ?? {};
    const topArtists = ((am as any)?.topArtists || (sp as any)?.topArtists || []) as string[];
    const recentTracks = ((am as any)?.recentlyPlayed || []) as Array<{ title: string; artistName?: string; artworkUrl?: string }>;

    const music: RecItem[] = recentTracks.slice(0, 4).map(t => ({
      title: t.title,
      subtitle: t.artistName || '',
      image: t.artworkUrl || artworkMap[t.artistName || ''] || '',
      tag: 'Track',
      matchReason: '',
      ctaLabel: 'Play on Spotify',
      ctaUrl: `https://open.spotify.com/search/${encodeURIComponent(`${t.title} ${t.artistName || ''}`)}`,
    })).filter(m => m.image);

    // If no recent tracks with art, use top artists
    if (music.length === 0) {
      for (const artist of topArtists.slice(0, 4)) {
        const art = artworkMap[artist];
        if (art) {
          music.push({
            title: artist,
            subtitle: 'Top Artist',
            image: art,
            tag: 'Artist',
            matchReason: '',
            ctaLabel: 'Listen',
            ctaUrl: `https://open.spotify.com/search/${encodeURIComponent(artist)}`,
          });
        }
      }
    }

    // Build restaurant recs (no images — use fallback)
    const restaurants: RecItem[] = (llmResult?.restaurants ?? []).map(r => ({
      title: r.name,
      subtitle: r.cuisine || '',
      image: '', // No reliable free image API for restaurants
      tag: 'Restaurant',
      matchReason: r.why || '',
      ctaLabel: 'View on Zomato',
      ctaUrl: `https://www.zomato.com/${city.toLowerCase()}/search?q=${encodeURIComponent(r.name)}`,
    }));

    const payload: RichRecsPayload = { movies, books, music, restaurants };
    await setCached(sub, 'rich_recs', payload);

    return json({ ok: true, ...payload, cached: false });
  } catch (e: any) {
    console.error('[rich-recs] Error:', e.message, e.stack);
    return json({ ok: false, error: e.message, movies: [], books: [], music: [], restaurants: [], cached: false });
  }
};
