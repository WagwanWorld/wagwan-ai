/**
 * iTunes Search API (public, no key) — artist and album artwork with in-memory cache.
 * https://performance-partners.apple.com/search-api
 */

const cache = new Map<string, string | undefined>();
const inflight = new Map<string, Promise<string | undefined>>();

async function runCached(
  key: string,
  fn: () => Promise<string | undefined>
): Promise<string | undefined> {
  if (cache.has(key)) return cache.get(key);
  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    try {
      const v = await fn();
      cache.set(key, v);
      return v;
    } catch {
      cache.set(key, undefined);
      return undefined;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

export function upscaleItunesArtworkUrl(
  url: string,
  size: '300' | '400' | '600' = '400'
): string {
  return url
    .replace(/100x100bb/g, `${size}x${size}bb`)
    .replace(/60x60bb/g, `${size}x${size}bb`)
    .replace(/30x30bb/g, `${size}x${size}bb`);
}

function cacheKeyArtist(term: string): string {
  return `a:${term.trim().toLowerCase()}`;
}

function cacheKeyAlbum(artist: string, album: string): string {
  return `b:${artist.trim().toLowerCase()}|${album.trim().toLowerCase()}`;
}

/**
 * Artist artwork URL, or undefined if not found.
 */
export async function getArtistArtwork(artist: string): Promise<string | undefined> {
  const term = artist.trim();
  if (!term) return undefined;
  const key = cacheKeyArtist(term);
  return runCached(key, async () => {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=musicArtist&limit=1`
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { results?: { artworkUrl100?: string }[] };
    const raw = data.results?.[0]?.artworkUrl100;
    if (!raw) return undefined;
    return upscaleItunesArtworkUrl(raw);
  });
}

/**
 * Album cover URL when artist + album title are known.
 */
export async function getAlbumArtwork(artist: string, album: string): Promise<string | undefined> {
  const a = artist.trim();
  const b = album.trim();
  if (!a || !b) return undefined;
  const key = cacheKeyAlbum(a, b);
  return runCached(key, async () => {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(`${a} ${b}`)}&entity=album&limit=4`
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      results?: { artworkUrl100?: string; artistName?: string; collectionName?: string }[];
    };
    const results = data.results ?? [];
    const exact =
      results.find(
        r =>
          r.artistName?.toLowerCase().includes(a.toLowerCase()) &&
          r.collectionName?.toLowerCase().includes(b.toLowerCase())
      ) ?? results[0];
    const raw = exact?.artworkUrl100;
    if (!raw) return undefined;
    return upscaleItunesArtworkUrl(raw);
  });
}

/**
 * Fetch artwork for multiple artist names in parallel; returns only successful hits keyed by original term.
 */
export async function prefetchArtistArtwork(terms: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(terms.map(t => t.trim()).filter(Boolean))];
  const out: Record<string, string> = {};
  await Promise.all(
    unique.map(async t => {
      const url = await getArtistArtwork(t);
      if (url) out[t] = url;
    })
  );
  return out;
}
