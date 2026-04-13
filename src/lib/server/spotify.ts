/**
 * Spotify OAuth + top listening data.
 *
 * Setup:
 *  1. Create an app at https://developer.spotify.com/dashboard
 *  2. Add redirect URI: {PUBLIC_BASE_URL}/auth/spotify/callback
 *  3. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env
 *
 * Scopes used: user-top-read user-read-recently-played playlist-read-private
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';
import type { SpotifyIdentity } from '$lib/utils';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const REDIRECT_URI = `${PUBLIC_BASE_URL}/auth/spotify/callback`;

export { type SpotifyIdentity };

export function isSpotifyConfigured(): boolean {
  return !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
}

export function getSpotifyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'user-top-read user-read-recently-played playlist-read-private',
    state,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeSpotifyCode(code: string): Promise<string> {
  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token exchange failed: ${err}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

interface SpotifyArtist {
  name: string;
  genres: string[];
}

interface SpotifyTrack {
  name: string;
  artists: Array<{ name: string }>;
  id?: string;
}

interface SpotifyAudioFeatures {
  valence: number;
  energy: number;
  danceability: number;
  tempo: number;
}

function genreHistogram(artists: SpotifyArtist[]): { genres: string[]; topGenres: string[] } {
  const allGenres = artists.flatMap(a => a.genres);
  const genreCount: Record<string, number> = {};
  for (const g of allGenres) genreCount[g] = (genreCount[g] || 0) + 1;
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([g]) => g);
  return { genres: allGenres, topGenres };
}

function moodTagsFromFeatures(features: SpotifyAudioFeatures[]): string[] {
  if (!features.length) return [];
  const n = features.length;
  const avg = (k: keyof SpotifyAudioFeatures) =>
    features.reduce((s, f) => s + (f[k] as number), 0) / n;
  const valence = avg('valence');
  const energy = avg('energy');
  const dance = avg('danceability');
  const tags = new Set<string>();
  if (energy > 0.65 && valence > 0.55) {
    tags.add('high_energy');
    tags.add('party_mood');
  } else if (energy < 0.45 && valence < 0.45) {
    tags.add('chill');
    tags.add('low_key_mood');
  } else if (valence < 0.4 && energy > 0.5) {
    tags.add('intense');
  } else if (valence > 0.65) {
    tags.add('upbeat');
  }
  if (dance > 0.65) tags.add('dance_floor');
  if (avg('tempo') > 130) tags.add('fast_tempo');
  else if (avg('tempo') < 95) tags.add('slow_tempo');
  return [...tags];
}

const PLAYLIST_LIFESTYLE: Array<{ re: RegExp; tags: string[] }> = [
  { re: /\b(gym|workout|run|lift|cardio|training)\b/i, tags: ['gym_music', 'fitness_listener'] },
  { re: /\b(focus|study|deep\s*work|concentrat|code|flow)\b/i, tags: ['focus_music', 'productivity_listener'] },
  { re: /\b(party|pregame|rage|turn\s*up|club)\b/i, tags: ['party_playlist', 'nightlife_music'] },
  { re: /\b(chill|relax|sleep|lo[- ]?fi|ambient)\b/i, tags: ['chill_playlist', 'relax_listener'] },
  { re: /\b(road\s*trip|drive|highway)\b/i, tags: ['road_trip_music'] },
];

function lifestyleFromPlaylists(names: string[]): string[] {
  const out = new Set<string>();
  for (const name of names) {
    for (const { re, tags } of PLAYLIST_LIFESTYLE) {
      if (re.test(name)) for (const t of tags) out.add(t);
    }
  }
  return [...out];
}

function cultureTagsFromGenres(genres: string[]): string[] {
  const g = genres.join(' ').toLowerCase();
  const out = new Set<string>();
  if (/techno|house|edm|electronic/.test(g)) out.add('electronic_scene');
  if (/hip\s*hop|rap|trap/.test(g)) out.add('hip_hop_culture');
  if (/indie|alternative/.test(g)) out.add('indie_listener');
  if (/pop|dance\s*pop/.test(g)) out.add('pop_listener');
  if (/metal|punk|rock/.test(g)) out.add('rock_metal_listener');
  if (/jazz|soul|funk|r&b/.test(g)) out.add('soul_jazz_listener');
  if (/classical|orchestral/.test(g)) out.add('classical_listener');
  if (/afro|amapiano|reggaeton|latin/.test(g)) out.add('global_bass_listener');
  return [...out];
}

function intentFromMusic(
  lifestyle: string[],
  culture: string[],
  genreNames: string[],
): SpotifyIdentity['musicIntentHints'] {
  const hints: SpotifyIdentity['musicIntentHints'] = [];
  const g = genreNames.join(' ').toLowerCase();
  if (lifestyle.some(t => t.includes('party') || t.includes('nightlife'))) {
    hints.push({ intent: 'nightlife', confidence: 0.72, time_horizon: 'weekend' });
  }
  if (lifestyle.some(t => t.includes('gym') || t.includes('fitness'))) {
    hints.push({ intent: 'fitness_routine', confidence: 0.68, time_horizon: 'ongoing' });
  }
  if (culture.includes('electronic_scene') && /techno|house|edm/.test(g)) {
    hints.push({ intent: 'club_events', confidence: 0.6, time_horizon: 'weekend' });
  }
  return hints;
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

export async function fetchSpotifyTopData(token: string): Promise<{ artists: SpotifyArtist[]; tracks: SpotifyTrack[] }> {
  const enriched = await fetchSpotifyEnrichedData(token);
  return { artists: enriched.artistsMedium, tracks: enriched.tracksMedium };
}

export interface SpotifyEnrichedFetch {
  artistsShort: SpotifyArtist[];
  artistsMedium: SpotifyArtist[];
  artistsLong: SpotifyArtist[];
  tracksMedium: SpotifyTrack[];
  recentTracks: SpotifyTrack[];
  playlistNames: string[];
  audioFeatureMoodTags: string[];
}

export async function fetchSpotifyEnrichedData(token: string): Promise<SpotifyEnrichedFetch> {
  const headers = { Authorization: `Bearer ${token}` };

  const [shortA, medA, longA, medT, recent, playlists] = await Promise.all([
    fetchJson<{ items: SpotifyArtist[] }>(
      'https://api.spotify.com/v1/me/top/artists?limit=10&time_range=short_term',
      headers,
    ),
    fetchJson<{ items: SpotifyArtist[] }>(
      'https://api.spotify.com/v1/me/top/artists?limit=12&time_range=medium_term',
      headers,
    ),
    fetchJson<{ items: SpotifyArtist[] }>(
      'https://api.spotify.com/v1/me/top/artists?limit=10&time_range=long_term',
      headers,
    ),
    fetchJson<{ items: SpotifyTrack[] }>(
      'https://api.spotify.com/v1/me/top/tracks?limit=12&time_range=medium_term',
      headers,
    ),
    fetchJson<{ items: { track: SpotifyTrack | null }[] }>(
      'https://api.spotify.com/v1/me/player/recently-played?limit=20',
      headers,
    ),
    fetchJson<{ items: { name?: string }[] }>(
      'https://api.spotify.com/v1/me/playlists?limit=15',
      headers,
    ),
  ]);

  const artistsShort = shortA?.items ?? [];
  const artistsMedium = medA?.items ?? [];
  const artistsLong = longA?.items ?? [];
  const tracksMedium = medT?.items ?? [];
  const recentTracks = (recent?.items ?? [])
    .map(x => x.track)
    .filter((t): t is SpotifyTrack => !!t && !!t.name);

  const playlistNames = (playlists?.items ?? [])
    .map(p => p.name?.trim())
    .filter((n): n is string => !!n);

  const idSet = new Set<string>();
  for (const t of tracksMedium) {
    if (t.id) idSet.add(t.id);
  }
  for (const t of recentTracks) {
    if (t.id) idSet.add(t.id);
  }
  const ids = [...idSet].slice(0, 25);
  let audioMood: string[] = [];
  if (ids.length) {
    const af = await fetchJson<{ audio_features: (SpotifyAudioFeatures | null)[] }>(
      `https://api.spotify.com/v1/audio-features?ids=${encodeURIComponent(ids.join(','))}`,
      headers,
    );
    const feats = (af?.audio_features ?? []).filter((x): x is SpotifyAudioFeatures => !!x);
    audioMood = moodTagsFromFeatures(feats);
  }

  return {
    artistsShort,
    artistsMedium,
    artistsLong,
    tracksMedium,
    recentTracks,
    playlistNames,
    audioFeatureMoodTags: audioMood,
  };
}

/** Legacy: artists+tracks only (no playlists/audio features). Prefer fetchSpotifyEnrichedData + analyseSpotifyIdentityEnriched. */
export async function analyseSpotifyIdentity(
  artists: SpotifyArtist[],
  tracks: SpotifyTrack[],
): Promise<SpotifyIdentity> {
  const data: SpotifyEnrichedFetch = {
    artistsShort: artists.slice(0, 10),
    artistsMedium: artists,
    artistsLong: artists.slice(0, 10),
    tracksMedium: tracks,
    recentTracks: [],
    playlistNames: [],
    audioFeatureMoodTags: [],
  };
  return analyseSpotifyIdentityEnriched(data);
}

export async function analyseSpotifyIdentityEnriched(data: SpotifyEnrichedFetch): Promise<SpotifyIdentity> {
  const artists = data.artistsMedium;
  const tracks = data.tracksMedium;
  const topArtists = artists.slice(0, 8).map(a => a.name);
  const { topGenres } = genreHistogram([...data.artistsShort, ...artists, ...data.artistsLong]);
  const topTracks = tracks.slice(0, 6).map(t => `${t.name} — ${t.artists[0]?.name ?? ''}`);

  const artistsShortTerm = data.artistsShort.slice(0, 8).map(a => a.name);
  const artistsLongTerm = data.artistsLong.slice(0, 8).map(a => a.name);
  const recentTrackTitles = data.recentTracks.slice(0, 10).map(t => `${t.name} — ${t.artists[0]?.name ?? ''}`);

  const musicLifestyleTags = lifestyleFromPlaylists(data.playlistNames);
  const allGenreStrings = [...data.artistsShort, ...artists, ...data.artistsLong].flatMap(a => a.genres);
  const musicCultureTags = cultureTagsFromGenres(allGenreStrings);
  const musicDescriptorTags = [...new Set([...topGenres.slice(0, 6), ...data.audioFeatureMoodTags])];
  const listeningBehaviorTags: string[] = [];
  if (data.recentTracks.length >= 12) listeningBehaviorTags.push('active_listener');
  if (artistsShortTerm.length && artistsLongTerm.length) {
    const overlap = artistsShortTerm.filter(a => artistsLongTerm.includes(a)).length;
    if (overlap <= 2 && artistsShortTerm.length >= 4) listeningBehaviorTags.push('exploring_new_music');
  }

  const musicIntentHints = intentFromMusic(musicLifestyleTags, musicCultureTags, topGenres);

  if (!topArtists.length) {
    return {
      topArtists: [],
      topGenres: [],
      topTracks: [],
      musicPersonality: '',
      vibeDescription: '',
    };
  }

  const prompt = `Analyse this Spotify listening data and describe this person's music personality briefly.

Top artists (medium): ${topArtists.join(', ')}
Top genres: ${topGenres.slice(0, 6).join(', ')}
Top tracks: ${topTracks.join(', ')}
Playlist themes (names only): ${data.playlistNames.slice(0, 8).join(', ')}
Mood tags (from audio features): ${data.audioFeatureMoodTags.join(', ')}

Return JSON only (no markdown):
{
  "musicPersonality": "concise 1-sentence description of their music taste and personality",
  "vibeDescription": "one punchy phrase e.g. 'late-night R&B with rap edge'"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    return {
      topArtists,
      topGenres: topGenres.slice(0, 6),
      topTracks,
      musicPersonality: parsed.musicPersonality ?? topGenres.slice(0, 3).join(', '),
      vibeDescription: parsed.vibeDescription ?? '',
      artistsShortTerm,
      artistsLongTerm,
      recentTrackTitles,
      playlistNames: data.playlistNames.slice(0, 15),
      audioFeatureMoodTags: data.audioFeatureMoodTags,
      musicDescriptorTags,
      musicLifestyleTags,
      musicCultureTags,
      listeningBehaviorTags,
      musicIntentHints,
    };
  } catch {
    return {
      topArtists,
      topGenres: topGenres.slice(0, 6),
      topTracks,
      musicPersonality: topGenres.slice(0, 3).join(', '),
      vibeDescription: '',
      artistsShortTerm,
      artistsLongTerm,
      recentTrackTitles,
      playlistNames: data.playlistNames.slice(0, 15),
      audioFeatureMoodTags: data.audioFeatureMoodTags,
      musicDescriptorTags,
      musicLifestyleTags,
      musicCultureTags,
      listeningBehaviorTags,
      musicIntentHints,
    };
  }
}
