/**
 * Discovery suggestions: catalog search with developer token only (no user token).
 * POST { profile } — derives exploratory search terms from Apple / Spotify / Instagram.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AppleMusicIdentity, AppleMusicExplorePick, AppleMusicTrackHint, SpotifyIdentity } from '$lib/utils';
import type { InstagramIdentity } from '$lib/server/instagram';
import {
  generateDeveloperToken,
  isAppleMusicConfigured,
  appleMusicCatalogStorefront,
  searchCatalogSongsForExplore,
} from '$lib/server/applemusic';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normKey(title: string, artist?: string): string {
  return `${(artist ?? '').toLowerCase().trim()}|${title.toLowerCase().trim()}`;
}

/** Songs/album-rows you already surfaced on Home — skip so Explore stays discovery. */
function listeningHistoryExcludeKeys(am: AppleMusicIdentity | undefined): Set<string> {
  const s = new Set<string>();
  for (const h of [...(am?.recentlyPlayed ?? []), ...(am?.heavyRotationTracks ?? [])]) {
    const t = h?.title?.trim();
    if (!t) continue;
    s.add(normKey(t, h.artistName));
  }
  return s;
}

function uniqueArtists(names: (string | undefined)[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = raw?.trim();
    if (!n) continue;
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
    if (out.length >= cap) break;
  }
  return out;
}

function artistsFromAppleTracks(hints: AppleMusicTrackHint[] | undefined): string[] {
  return uniqueArtists((hints ?? []).map(h => h.artistName), 8);
}

/** Spotify lines look like `Track — Artist` from analyseSpotifyIdentity. */
function parseSpotifyTrackLine(line: string): { title: string; artist: string } | null {
  const parts = line.split(/\s*[—–-]\s*/);
  if (parts.length < 2) return null;
  const title = parts[0]?.trim();
  const artist = parts.slice(1).join(' ').trim();
  if (!title || !artist) return null;
  return { title, artist };
}

function clipTerm(s: string, max = 90): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildPlans(profile: Record<string, unknown>): { term: string; reason: string }[] {
  const am = asRecord(profile.appleMusicIdentity) as unknown as AppleMusicIdentity;
  const sp = asRecord(profile.spotifyIdentity) as unknown as SpotifyIdentity;
  const ig = asRecord(profile.instagramIdentity) as unknown as InstagramIdentity;

  const plans: { term: string; reason: string }[] = [];
  const push = (term: string, reason: string) => {
    const t = clipTerm(term);
    if (!t || t.length < 2) return;
    plans.push({ term: t, reason });
  };

  const recent = am?.recentlyPlayed ?? [];
  const heavy = am?.heavyRotationTracks ?? [];
  const rotationArtists = artistsFromAppleTracks([...recent, ...heavy]);

  // 1) Ground in actual plays: "songs like …" from recent + heavy (prefer items with artist).
  const playSeeds: { hint: AppleMusicTrackHint; label: string }[] = [];
  for (const hint of [...recent.slice(0, 2), ...heavy.slice(0, 2)]) {
    if (!hint?.title?.trim()) continue;
    if (playSeeds.some(p => normKey(p.hint.title, p.hint.artistName) === normKey(hint.title, hint.artistName))) continue;
    playSeeds.push({ hint, label: recent.includes(hint) ? 'From your recent plays' : 'From your heavy rotation' });
  }
  for (const { hint, label } of playSeeds) {
    const artist = hint.artistName?.trim();
    if (artist) {
      push(`music similar to ${hint.title} ${artist}`, label);
    } else {
      push(`songs like ${hint.title}`, label);
    }
  }

  // 2) Rotation artists beyond #1 (different angles than topArtists order).
  const topAppleArtist = am?.topArtists?.[0];
  for (const a of rotationArtists) {
    if (a === topAppleArtist) continue;
    push(`radio inspired by ${a}`, `Because ${a} shows up in your listening`);
    break;
  }

  // 3) Latest drops tied to artists you already care about.
  const drops = am?.latestReleases ?? [];
  for (const d of drops.slice(0, 2)) {
    const an = d.artistName?.trim();
    const ttl = d.title?.trim();
    if (an && ttl) {
      push(`new songs like ${an} ${ttl}`, `Near your rotation — ${an}'s recent drop`);
    } else if (an) {
      push(`${an} new releases`, `Fresh from an artist in your world`);
    }
  }

  // 4) Library album names + genre (taste anchor).
  const alb = am?.topAlbums?.map(a => String(a).trim()).filter(Boolean) ?? [];
  const genre = am?.topGenres?.[0];
  if (alb[0] && rotationArtists[0]) {
    push(`albums like ${alb[0]} ${rotationArtists[0]}`, 'Styled after albums you keep');
  } else if (alb[0] && genre) {
    push(`${genre} albums like ${alb[0]}`, 'Your library + genre');
  }

  const vibe =
    (am?.vibeDescription && String(am.vibeDescription).trim()) ||
    (am?.musicPersonality && String(am.musicPersonality).trim().slice(0, 100));

  if (topAppleArtist) {
    push(`artists similar to ${topAppleArtist}`, `Because you listen to ${topAppleArtist}`);
    push(`${topAppleArtist} deep cuts`, 'Dig deeper than your rotation');
  }
  if (genre) {
    push(`${genre} emerging artists`, `Discovery inside ${genre}`);
    push(`best ${genre} 2025`, `Fresh ${genre} picks`);
  }
  if (vibe) {
    push(`${vibe} mix`, 'Matches your Apple vibe line');
  }

  // 5) Spotify history (tracks are richer than artist-only).
  const spTrackLine = sp?.topTracks?.[0];
  const parsedTrack = spTrackLine ? parseSpotifyTrackLine(spTrackLine) : null;
  if (parsedTrack) {
    push(
      `if you like ${parsedTrack.title} ${parsedTrack.artist}`,
      'From your Spotify top track',
    );
  }
  const spArtist = sp?.topArtists?.[0];
  if (spArtist && spArtist !== topAppleArtist) {
    push(`radio ${spArtist}`, 'From your Spotify top artist');
  }
  const spGenre = sp?.topGenres?.[0];
  if (spGenre && spGenre !== genre) {
    push(`${spGenre} underground`, 'From your Spotify genres');
  }

  const mv = ig?.musicVibe && String(ig.musicVibe).trim();
  if (mv) {
    push(`${mv} energy playlist`, 'From your Instagram music vibe');
  }

  if (plans.length < 3) {
    push('indie hidden gems 2025', 'Editorial-style discovery');
  }
  if (!plans.length) {
    push('rising artists 2025', 'Discovery mix');
  }

  const seenKey = new Set<string>();
  const uniq: { term: string; reason: string }[] = [];
  for (const p of plans) {
    const k = p.term.toLowerCase();
    if (seenKey.has(k)) continue;
    seenKey.add(k);
    uniq.push(p);
    if (uniq.length >= 9) break;
  }
  return uniq;
}

export const POST: RequestHandler = async ({ request }) => {
  if (!isAppleMusicConfigured()) {
    throw error(503, 'Apple Music not configured');
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }
  const profile = asRecord(asRecord(body).profile);
  const amIdentity = asRecord(profile.appleMusicIdentity) as unknown as AppleMusicIdentity;
  const excludeListening = listeningHistoryExcludeKeys(amIdentity);

  const dev = generateDeveloperToken();
  const storefront = appleMusicCatalogStorefront();
  const plans = buildPlans(profile);

  const seenIds = new Set<string>();
  const picks: AppleMusicExplorePick[] = [];

  for (const { term, reason } of plans) {
    const rows = await searchCatalogSongsForExplore(dev, storefront, term, 5, reason);
    for (const r of rows) {
      const k = (r.appleMusicId ?? `${r.title}|${r.artistName ?? ''}`).toLowerCase();
      if (seenIds.has(k)) continue;
      if (excludeListening.has(normKey(r.title, r.artistName))) continue;
      seenIds.add(k);
      picks.push(r);
      if (picks.length >= 14) break;
    }
    if (picks.length >= 14) break;
  }

  return json({ songs: picks, storefront });
};
