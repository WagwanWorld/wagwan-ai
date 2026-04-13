/**
 * Web search via [Brave Search API](https://api.search.brave.com/).
 *
 * Env: `BRAVE_API_KEY` — subscription token from https://api-dashboard.search.brave.com/
 * Header: `X-Subscription-Token` (not a query param).
 *
 * Cost control: in-memory TTL cache + in-flight dedupe (same query in parallel = 1 Brave call).
 * We use `result_filter=web` only (one HTTP request per search; images skipped to save quota noise).
 *
 * Optional: `BRAVE_CACHE_TTL_MS` (milliseconds, min 60000) — overrides default 12-minute cache TTL.
 * Optional: `BRAVE_EMPTY_RESULT_RETRIES` (0–2) — extra attempts when Brave returns zero results (default 0).
 * Optional: `REDIS_URL` — shared Brave response cache across Node instances (see redisCache.ts).
 */

import { BRAVE_API_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { buildIdentityGraph, type IdentityGraph } from './identity';
import type { ResultCard } from '$lib/utils';
import { redisGetJson, redisSetJson } from './redisCache';

const BRAVE_WEB_SEARCH = 'https://api.search.brave.com/res/v1/web/search';

/** Trim .env value and strip accidental quotes around the token. */
function normalizeBraveToken(raw: string): string {
  let t = (raw ?? '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  extra_snippets?: string[];
  /** Brave web result thumbnail (page preview) — use for card images when URL matches. */
  thumbnail_url?: string;
}

export type SearchWebResponse = { results: SearchResult[], images: string[] };

const DEFAULT_SEARCH_CACHE_TTL_MS = 12 * 60 * 1000; // 12 minutes
const SEARCH_CACHE_MAX_ENTRIES = 500;

function searchCacheTtlMs(): number {
  const raw = env.BRAVE_CACHE_TTL_MS;
  if (raw == null || String(raw).trim() === '') return DEFAULT_SEARCH_CACHE_TTL_MS;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_SEARCH_CACHE_TTL_MS;
  return Math.min(Math.max(n, 60_000), 24 * 60 * 60 * 1000);
}

type CacheEntry = { expires: number; data: SearchWebResponse };
const searchCache = new Map<string, CacheEntry>();
const searchInflight = new Map<string, Promise<SearchWebResponse>>();

function searchDedupeKey(query: string, count: number, includeDomains?: string[]): string {
  const d = includeDomains?.length ? [...includeDomains].sort().join('|') : '';
  return `${Math.min(Math.max(count, 1), 20)}|${d}|${query.trim().slice(0, 600)}`;
}

function pruneSearchCache() {
  const now = Date.now();
  for (const [k, v] of searchCache) {
    if (v.expires <= now) searchCache.delete(k);
  }
  while (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
    const first = searchCache.keys().next().value;
    if (first === undefined) break;
    searchCache.delete(first);
  }
}

function cacheSnapshot(data: SearchWebResponse): SearchWebResponse {
  return {
    results: data.results.map(r => ({ ...r, extra_snippets: r.extra_snippets ? [...r.extra_snippets] : undefined })),
    images: [...data.images],
  };
}

// Indian event discovery platforms — used exclusively for event/nightlife queries
export const EVENT_DOMAINS = [
  'in.bookmyshow.com',
  'district.in',
  'urbanaut.app',
  'skillboxes.com',
  'sortmyscene.com',
];

function buildBraveQuery(query: string, includeDomains?: string[]): string {
  let q = query.trim();
  if (includeDomains?.length) {
    const sites = includeDomains
      .map(d => d.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0])
      .filter(Boolean)
      .map(d => `site:${d}`)
      .join(' OR ');
    q = `(${sites}) ${q}`;
  }
  // Brave: max 400 chars, ~50 words — hard cap length
  if (q.length > 400) q = q.slice(0, 397) + '...';
  return q;
}

function extractImageUrls(data: {
  images?: { results?: Array<{ properties?: { url?: string }; thumbnail?: { src?: string } }> };
}): string[] {
  const urls: string[] = [];
  for (const r of data.images?.results ?? []) {
    const u = r.properties?.url ?? r.thumbnail?.src;
    if (u && typeof u === 'string') urls.push(u);
  }
  return [...new Set(urls)].slice(0, 12);
}

// ── Circuit breaker ──────────────────────────────────────────────────────
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_DURATION_MS = 60_000;

/**
 * Web search via Brave (cached + deduped + retry + circuit breaker).
 */
export async function searchWeb(
  query: string,
  count = 6,
  includeDomains?: string[],
): Promise<SearchWebResponse> {
  const token = normalizeBraveToken(BRAVE_API_KEY ?? '');
  if (!token) {
    console.warn('BRAVE_API_KEY not set — skipping web search');
    return { results: [], images: [] };
  }

  if (Date.now() < circuitOpenUntil) {
    console.warn('Brave circuit breaker open — returning empty results');
    return { results: [], images: [] };
  }

  const q = buildBraveQuery(query, includeDomains);
  const n = Math.min(Math.max(count, 1), 20);
  const key = searchDedupeKey(q, n, includeDomains);

  const now = Date.now();
  pruneSearchCache();
  const hit = searchCache.get(key);
  if (hit && hit.expires > now) {
    return cacheSnapshot(hit.data);
  }

  const redisKey = `wagwan:brave:v1:${key}`;
  const rHit = await redisGetJson<SearchWebResponse>(redisKey);
  if (rHit?.results && Array.isArray(rHit.results)) {
    const snap = cacheSnapshot(rHit);
    searchCache.set(key, { expires: Date.now() + searchCacheTtlMs(), data: snap });
    return snap;
  }

  const pending = searchInflight.get(key);
  if (pending) return cacheSnapshot(await pending);

  const promise = (async (): Promise<SearchWebResponse> => {
    try {
      return await executeBraveSearchWithRetry(token, q, n);
    } finally {
      searchInflight.delete(key);
    }
  })();

  searchInflight.set(key, promise);
  const fresh = await promise;
  const snap = cacheSnapshot(fresh);
  const ttlMs = searchCacheTtlMs();
  searchCache.set(key, { expires: Date.now() + ttlMs, data: snap });
  pruneSearchCache();
  void redisSetJson(redisKey, snap, Math.ceil(ttlMs / 1000));
  return snap;
}

async function executeBraveSearchWithRetry(token: string, q: string, n: number): Promise<SearchWebResponse> {
  const rawRetry = env.BRAVE_EMPTY_RESULT_RETRIES;
  const retries =
    rawRetry != null && String(rawRetry).trim() !== ''
      ? Math.min(Math.max(Number(rawRetry), 0), 2)
      : 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await executeBraveSearchOnce(token, q, n);
    if (result.results.length > 0) {
      consecutiveFailures = 0;
      return result;
    }
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_OPEN_DURATION_MS;
    console.warn(`Brave circuit breaker OPEN after ${consecutiveFailures} failures — pausing for ${CIRCUIT_OPEN_DURATION_MS / 1000}s`);
  }
  return { results: [], images: [] };
}

async function executeBraveSearchOnce(token: string, q: string, n: number): Promise<SearchWebResponse> {
  const params = new URLSearchParams({
    q,
    count: String(n),
    safesearch: 'moderate',
    extra_snippets: 'true',
    result_filter: 'web',
  });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12_000);
  try {
    const res = await fetch(`${BRAVE_WEB_SEARCH}?${params}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'X-Subscription-Token': token,
      },
      signal: ctl.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401 || res.status === 403 || res.status === 422) {
        console.error(
          'Brave Search auth failed (%s). Copy the full Web Search API subscription token from https://api-dashboard.search.brave.com/ into BRAVE_API_KEY (no quotes). Body: %s',
          res.status,
          errText.slice(0, 280),
        );
      } else {
        console.error('Brave search error:', res.status, errText.slice(0, 500));
      }
      return { results: [], images: [] };
    }

    const data = await res.json();
    return mapBraveResponse(data);
  } catch (e) {
    console.error('Brave search fetch failed:', e);
    return { results: [], images: [] };
  } finally {
    clearTimeout(timer);
  }
}

function braveResultUrl(r: Record<string, unknown>): string {
  if (typeof r.url === 'string' && r.url) return r.url;
  const meta = r.meta_url as { scheme?: string; netloc?: string; path?: string } | undefined;
  if (meta?.netloc) {
    const scheme = meta.scheme || 'https';
    return `${scheme}://${meta.netloc}${meta.path ?? ''}`;
  }
  return '';
}

/** Brave includes page thumbnails on web results (`thumbnail.src` / `original`). */
function extractWebThumbnail(r: Record<string, unknown>): string | undefined {
  const th = r.thumbnail as { src?: string; original?: string } | undefined;
  if (th) {
    const orig = typeof th.original === 'string' ? th.original.trim() : '';
    const src = typeof th.src === 'string' ? th.src.trim() : '';
    if (orig) return orig;
    if (src) return src;
  }
  const prof = r.profile as { img?: string } | undefined;
  if (typeof prof?.img === 'string' && prof.img.trim()) return prof.img.trim();
  return undefined;
}

function mapBraveResponse(data: {
  web?: { results?: Array<Record<string, unknown>> };
  images?: { results?: Array<{ properties?: { url?: string }; thumbnail?: { src?: string } }> };
}): SearchWebResponse {
  const raw = data.web?.results ?? [];
  const results: SearchResult[] = raw.map(r => {
    const thumb = extractWebThumbnail(r);
    return {
      title: (r.title as string) ?? '',
      url: braveResultUrl(r),
      description: (r.description as string) ?? '',
      age: (r.age as string) ?? (r.page_age as string),
      extra_snippets: r.extra_snippets as string[] | undefined,
      thumbnail_url: thumb,
    };
  });
  const images = extractImageUrls(data);
  return { results, images };
}

/** Normalise URLs so Brave result rows match card URLs after redirects/query drift. */
export function normalizeUrlForThumbMatch(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = '';
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    u.pathname = path || '/';
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    return `${u.protocol}//${host}${u.pathname}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * When Claude omits image_url, fill from the Brave row that shares the same result URL.
 */
export function attachResultThumbnails<T extends { url?: string; image_url?: string }>(
  cards: T[],
  results: SearchResult[],
): T[] {
  const byKey = new Map<string, string>();
  for (const r of results) {
    if (!r.url?.trim()) continue;
    const t = r.thumbnail_url?.trim();
    if (!t) continue;
    byKey.set(normalizeUrlForThumbMatch(r.url), t);
  }

  return cards.map(card => {
    if (card.image_url?.trim()) return card;
    const raw = card.url?.trim();
    if (!raw?.startsWith('http')) return card;
    const key = normalizeUrlForThumbMatch(raw);
    let thumb = byKey.get(key);
    if (!thumb) {
      for (const [rk, tv] of byKey) {
        if (key.startsWith(rk) || rk.startsWith(key)) {
          thumb = tv;
          break;
        }
      }
    }
    if (!thumb) {
      try {
        const cu = new URL(raw);
        const chost = cu.hostname.replace(/^www\./i, '').toLowerCase();
        const cpath = cu.pathname.replace(/\/$/, '') || '/';
        for (const r of results) {
          if (!r.thumbnail_url?.trim() || !r.url?.startsWith('http')) continue;
          const ru = new URL(r.url);
          const rhost = ru.hostname.replace(/^www\./i, '').toLowerCase();
          if (rhost !== chost) continue;
          const rpath = ru.pathname.replace(/\/$/, '') || '/';
          if (cpath === rpath || cpath.startsWith(rpath + '/') || rpath.startsWith(cpath + '/')) {
            thumb = r.thumbnail_url;
            break;
          }
        }
      } catch {
        /* ignore */
      }
    }
    return thumb ? { ...card, image_url: thumb } : card;
  });
}

/**
 * Build context-aware search queries from a user message + full identity graph.
 * Uses actual artist names, brand names, and specific lifestyle terms — not
 * generic category words — for maximum result relevance.
 */
// Accept any profile shape — identity graph handles all the extraction
export interface LearnedQueryHints {
  facts?: string[];
  preferences?: Record<string, string>;
  recentTopics?: string[];
}

export function buildSearchQueries(
  message: string,
  profile: Record<string, unknown> | { [key: string]: unknown },
  learnedHints?: LearnedQueryHints,
  precomputedGraph?: IdentityGraph | null,
): { queries: string[]; useEventDomains: boolean } {
  const g = precomputedGraph ?? buildIdentityGraph(profile);

  const now = new Date();
  const month = now.toLocaleString('en', { month: 'long' });
  const year = now.getFullYear();

  // Extract preference modifiers from learned twin memory
  const prefModifiers: string[] = [];
  if (learnedHints?.preferences) {
    for (const [key, value] of Object.entries(learnedHints.preferences)) {
      if (key.includes('avoid') || key.includes('hate') || key.includes('dislike') || value.includes('no') || value.includes('avoid')) {
        prefModifiers.push(`-${value.replace(/^no\s+/i, '').trim()}`);
      } else if (key.includes('prefer') || key.includes('love') || key.includes('like') || key.includes('favorite')) {
        prefModifiers.push(value.trim());
      }
    }
  }
  const prefSuffix = prefModifiers.slice(0, 3).join(' ');

  // Intent detection
  const isEvent = /event|concert|gig|tonight|show|festival|experience|nightlife|party|happening|weekend plan|things to do|what.*on/i.test(message);
  const isMusic = /music|song|track|artist|playlist|album|release|listen|play/i.test(message);
  const isFood = /food|eat|restaurant|cafe|brunch|dinner|lunch|dine|hungry|where.*eat/i.test(message);
  const isJob = /job|hire|career|work|role|position|company|salary|interview|opportunity/i.test(message);
  const isProduct = /product|buy|purchase|recommend|suggest|what.*should i (get|buy)|gift|shopping|find me|gadget|skincare|gear|fashion|wear|style|outfit|brand|drop|shop|clothes/i.test(message);

  let queries: string[];
  let useEventDomains = false;

  if (isEvent) {
    useEventDomains = true;
    const artistHint = g.topArtists[0] ?? g.topGenres[0] ?? g.musicVibe ?? 'live music';
    // Use visual location types for experience queries when available
    const locHint = g.visualLocationTypes.length > 0
      ? g.visualLocationTypes[0]
      : (g.aesthetic || g.activityQueryStr);
    queries = [
      `${message} ${g.city} ${month} ${year}`,
      `${artistHint} concert live event ${g.city} ${month} ${year}`,
      `${locHint} event experience ${g.city} ${month} ${year}`,
    ];
  } else if (isMusic) {
    // Use ACTUAL Spotify artists for music discovery
    const artistCtx = g.topArtists.slice(0, 2).join(' ') || g.musicVibe;
    const genreCtx = g.topGenres.slice(0, 2).join(' ') || 'indie';
    queries = [
      `${message} ${year}`,
      `${artistCtx} ${message}`,
      `${genreCtx} ${message} ${year}`,
    ];
  } else if (isFood) {
    // Use image-proven cuisine types when available for higher accuracy
    const cuisineHint = g.visualCuisineTypes.length > 0
      ? g.visualCuisineTypes.slice(0, 2).join(' ')
      : '';
    queries = [
      `${message} ${g.city} ${year}`,
      `${g.foodVibe} ${message} ${g.city}`,
      cuisineHint
        ? `best ${cuisineHint} ${message} ${g.city} ${year}`
        : `best ${message} ${g.city} ${g.aesthetic} vibe`,
    ];
  } else if (isJob) {
    queries = [
      `${message} ${g.city} ${year}`,
      `${g.role || 'tech'} jobs ${g.city} ${g.industry} ${year}`,
      `${message} ${g.industry} hiring ${year}`,
    ];
  } else if (isProduct) {
    const brandCtx = g.brandVibes.slice(0, 2).join(' ') || g.queryStyleHint || g.aesthetic;
    const ch = g.topChannels.slice(0, 2).join(' ');
    queries = [
      `${message} buy India ${year}`,
      `${brandCtx} ${message} India`,
      ch ? `${ch} ${message} India ${year}` : `best ${message} ${g.queryStyleHint || g.aesthetic} India ${year}`,
    ];
  } else {
    const styleOrAct = g.queryStyleHint || g.aesthetic || g.activityQueryStr;
    const ch = g.topChannels.slice(0, 2).join(' ');
    const cold = g.rawSummarySnippet ? `${g.rawSummarySnippet.slice(0, 80)} ${message}` : '';
    const pref = prefSuffix ? ` ${prefSuffix}` : '';
    queries = [
      `${message} ${g.city} ${year}${pref}`,
      ch ? `${ch} ${message} ${year}` : cold || `${styleOrAct} ${message} ${g.city}`,
    ].filter(Boolean) as string[];
    if (queries.length < 2) {
      queries.push(`best ${message} ${g.city} ${year}`);
    }
  }

  const uniq = [...new Set(queries)].filter(Boolean);
  // Event intent: up to 3 variants (chat uses 2 broad + 1 platform). Others: 2 Brave calls max.
  const maxQueries = useEventDomains ? 3 : 2;
  return { queries: uniq.slice(0, maxQueries), useEventDomains };
}

/** Conservative: skip Brave when a fast profile-only reply is enough. */
export function shouldRunWebSearch(message: string, intentHint: string): boolean {
  const t = message.trim();
  const lower = t.toLowerCase();
  if (t.length === 0) return false;

  if (t.length <= 96) {
    if (/^(hi|hey|hello|yo|sup|wagwan|hiya|howdy)\b[!?.]*$/i.test(lower)) return false;
    if (/^(thanks|thank you|thx|ty|cheers)\b[!?.]*$/i.test(lower)) return false;
    if (/^(ok|okay|k|cool|nice|got it|sounds good|perfect|great)\b[!?.]*$/i.test(lower)) return false;
    if (/^(bye|goodbye|cya|see you|gn|good night|gm|good morning)\b[!?.]*$/i.test(lower)) return false;
    if (/^(yes|no|maybe|sure|nope|nah)\b[!?.]*$/i.test(lower)) return false;
  }

  if (intentHint === 'remind' && t.length < 100) return false;

  if (
    /\b(what did i (just )?say|repeat that|who am i|what'?s my name)\b/i.test(lower) &&
    t.length < 140
  ) {
    return false;
  }

  // Short drafting / reminders / internal tasks — no live web needed
  if (t.length <= 180 && (intentHint === 'drafting' || intentHint === 'remind')) {
    return false;
  }

  // Summarise intent: skip search unless user clearly wants external/news/web content
  if (
    intentHint === 'summarise' &&
    t.length <= 200 &&
    !/\b(news|article|today|headlines|online|web|search|twitter|reddit|what'?s happening)\b/i.test(lower)
  ) {
    return false;
  }

  // Conversational follow-ups — answer from thread + profile
  if (t.length <= 220) {
    if (
      /\b(what do you mean|can you elaborate|say more|explain (that|this|it)|why (would|did|do) you (say|think))\b/i.test(
        lower,
      )
    ) {
      return false;
    }
    if (/^(why|how so)\??$/i.test(lower)) return false;
  }

  return true;
}

const DEFAULT_FORMAT_MAX_RESULTS = 7;
const DEFAULT_DESC_MAX = 220;
const DEFAULT_SNIPPET_MAX = 120;
const DEFAULT_FORMAT_MAX_IMAGES = 10;

function clipText(s: string | undefined, max: number): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

export interface FormatResultsOptions {
  /** Max result rows (default 7; chat uses 6) */
  maxResults?: number;
  maxDescChars?: number;
  maxSnippetChars?: number;
  maxImageUrls?: number;
}

/**
 * Format search results into a compact string for the AI prompt.
 * Optionally appends image URLs so the AI can assign them to cards.
 */
export function formatResultsForAI(
  results: SearchResult[],
  images: string[] = [],
  opts?: FormatResultsOptions,
): string {
  if (!results.length) return '(No web results available — use general knowledge.)';
  const maxR = Math.min(Math.max(opts?.maxResults ?? DEFAULT_FORMAT_MAX_RESULTS, 1), 12);
  const dMax = opts?.maxDescChars ?? DEFAULT_DESC_MAX;
  const sMax = opts?.maxSnippetChars ?? DEFAULT_SNIPPET_MAX;
  const imgMax = Math.min(Math.max(opts?.maxImageUrls ?? DEFAULT_FORMAT_MAX_IMAGES, 0), 16);

  let context = results
    .slice(0, maxR)
    .map((r, i) => {
      const thumbLine = r.thumbnail_url ? `\n   Thumbnail: ${r.thumbnail_url}` : '';
      const desc = clipText(r.description, dMax);
      const snip = r.extra_snippets?.length ? clipText(r.extra_snippets[0], sMax) : '';
      const snipLine = snip ? `\n   ${snip}` : '';
      return `${i + 1}. ${clipText(r.title, 180)}\n   URL: ${r.url}${thumbLine}\n   ${desc}${snipLine}`;
    })
    .join('\n\n');

  if (images.length && imgMax > 0) {
    context += '\n\nAvailable images (assign best matching one as image_url per card):\n';
    context += images.slice(0, imgMax).map((url, i) => `${i + 1}. ${url}`).join('\n');
  }

  return context;
}

/**
 * Keep only cards whose url appears in search results (exact or host+path fuzzy).
 * Rewrites card.url to the canonical result URL when matched. Drops hallucinated links.
 */
export function sanitizeCardsToSearchResults<T extends Pick<ResultCard, 'url'>>(
  cards: T[],
  results: SearchResult[],
): T[] {
  const httpResults = results.filter(r => r.url?.trim().startsWith('http'));
  if (!httpResults.length) return cards.filter(c => !c.url?.trim().startsWith('http'));

  const byNorm = new Map<string, string>();
  for (const r of httpResults) {
    byNorm.set(normalizeUrlForThumbMatch(r.url), r.url);
  }

  function resolveUrl(raw: string | undefined): string | null {
    if (!raw?.trim().startsWith('http')) return null;
    const key = normalizeUrlForThumbMatch(raw);
    const exact = byNorm.get(key);
    if (exact) return exact;
    try {
      const cu = new URL(raw.trim());
      const chost = cu.hostname.replace(/^www\./i, '').toLowerCase();
      const cpath = cu.pathname.replace(/\/$/, '') || '/';
      for (const r of httpResults) {
        try {
          const ru = new URL(r.url);
          const rhost = ru.hostname.replace(/^www\./i, '').toLowerCase();
          if (rhost !== chost) continue;
          const rpath = ru.pathname.replace(/\/$/, '') || '/';
          if (cpath === rpath || cpath.startsWith(rpath + '/') || rpath.startsWith(cpath + '/')) {
            return r.url;
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* skip */
    }
    return null;
  }

  const out: T[] = [];
  for (const c of cards) {
    const resolved = resolveUrl(c.url);
    if (resolved) {
      out.push({ ...c, url: resolved });
    }
  }
  return out;
}

/** Sanitize model-emitted URLs then attach Brave thumbnails. */
export function finalizeSearchBackedCards(cards: ResultCard[], results: SearchResult[]): ResultCard[] {
  return attachResultThumbnails(sanitizeCardsToSearchResults(cards, results), results);
}

/** Ground news fact URLs to Brave result rows (drops facts with invented links). */
export function sanitizeNewsFactUrls<T extends { url?: string }>(facts: T[], results: SearchResult[]): T[] {
  const out: T[] = [];
  for (const f of facts) {
    const grounded = sanitizeCardsToSearchResults([{ url: f.url } as Pick<ResultCard, 'url'>], results);
    if (!grounded.length) continue;
    out.push({ ...f, url: grounded[0].url });
  }
  return out;
}
