/**
 * Apple Music integration via MusicKit JS.
 *
 * Flow:
 *  1. This server generates a developer token (JWT signed with Apple private key)
 *  2. Frontend loads MusicKit JS, uses that token to authorize the user
 *  3. MusicKit gives us a musicUserToken
 *  4. We use both tokens to fetch library data from the Apple Music API
 *  5. Claude analyses the listening data into an AppleMusicIdentity
 *
 * Setup:
 *  1. Sign in at https://developer.apple.com/account/
 *  2. Identifiers → MusicKit IDs → register an identifier
 *  3. Keys → create a key with MusicKit capability → download .p8 file
 *  4. Add APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY to .env
 *     (APPLE_PRIVATE_KEY: full .p8 file as one line — newlines as \n; hundreds of chars, not ~64)
 *
 *  Credentials: prefer `$env/dynamic/private` (runtime process.env — production hosts), then fall back
 *  to `$env/static/private` (inlined at vite build when .env was present — matches pre-regression behavior).
 */

import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import {
  ANTHROPIC_API_KEY,
  APPLE_TEAM_ID as APPLE_TEAM_ID_BUILD,
  APPLE_KEY_ID as APPLE_KEY_ID_BUILD,
  APPLE_PRIVATE_KEY as APPLE_PRIVATE_KEY_BUILD,
} from '$env/static/private';
import { env } from '$env/dynamic/private';
import type {
  AppleMusicExplorePick,
  AppleMusicIdentity,
  AppleMusicLatestRelease,
  AppleMusicTrackHint,
} from '$lib/utils';

export { type AppleMusicIdentity };

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

function appleCredentials(): { team: string; keyId: string; privateKeyPem: string } {
  const team = (env.APPLE_TEAM_ID || APPLE_TEAM_ID_BUILD || '').trim();
  const keyId = (env.APPLE_KEY_ID || APPLE_KEY_ID_BUILD || '').trim();
  const privateKeyPem = (env.APPLE_PRIVATE_KEY || APPLE_PRIVATE_KEY_BUILD || '').trim();
  return { team, keyId, privateKeyPem };
}

export function isAppleMusicConfigured(): boolean {
  const { team, keyId, privateKeyPem } = appleCredentials();
  return !!(team && keyId && privateKeyPem);
}

/**
 * Generate a developer token (JWT) for MusicKit JS.
 * Valid for 1 hour — regenerated per page load.
 */
export function generateDeveloperToken(): string {
  const { team, keyId, privateKeyPem } = appleCredentials();
  if (!team || !keyId || !privateKeyPem) {
    throw new Error('Apple Music signing credentials missing');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: team, iat: now, exp: now + 3600 })).toString('base64url');
  const signingInput = `${header}.${payload}`;

  // Apple .p8 keys are PKCS#8 PEM — restore newlines that were flattened in .env.
  // If the user stored only the raw base64 body (no PEM headers), wrap it automatically.
  let pem = privateKeyPem.replace(/\\n/g, '\n').trim();
  if (!pem.includes('-----BEGIN')) {
    // Strip any accidental whitespace/newlines inside the raw base64 block
    const b64 = pem.replace(/\s+/g, '');
    pem = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
  }

  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  // dsaEncoding: 'ieee-p1363' gives raw r||s output required for ES256
  const signature = sign.sign(
    { key: pem, format: 'pem', type: 'pkcs8', dsaEncoding: 'ieee-p1363' } as Parameters<typeof sign.sign>[0],
    'base64url'
  );

  return `${signingInput}.${signature}`;
}

// ── Apple Music API helpers ────────────────────────────────────────────────

const AM_BASE = 'https://api.music.apple.com/v1';

function amHeaders(developerToken: string, userToken: string) {
  return {
    Authorization: `Bearer ${developerToken}`,
    'Music-User-Token': userToken,
  };
}

interface AMAttributes {
  name?: string;
  genreNames?: string[];
  /** Present on songs */
  artistName?: string;
  url?: string;
  artwork?: { url?: string };
}
interface AMResource {
  id?: string;
  type?: string;
  attributes?: AMAttributes;
}

export function appleMusicCatalogStorefront(): string {
  const s = env.APPLE_MUSIC_STOREFRONT?.trim();
  return s && /^[a-z]{2}$/i.test(s) ? s.toLowerCase() : 'us';
}

function artworkUrlSmall(attr?: AMAttributes): string | undefined {
  const tpl = attr?.artwork?.url;
  if (!tpl || typeof tpl !== 'string') return undefined;
  return tpl.replace('{w}', '120').replace('{h}', '120');
}

/** Catalog search (developer token only) for Explore discovery. */
export async function searchCatalogSongsForExplore(
  developerToken: string,
  storefront: string,
  term: string,
  limit: number,
  reason: string,
): Promise<AppleMusicExplorePick[]> {
  const q = term.trim();
  if (!q) return [];
  const url = `${AM_BASE}/catalog/${encodeURIComponent(storefront)}/search?term=${encodeURIComponent(q)}&types=songs&limit=${limit}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${developerToken}` } });
  if (!res.ok) return [];
  const j = (await res.json()) as { results?: { songs?: { data?: AMResource[] } } };
  const data = j.results?.songs?.data ?? [];
  const out: AppleMusicExplorePick[] = [];
  for (const item of data) {
    const title = item.attributes?.name?.trim();
    if (!title) continue;
    const id = item.id?.trim();
    out.push({
      title,
      artistName: item.attributes?.artistName?.trim() || undefined,
      appleMusicId: id,
      playAs: 'song',
      playUrl: item.attributes?.url?.trim() || undefined,
      artworkUrl: artworkUrlSmall(item.attributes),
      reason,
    });
  }
  return out;
}

function dedupeNames(names: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim();
    if (!n) continue;
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
    if (out.length >= cap) break;
  }
  return out;
}

async function fetchStorefront(developerToken: string, userToken: string): Promise<string | null> {
  const res = await fetch(`${AM_BASE}/me/storefront`, { headers: amHeaders(developerToken, userToken) });
  if (!res.ok) return null;
  const j = (await res.json()) as { data?: { id?: string }[] };
  const id = j.data?.[0]?.id;
  return id && typeof id === 'string' ? id : null;
}

async function fetchLatestReleasesForArtists(
  developerToken: string,
  userToken: string,
  storefront: string,
  pairs: { id: string; name: string }[],
): Promise<AppleMusicLatestRelease[]> {
  const headers = amHeaders(developerToken, userToken);
  const out: AppleMusicLatestRelease[] = [];
  const seen = new Set<string>();

  for (const { id, name } of pairs.slice(0, 6)) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const url = `${AM_BASE}/catalog/${encodeURIComponent(storefront)}/artists/${encodeURIComponent(id)}/albums?limit=1&sort=-releaseDate`;
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const j = (await res.json()) as { data?: { attributes?: { name?: string; releaseDate?: string } }[] };
      const item = j.data?.[0];
      const title = item?.attributes?.name?.trim();
      if (!title) continue;
      const releaseDate = item?.attributes?.releaseDate;
      out.push({
        artistName: name,
        title,
        releaseDate: typeof releaseDate === 'string' ? releaseDate : undefined,
      });
    } catch {
      /* skip artist */
    }
    if (out.length >= 5) break;
  }
  return out;
}

function dedupeTracks(tracks: AppleMusicTrackHint[], cap: number): AppleMusicTrackHint[] {
  const seen = new Set<string>();
  const out: AppleMusicTrackHint[] = [];
  for (const tr of tracks) {
    const t = tr.title.trim();
    if (!t) continue;
    const key = `${(tr.artistName ?? '').toLowerCase()}|${t.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: t,
      artistName: tr.artistName?.trim() || undefined,
      appleMusicId: tr.appleMusicId,
      playAs: tr.playAs,
      playUrl: tr.playUrl?.trim() || undefined,
    });
    if (out.length >= cap) break;
  }
  return out;
}

function trackHintFromSongOrLibraryItem(item: AMResource): AppleMusicTrackHint | null {
  const typ = (item.type ?? '').toLowerCase();
  if (typ !== 'songs' && typ !== 'library-songs') return null;
  const title = item.attributes?.name?.trim();
  if (!title) return null;
  const id = item.id?.trim();
  return {
    title,
    artistName: item.attributes?.artistName?.trim() || undefined,
    appleMusicId: id || undefined,
    playAs: 'song',
    playUrl: item.attributes?.url?.trim() || undefined,
  };
}

function parseHeavyRotation(items: AMResource[]): {
  artistOrder: { name: string; catalogId: string | null }[];
  rotationPlaylists: string[];
  rotationAlbums: string[];
  heavyRotationTracks: AppleMusicTrackHint[];
  genreSet: Set<string>;
} {
  const artistOrder: { name: string; catalogId: string | null }[] = [];
  const rotationPlaylists: string[] = [];
  const rotationAlbums: string[] = [];
  const heavyRotationTracks: AppleMusicTrackHint[] = [];
  const genreSet = new Set<string>();
  const seenArtist = new Set<string>();

  for (const item of items) {
    const name = item.attributes?.name?.trim();
    const t = (item.type ?? '').toLowerCase();

    if (t === 'songs' && name) {
      (item.attributes?.genreNames ?? []).forEach(g => genreSet.add(g));
      heavyRotationTracks.push({
        title: name,
        artistName: item.attributes?.artistName?.trim() || undefined,
        appleMusicId: item.id?.trim() || undefined,
        playAs: 'song',
        playUrl: item.attributes?.url?.trim() || undefined,
      });
      continue;
    }

    if (!name) continue;
    (item.attributes?.genreNames ?? []).forEach(g => genreSet.add(g));

    if (t === 'artists') {
      const k = name.toLowerCase();
      if (seenArtist.has(k)) continue;
      seenArtist.add(k);
      const id = item.id && /^\d+$/.test(item.id) ? item.id : null;
      artistOrder.push({ name, catalogId: id });
    } else if (t === 'playlists') {
      rotationPlaylists.push(name);
    } else if (t === 'albums') {
      rotationAlbums.push(name);
      // Heavy rotation is often albums, not singles — surface as listen hints (album + artist).
      heavyRotationTracks.push({
        title: name,
        artistName: item.attributes?.artistName?.trim() || undefined,
        appleMusicId: item.id?.trim() || undefined,
        playAs: 'album',
        playUrl: item.attributes?.url?.trim() || undefined,
      });
    } else if ((t === 'music-videos' || t === 'music-movies') && name) {
      heavyRotationTracks.push({
        title: name,
        artistName: item.attributes?.artistName?.trim() || undefined,
        appleMusicId: item.id?.trim() || undefined,
        playAs: 'song',
        playUrl: item.attributes?.url?.trim() || undefined,
      });
    }
  }
  return { artistOrder, rotationPlaylists, rotationAlbums, heavyRotationTracks, genreSet };
}

function tracksFromResourceList(items: AMResource[] | undefined): AppleMusicTrackHint[] {
  const rp: AppleMusicTrackHint[] = [];
  for (const item of items ?? []) {
    const h = trackHintFromSongOrLibraryItem(item);
    if (h) rp.push(h);
  }
  return dedupeTracks(rp, 20);
}

/** Fallback when Apple returns no heavy-rotation songs/albums and no recent plays. */
async function fetchLibrarySongHints(
  developerToken: string,
  userToken: string,
): Promise<AppleMusicTrackHint[]> {
  try {
    const res = await fetch(`${AM_BASE}/me/library/songs?limit=30`, {
      headers: amHeaders(developerToken, userToken),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { data?: AMResource[] };
    return tracksFromResourceList(j.data).slice(0, 10);
  } catch {
    return [];
  }
}

/** Fetch full library artist names — broader than heavy rotation. */
async function fetchLibraryArtists(
  developerToken: string,
  userToken: string,
): Promise<string[]> {
  try {
    const res = await fetch(`${AM_BASE}/me/library/artists?limit=50`, {
      headers: amHeaders(developerToken, userToken),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { data?: AMResource[] };
    return dedupeNames(
      (j.data ?? []).map(i => i.attributes?.name?.trim()).filter((n): n is string => Boolean(n)),
      40,
    );
  } catch {
    return [];
  }
}

/** Fetch songs the user explicitly "loved" — highest-intent music signal. */
async function fetchLovedSongs(
  developerToken: string,
  userToken: string,
): Promise<AppleMusicTrackHint[]> {
  try {
    const res = await fetch(`${AM_BASE}/me/ratings/songs?limit=40`, {
      headers: amHeaders(developerToken, userToken),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { data?: AMResource[] };
    const tracks: AppleMusicTrackHint[] = [];
    for (const item of j.data ?? []) {
      const title = item.attributes?.name?.trim();
      if (!title) continue;
      tracks.push({
        title,
        artistName: item.attributes?.artistName?.trim() || undefined,
        appleMusicId: item.id?.trim() || undefined,
        playAs: 'song',
        playUrl: item.attributes?.url?.trim() || undefined,
      });
    }
    return dedupeTracks(tracks, 20);
  } catch {
    return [];
  }
}

/** Fetch Apple's personalized recommendations — Apple's own inference about user taste. */
async function fetchRecommendations(
  developerToken: string,
  userToken: string,
): Promise<string[]> {
  try {
    const res = await fetch(`${AM_BASE}/me/recommendations?limit=10`, {
      headers: amHeaders(developerToken, userToken),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { data?: { attributes?: { title?: { stringForDisplay?: string } } }[] };
    return (j.data ?? [])
      .map(r => r.attributes?.title?.stringForDisplay?.trim())
      .filter((n): n is string => Boolean(n))
      .slice(0, 10);
  } catch {
    return [];
  }
}

export interface AppleMusicFetchedSnapshot {
  artists: string[];
  albums: string[];
  genres: string[];
  rotationPlaylists: string[];
  libraryPlaylistNames: string[];
  latestReleases: AppleMusicLatestRelease[];
  heavyRotationTracks: AppleMusicTrackHint[];
  recentlyPlayed: AppleMusicTrackHint[];
  libraryArtists: string[];
  lovedSongs: AppleMusicTrackHint[];
  recommendedNames: string[];
}

export async function fetchAppleMusicData(
  developerToken: string,
  userToken: string,
): Promise<AppleMusicFetchedSnapshot> {
  const headers = amHeaders(developerToken, userToken);

  const [storefrontRes, heavyRes, albumsRes, playlistsRes, recentRes, libraryArtistsRes, lovedSongsRes, recommendationsRes] = await Promise.all([
    fetchStorefront(developerToken, userToken),
    fetch(`${AM_BASE}/me/history/heavy-rotation?limit=25`, { headers }),
    fetch(`${AM_BASE}/me/library/albums?limit=20`, { headers }),
    fetch(`${AM_BASE}/me/library/playlists?limit=20`, { headers }),
    // Correct path per Apple docs — `/me/recent/played` is not the tracks endpoint.
    fetch(`${AM_BASE}/me/recent/played/tracks?limit=20`, { headers }),
    fetchLibraryArtists(developerToken, userToken),
    fetchLovedSongs(developerToken, userToken),
    fetchRecommendations(developerToken, userToken),
  ]);

  const heavy: AMResource[] = heavyRes.ok ? ((await heavyRes.json()).data ?? []) : [];
  const libAlbums: AMResource[] = albumsRes.ok ? ((await albumsRes.json()).data ?? []) : [];
  const libPlaylistsRaw: AMResource[] = playlistsRes.ok ? ((await playlistsRes.json()).data ?? []) : [];

  const { artistOrder, rotationPlaylists, rotationAlbums, heavyRotationTracks, genreSet } =
    parseHeavyRotation(heavy);

  let recentlyPlayed: AppleMusicTrackHint[] = [];
  if (recentRes.ok) {
    const j = (await recentRes.json()) as { data?: AMResource[] };
    recentlyPlayed = tracksFromResourceList(j.data).slice(0, 10);
  }

  let heavyOut = dedupeTracks(heavyRotationTracks, 12);
  if (!recentlyPlayed.length && !heavyOut.length) {
    const lib = await fetchLibrarySongHints(developerToken, userToken);
    if (lib.length) heavyOut = dedupeTracks([...heavyOut, ...lib], 12);
  }

  const libAlbumNames = libAlbums
    .map(i => i.attributes?.name?.trim())
    .filter((n): n is string => Boolean(n));

  const albumNames = dedupeNames([...libAlbumNames, ...rotationAlbums], 14);

  libAlbums.forEach(i => (i.attributes?.genreNames ?? []).forEach(g => genreSet.add(g)));
  genreSet.delete('Music');

  const libraryPlaylistNames = dedupeNames(
    libPlaylistsRaw.map(i => i.attributes?.name?.trim()).filter((n): n is string => Boolean(n)),
    12,
  );

  const artists = artistOrder.map(a => a.name).slice(0, 10);
  const artistCatalogPairs = artistOrder
    .filter(a => a.catalogId !== null)
    .map(a => ({ id: a.catalogId!, name: a.name }))
    .slice(0, 8);

  const storefront = storefrontRes;
  let latestReleases: AppleMusicLatestRelease[] = [];
  if (storefront && artistCatalogPairs.length) {
    latestReleases = await fetchLatestReleasesForArtists(
      developerToken,
      userToken,
      storefront,
      artistCatalogPairs,
    );
  }

  return {
    artists,
    albums: albumNames,
    genres: [...genreSet].slice(0, 10),
    rotationPlaylists: dedupeNames(rotationPlaylists, 10),
    libraryPlaylistNames,
    latestReleases,
    heavyRotationTracks: heavyOut,
    recentlyPlayed,
    libraryArtists: libraryArtistsRes,
    lovedSongs: lovedSongsRes,
    recommendedNames: recommendationsRes,
  };
}

export async function analyseAppleMusicIdentity(
  artists: string[],
  albums: string[],
  genres: string[],
  rotationPlaylists: string[],
  libraryPlaylists: string[],
  latestReleases: AppleMusicLatestRelease[],
  heavyRotationTracks: AppleMusicTrackHint[],
  recentlyPlayed: AppleMusicTrackHint[],
): Promise<AppleMusicIdentity> {
  const trackLine = (xs: AppleMusicTrackHint[]) =>
    xs.slice(0, 8).map(t => (t.artistName ? `${t.artistName} — ${t.title}` : t.title)).join('; ');

  const empty = (): AppleMusicIdentity => ({
    topArtists: [],
    topAlbums: [],
    topGenres: genres,
    musicPersonality: '',
    vibeDescription: '',
    rotationPlaylists,
    libraryPlaylists,
    latestReleases,
    heavyRotationTracks,
    recentlyPlayed,
  });

  const hasAnything =
    artists.length ||
    albums.length ||
    rotationPlaylists.length ||
    libraryPlaylists.length ||
    latestReleases.length ||
    heavyRotationTracks.length ||
    recentlyPlayed.length;
  if (!hasAnything) {
    return empty();
  }

  const drops = latestReleases.map(r => `${r.artistName}: ${r.title}`).join('; ');

  const prompt = `Analyse this Apple Music listening data and describe the person's music personality in 1-2 sentences.

Heavy rotation artists: ${artists.join(', ')}
Heavy rotation songs: ${trackLine(heavyRotationTracks) || '—'}
Recently played songs: ${trackLine(recentlyPlayed) || '—'}
Albums in library / rotation: ${albums.join(', ')}
Genres: ${genres.join(', ')}
Playlists on repeat (heavy rotation): ${rotationPlaylists.join(', ') || '—'}
Other library playlists: ${libraryPlaylists.join(', ') || '—'}
Newest catalog drops from those artists: ${drops || '—'}

Return JSON only (no markdown):
{
  "musicPersonality": "concise 1-sentence description of their music taste",
  "vibeDescription": "one punchy phrase e.g. 'alt-pop with indie edge'"
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
      topArtists: artists,
      topAlbums: albums,
      topGenres: genres,
      rotationPlaylists,
      libraryPlaylists,
      latestReleases,
      heavyRotationTracks,
      recentlyPlayed,
      musicPersonality: parsed.musicPersonality ?? genres.slice(0, 3).join(', '),
      vibeDescription: parsed.vibeDescription ?? '',
    };
  } catch {
    return {
      topArtists: artists,
      topAlbums: albums,
      topGenres: genres,
      rotationPlaylists,
      libraryPlaylists,
      latestReleases,
      heavyRotationTracks,
      recentlyPlayed,
      musicPersonality: genres.slice(0, 3).join(', '),
      vibeDescription: '',
    };
  }
}
