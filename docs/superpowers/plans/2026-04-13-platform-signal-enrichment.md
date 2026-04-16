# Platform Signal Enrichment: LinkedIn + Apple Music

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich identity signals from LinkedIn (email domain parsing, manual profile fields) and Apple Music (recommendations, library artists, loved songs) to produce deeper, more unique identity inference.

**Architecture:** LinkedIn gets two new signal sources: deterministic email-domain inference and optional manual profile fields (work history, skills, career goal) collected during onboarding. Apple Music gets three new API endpoints (`/me/recommendations`, `/me/library/artists`, `/me/ratings/songs`) fetched in parallel with existing calls, plus the LLM prompt is expanded to use the richer data. All new data flows through the existing `RawProfile` → `IdentityGraph` → inference pipeline.

**Tech Stack:** SvelteKit, TypeScript, Apple MusicKit API, Claude Haiku 4.5, Supabase (JSONB)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/server/linkedin.ts` | Add `inferEmailDomainSignals()`, expand LLM prompt context |
| Modify | `src/lib/utils.ts` | Extend `LinkedInIdentity` and `AppleMusicIdentity` types |
| Modify | `src/lib/server/applemusic.ts` | Add 3 new API fetches, expand LLM prompt |
| Modify | `src/lib/server/identity.ts` | Wire new fields into `RawProfile` and `buildIdentityGraph()` |
| Modify | `src/routes/api/refresh-signals/+server.ts` | Pass new Apple Music data to `analyseAppleMusicIdentity()` |
| Modify | `src/routes/onboarding/+page.svelte` | Add optional LinkedIn enrichment fields |
| Modify | `src/routes/auth/linkedin/callback/+server.ts` | Pass email domain signals through callback |

---

### Task 1: Add Email Domain Inference to LinkedIn

**Files:**
- Modify: `src/lib/server/linkedin.ts`

LinkedIn's API gives us almost nothing, but the user's email domain is a free high-signal source we're ignoring. `madhvik@google.com` vs `madhvik@startup.io` tells us company size, culture, and prestige tier.

- [ ] **Step 1: Add `inferEmailDomainSignals()` function**

Add this function above `analyseLinkedInIdentity` in `src/lib/server/linkedin.ts`:

```typescript
/** Deterministic signals from email domain — no LLM needed. */
export function inferEmailDomainSignals(email: string): {
  companyFromDomain: string;
  domainType: 'big_tech' | 'startup' | 'agency' | 'corporate' | 'education' | 'personal' | 'unknown';
  domainSignal: string;
} {
  const domain = (email.split('@')[1] ?? '').toLowerCase().trim();
  if (!domain || domain === 'gmail.com' || domain === 'yahoo.com' || domain === 'hotmail.com' || domain === 'outlook.com' || domain === 'icloud.com' || domain === 'protonmail.com') {
    return { companyFromDomain: '', domainType: 'personal', domainSignal: '' };
  }

  const bigTech: Record<string, string> = {
    'google.com': 'Google', 'apple.com': 'Apple', 'meta.com': 'Meta', 'facebook.com': 'Meta',
    'amazon.com': 'Amazon', 'microsoft.com': 'Microsoft', 'netflix.com': 'Netflix',
    'uber.com': 'Uber', 'airbnb.com': 'Airbnb', 'stripe.com': 'Stripe',
    'salesforce.com': 'Salesforce', 'twitter.com': 'X', 'x.com': 'X',
    'linkedin.com': 'LinkedIn', 'spotify.com': 'Spotify', 'snap.com': 'Snap',
    'bytedance.com': 'ByteDance', 'tiktok.com': 'TikTok',
    'adobe.com': 'Adobe', 'nvidia.com': 'NVIDIA', 'intel.com': 'Intel',
    'swiggy.com': 'Swiggy', 'zomato.com': 'Zomato', 'flipkart.com': 'Flipkart',
    'razorpay.com': 'Razorpay', 'cred.club': 'CRED', 'phonepe.com': 'PhonePe',
  };

  if (bigTech[domain]) {
    return {
      companyFromDomain: bigTech[domain],
      domainType: 'big_tech',
      domainSignal: `Works at ${bigTech[domain]} (verified via email domain)`,
    };
  }

  if (domain.endsWith('.edu') || domain.endsWith('.ac.in') || domain.endsWith('.ac.uk')) {
    return {
      companyFromDomain: domain.split('.')[0],
      domainType: 'education',
      domainSignal: `Education-affiliated (${domain})`,
    };
  }

  if (domain.endsWith('.gov') || domain.endsWith('.gov.in')) {
    return {
      companyFromDomain: domain.split('.')[0],
      domainType: 'corporate',
      domainSignal: `Government-affiliated (${domain})`,
    };
  }

  // Custom domain = likely startup or agency
  const name = domain.split('.')[0];
  const isShortDomain = domain.split('.').length <= 2 && name.length <= 12;
  return {
    companyFromDomain: name,
    domainType: isShortDomain ? 'startup' : 'corporate',
    domainSignal: `Custom work email (${domain}) — likely ${isShortDomain ? 'startup/small company' : 'established company'}`,
  };
}
```

- [ ] **Step 2: Wire email domain signals into `analyseLinkedInIdentity`**

In `src/lib/server/linkedin.ts`, modify the `analyseLinkedInIdentity` function to use domain signals. Replace the `contextLines` block (lines ~153-161):

```typescript
export async function analyseLinkedInIdentity(
  name: string,
  headline: string,
  industry: string,
  city: string,
  country: string,
  email?: string,
): Promise<LinkedInIdentity> {
  const loc = [city?.trim(), country?.trim()].filter(Boolean).join(', ');
  const domainSignals = email ? inferEmailDomainSignals(email) : null;

  const contextLines = [
    name?.trim() && `Name: ${name.trim()}`,
    headline?.trim() && `Professional headline: ${headline.trim()}`,
    industry?.trim() && `Industry: ${industry.trim()}`,
    city?.trim() && `City: ${city.trim()}`,
    country?.trim() && `Country: ${country.trim()}`,
    email?.trim() && `Email: ${email.trim()}`,
    domainSignals?.domainSignal && `Email domain signal: ${domainSignals.domainSignal}`,
    domainSignals?.domainType && `Organization type: ${domainSignals.domainType}`,
  ].filter(Boolean) as string[];
```

This gives Claude the domain context so it can make better inferences about seniority and company culture.

- [ ] **Step 3: Bump `max_tokens` from 400 to 600**

In the `anthropic.messages.create` call inside `analyseLinkedInIdentity` (line ~212):

```typescript
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });
```

This gives the LLM room to produce richer `linkedinIntentHints` and `careerSummary`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/linkedin.ts
git commit -m "feat(linkedin): add email domain inference and expand LLM token budget"
```

---

### Task 2: Extend Apple Music Type Definitions

**Files:**
- Modify: `src/lib/utils.ts`

- [ ] **Step 1: Add new fields to `AppleMusicIdentity`**

In `src/lib/utils.ts`, extend the `AppleMusicIdentity` interface (after line 57, before the closing `}`):

```typescript
export interface AppleMusicIdentity {
  topArtists: string[];
  topAlbums: string[];
  topGenres: string[];
  musicPersonality: string;
  vibeDescription: string;
  /** From heavy rotation — playlists Apple thinks you play often */
  rotationPlaylists: string[];
  /** Sample of titles from your library */
  libraryPlaylists: string[];
  /** Latest catalog releases for top rotation artists */
  latestReleases: AppleMusicLatestRelease[];
  /** Heavy rotation song titles (and artists when available) */
  heavyRotationTracks: AppleMusicTrackHint[];
  /** Recently played from /me/recent/played */
  recentlyPlayed: AppleMusicTrackHint[];
  /** Full library artist names (broader than heavy rotation) */
  libraryArtists: string[];
  /** Songs the user explicitly loved (highest-intent signal) */
  lovedSongs: AppleMusicTrackHint[];
  /** Apple's own recommendations — what Apple thinks the user likes */
  recommendedNames: string[];
}
```

- [ ] **Step 2: Update `normalizeAppleMusicIdentity` for backwards compat**

In `src/lib/utils.ts`, update the normalize function (around line 61):

```typescript
export function normalizeAppleMusicIdentity(am: AppleMusicIdentity): AppleMusicIdentity {
  return {
    ...am,
    rotationPlaylists: am.rotationPlaylists ?? [],
    libraryPlaylists: am.libraryPlaylists ?? [],
    latestReleases: am.latestReleases ?? [],
    heavyRotationTracks: (am.heavyRotationTracks ?? []).map(normalizeTrackHint),
    recentlyPlayed: (am.recentlyPlayed ?? []).map(normalizeTrackHint),
    libraryArtists: am.libraryArtists ?? [],
    lovedSongs: (am.lovedSongs ?? []).map(normalizeTrackHint),
    recommendedNames: am.recommendedNames ?? [],
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat(types): extend AppleMusicIdentity with libraryArtists, lovedSongs, recommendedNames"
```

---

### Task 3: Add New Apple Music API Fetches

**Files:**
- Modify: `src/lib/server/applemusic.ts`

- [ ] **Step 1: Add `fetchLibraryArtists` helper**

Add after the `fetchLibrarySongHints` function (after line ~340):

```typescript
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
```

- [ ] **Step 2: Add `fetchLovedSongs` helper**

Add directly after `fetchLibraryArtists`:

```typescript
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
    // Ratings endpoint returns song resources with rating value
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
```

- [ ] **Step 3: Add `fetchRecommendations` helper**

Add directly after `fetchLovedSongs`:

```typescript
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
```

- [ ] **Step 4: Wire new fetches into `fetchAppleMusicData`**

In `fetchAppleMusicData`, update the `Promise.all` call and return object. Replace lines 359-427:

```typescript
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
```

- [ ] **Step 5: Update `AppleMusicFetchedSnapshot` interface**

Update the interface (around line 342):

```typescript
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
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/applemusic.ts
git commit -m "feat(apple-music): fetch library artists, loved songs, and recommendations"
```

---

### Task 4: Expand Apple Music LLM Analysis

**Files:**
- Modify: `src/lib/server/applemusic.ts`

- [ ] **Step 1: Update `analyseAppleMusicIdentity` signature and prompt**

Replace the entire `analyseAppleMusicIdentity` function (lines ~430-521):

```typescript
export async function analyseAppleMusicIdentity(
  artists: string[],
  albums: string[],
  genres: string[],
  rotationPlaylists: string[],
  libraryPlaylists: string[],
  latestReleases: AppleMusicLatestRelease[],
  heavyRotationTracks: AppleMusicTrackHint[],
  recentlyPlayed: AppleMusicTrackHint[],
  libraryArtists: string[],
  lovedSongs: AppleMusicTrackHint[],
  recommendedNames: string[],
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
    libraryArtists,
    lovedSongs,
    recommendedNames,
  });

  const hasAnything =
    artists.length ||
    albums.length ||
    rotationPlaylists.length ||
    libraryPlaylists.length ||
    latestReleases.length ||
    heavyRotationTracks.length ||
    recentlyPlayed.length ||
    libraryArtists.length ||
    lovedSongs.length;
  if (!hasAnything) {
    return empty();
  }

  const drops = latestReleases.map(r => `${r.artistName}: ${r.title}`).join('; ');

  // Show library artists that aren't already in heavy rotation for breadth signal
  const rotationSet = new Set(artists.map(a => a.toLowerCase()));
  const extraLibraryArtists = libraryArtists
    .filter(a => !rotationSet.has(a.toLowerCase()))
    .slice(0, 15);

  const prompt = `Analyse this Apple Music listening data and describe the person's music personality.

Heavy rotation artists: ${artists.join(', ')}
Heavy rotation songs: ${trackLine(heavyRotationTracks) || '—'}
Recently played songs: ${trackLine(recentlyPlayed) || '—'}
Loved/favorited songs (explicit user preference): ${trackLine(lovedSongs) || '—'}
Albums in library / rotation: ${albums.join(', ')}
Genres: ${genres.join(', ')}
Playlists on repeat (heavy rotation): ${rotationPlaylists.join(', ') || '—'}
Other library playlists: ${libraryPlaylists.join(', ') || '—'}
Library artists (beyond rotation): ${extraLibraryArtists.join(', ') || '—'}
Apple recommendations for this user: ${recommendedNames.join(', ') || '—'}
Newest catalog drops from those artists: ${drops || '—'}

Return JSON only (no markdown):
{
  "musicPersonality": "2-sentence description of their music taste, referencing specific artists/genres",
  "vibeDescription": "one punchy phrase e.g. 'alt-pop with indie edge'",
  "moodArc": "how their listening shifts across context (e.g. 'ambient mornings, hip-hop commute, R&B evenings')",
  "tasteDepth": "casual | engaged | deep_listener | obsessive",
  "genreBreadth": "narrow | moderate | eclectic"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
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
      libraryArtists,
      lovedSongs,
      recommendedNames,
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
      libraryArtists,
      lovedSongs,
      recommendedNames,
      musicPersonality: genres.slice(0, 3).join(', '),
      vibeDescription: '',
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/applemusic.ts
git commit -m "feat(apple-music): expand LLM prompt with loved songs, library artists, recommendations"
```

---

### Task 5: Update refresh-signals to Pass New Apple Music Data

**Files:**
- Modify: `src/routes/api/refresh-signals/+server.ts`

- [ ] **Step 1: Update the Apple Music refresh block**

Replace lines 227-236 in `+server.ts` (the `analyseAppleMusicIdentity` call):

```typescript
          const identity = await analyseAppleMusicIdentity(
            snap.artists,
            snap.albums,
            snap.genres,
            snap.rotationPlaylists,
            snap.libraryPlaylistNames,
            snap.latestReleases,
            snap.heavyRotationTracks,
            snap.recentlyPlayed,
            snap.libraryArtists,
            snap.lovedSongs,
            snap.recommendedNames,
          );
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/refresh-signals/+server.ts
git commit -m "feat(refresh): pass new Apple Music fields through refresh pipeline"
```

---

### Task 6: Wire New Fields into Identity Graph

**Files:**
- Modify: `src/lib/server/identity.ts`

- [ ] **Step 1: Extend `RawProfile` Apple Music shape**

Update the `appleMusicIdentity` block in the `RawProfile` interface (lines ~68-78):

```typescript
  appleMusicIdentity?: {
    topArtists?: string[];
    topGenres?: string[];
    musicPersonality?: string;
    vibeDescription?: string;
    rotationPlaylists?: string[];
    libraryPlaylists?: string[];
    latestReleases?: { artistName?: string; title?: string }[];
    heavyRotationTracks?: { title?: string; artistName?: string }[];
    recentlyPlayed?: { title?: string; artistName?: string }[];
    libraryArtists?: string[];
    lovedSongs?: { title?: string; artistName?: string }[];
    recommendedNames?: string[];
  } | null;
```

- [ ] **Step 2: Use new Apple Music data in `buildIdentityGraph`**

Find the section where `am` (Apple Music) data is consumed in `buildIdentityGraph` (around lines 300-310 and 570-590). Add the new fields to artist/genre merging.

In the artist merging section, find where `topArtists` is built and add library artists as a broader pool:

```typescript
  // Merge Apple Music library artists into the broader artist pool
  const amLibraryArtists = am?.libraryArtists ?? [];
  const amLovedArtists = (am?.lovedSongs ?? [])
    .map(s => s.artistName?.trim())
    .filter((n): n is string => Boolean(n));
```

Then in the `topArtists` deduplication, append `amLibraryArtists` after rotation artists and `amLovedArtists` for higher diversity.

In the `appleMusicDescriptorTags` section (around line 576), enrich with loved song data:

```typescript
  const appleMusicDescriptorTags = dedupeInterestsPreserveOrder(
    [
      ...(am?.topGenres ?? []),
      ...(am?.rotationPlaylists ?? []).slice(0, 4),
      ...(am?.libraryPlaylists ?? []).slice(0, 3),
      ...(am?.recommendedNames ?? []).slice(0, 3),
    ],
    15,
  );
```

- [ ] **Step 3: Enrich `appleListeningHint` with loved songs**

Find the `appleListeningHint` construction (around line 595-610 area) and add loved songs:

```typescript
  const lovedLine = (am?.lovedSongs ?? [])
    .slice(0, 5)
    .map(t => (t.artistName ? `${t.artistName} — ${t.title}` : t.title))
    .join('; ');
  const recsLine = (am?.recommendedNames ?? []).slice(0, 4).join(', ');

  // Append to existing appleListeningHint construction
  const appleListeningHintParts = [
    /* existing heavy rotation + recently played logic */
  ];
  if (lovedLine) appleListeningHintParts.push(`loved: ${lovedLine}`);
  if (recsLine) appleListeningHintParts.push(`apple recommends: ${recsLine}`);
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/identity.ts
git commit -m "feat(identity): wire Apple Music library artists, loved songs, and recommendations into graph"
```

---

### Task 7: Add LinkedIn Enrichment Fields to Onboarding

**Files:**
- Modify: `src/routes/onboarding/+page.svelte`

Since the LinkedIn API is limited, we add optional manual fields during onboarding to capture what the API can't provide. These fields only appear after LinkedIn is connected.

- [ ] **Step 1: Add LinkedIn enrichment fields to onboarding state**

Find the onboarding state object in the Svelte component and add:

```typescript
let linkedinManualRole = '';
let linkedinManualCompany = '';
let linkedinManualYearsExp = '';
let linkedinManualSkills: string[] = [];
let linkedinManualCareerGoal = '';
```

- [ ] **Step 2: Add the UI section for LinkedIn enrichment**

After the LinkedIn connection button in step 3, add an expandable section that appears when LinkedIn is connected:

```svelte
{#if linkedinConnected}
  <div class="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
    <p class="text-sm text-white/60">LinkedIn gives us limited data. Help us understand you better:</p>
    
    <div class="grid grid-cols-2 gap-3">
      <input
        type="text"
        bind:value={linkedinManualRole}
        placeholder="Current role (e.g. Product Designer)"
        class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
      />
      <input
        type="text"
        bind:value={linkedinManualCompany}
        placeholder="Company name"
        class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
      />
    </div>

    <select
      bind:value={linkedinManualYearsExp}
      class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
    >
      <option value="" disabled>Years of experience</option>
      <option value="0-2">0-2 years</option>
      <option value="3-5">3-5 years</option>
      <option value="6-10">6-10 years</option>
      <option value="10+">10+ years</option>
    </select>

    <input
      type="text"
      bind:value={linkedinManualCareerGoal}
      placeholder="Career goal (e.g. Lead design at a Series B startup)"
      class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
    />
  </div>
{/if}
```

- [ ] **Step 3: Save manual LinkedIn fields to profile**

When the onboarding saves/completes, include the manual fields in the profile data payload:

```typescript
const profilePayload = {
  // ... existing fields ...
  linkedinManual: {
    role: linkedinManualRole.trim() || undefined,
    company: linkedinManualCompany.trim() || undefined,
    yearsExp: linkedinManualYearsExp || undefined,
    careerGoal: linkedinManualCareerGoal.trim() || undefined,
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/onboarding/+page.svelte
git commit -m "feat(onboarding): add optional LinkedIn enrichment fields for career data"
```

---

### Task 8: Consume LinkedIn Manual Fields in Identity Graph

**Files:**
- Modify: `src/lib/server/identity.ts`

- [ ] **Step 1: Add `linkedinManual` to `RawProfile`**

After the `linkedinIdentity` block in `RawProfile` (after line ~109):

```typescript
  linkedinManual?: {
    role?: string;
    company?: string;
    yearsExp?: string;
    careerGoal?: string;
  } | null;
```

- [ ] **Step 2: Use manual fields as fallback/enrichment in `buildIdentityGraph`**

In `buildIdentityGraph`, after the `li` variable is set (line ~303), add:

```typescript
  const liManual = profile.linkedinManual;

  // Manual fields override API fields when API returns nothing
  const effectiveRole = li?.currentRole?.trim() || liManual?.role?.trim() || '';
  const effectiveCompany = li?.currentCompany?.trim() || liManual?.company?.trim() || '';
  const effectiveHeadline = li?.headline?.trim() || 
    (effectiveRole && effectiveCompany ? `${effectiveRole} at ${effectiveCompany}` : effectiveRole);
```

Then use `effectiveRole`, `effectiveCompany`, `effectiveHeadline` everywhere the graph currently uses `li?.currentRole`, `li?.currentCompany`, `li?.headline`.

For career goal, add it to `jobInterests` if present:

```typescript
  const manualCareerGoal = liManual?.careerGoal?.trim();
  const jobInterests = dedupeInterestsPreserveOrder(
    [
      ...(manualCareerGoal ? [manualCareerGoal] : []),
      ...(li?.jobInterests ?? []),
    ],
    5,
  );
```

For years of experience, use it to validate/override seniority:

```typescript
  const yearsExp = liManual?.yearsExp;
  let seniority = li?.seniority ?? 'mid-level';
  if (yearsExp && !li?.seniority) {
    if (yearsExp === '0-2') seniority = 'entry-level';
    else if (yearsExp === '3-5') seniority = 'mid-level';
    else if (yearsExp === '6-10') seniority = 'senior';
    else if (yearsExp === '10+') seniority = 'lead';
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/identity.ts
git commit -m "feat(identity): consume manual LinkedIn fields as fallback/enrichment in graph"
```

---

### Task 9: Wire LinkedIn Manual Fields into LLM Analysis

**Files:**
- Modify: `src/lib/server/linkedin.ts`
- Modify: `src/routes/api/refresh-signals/+server.ts`

- [ ] **Step 1: Accept manual fields in `analyseLinkedInIdentity`**

Add an optional parameter to the function signature:

```typescript
export async function analyseLinkedInIdentity(
  name: string,
  headline: string,
  industry: string,
  city: string,
  country: string,
  email?: string,
  manual?: { role?: string; company?: string; yearsExp?: string; careerGoal?: string } | null,
): Promise<LinkedInIdentity> {
```

Add manual fields to the context lines:

```typescript
  const contextLines = [
    name?.trim() && `Name: ${name.trim()}`,
    headline?.trim() && `Professional headline: ${headline.trim()}`,
    industry?.trim() && `Industry: ${industry.trim()}`,
    city?.trim() && `City: ${city.trim()}`,
    country?.trim() && `Country: ${country.trim()}`,
    email?.trim() && `Email: ${email.trim()}`,
    domainSignals?.domainSignal && `Email domain signal: ${domainSignals.domainSignal}`,
    domainSignals?.domainType && `Organization type: ${domainSignals.domainType}`,
    manual?.role?.trim() && `Self-reported role: ${manual.role.trim()}`,
    manual?.company?.trim() && `Self-reported company: ${manual.company.trim()}`,
    manual?.yearsExp && `Years of experience: ${manual.yearsExp}`,
    manual?.careerGoal?.trim() && `Career goal: ${manual.careerGoal.trim()}`,
  ].filter(Boolean) as string[];
```

- [ ] **Step 2: Pass manual fields in refresh-signals**

In `src/routes/api/refresh-signals/+server.ts`, update the LinkedIn refresh block (lines ~199-214):

```typescript
  // LinkedIn refresh
  if (profileData.linkedinConnected && tokens.linkedinToken) {
    tasks.push(
      (async () => {
        try {
          const { name, email, headline, industry, country } = await fetchLinkedInProfile(
            tokens.linkedinToken!,
          );
          const manual = profileData.linkedinManual as
            | { role?: string; company?: string; yearsExp?: string; careerGoal?: string }
            | undefined;
          const identity = await analyseLinkedInIdentity(name, headline, industry, '', country, email, manual);
          updated.linkedinIdentity = identity;
        } catch (e: unknown) {
          console.error('[RefreshSignals] LinkedIn error:', e instanceof Error ? e.message : e);
          expired.push('linkedin');
        }
      })(),
    );
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/linkedin.ts src/routes/api/refresh-signals/+server.ts
git commit -m "feat(linkedin): pass manual enrichment fields to LLM analysis"
```

---

### Task 10: Smoke Test the Full Pipeline

**Files:** None (manual verification)

- [ ] **Step 1: Verify TypeScript compilation**

Run: `cd /Users/madhviknemani/wagwan-ai && npx tsc --noEmit`

Expected: No type errors. If there are errors, they'll point to mismatched types between the new fields and existing consumers.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

Expected: Server starts without errors on the default port.

- [ ] **Step 3: Verify onboarding page loads**

Open the onboarding page in browser. Confirm:
- LinkedIn enrichment fields appear after LinkedIn connection
- Fields accept input without errors
- Page doesn't crash

- [ ] **Step 4: Test a signal refresh**

Trigger a refresh via the API (or through the UI) with an account that has Apple Music connected. Check server logs for:
- No errors from new Apple Music endpoints (they may return empty arrays if endpoints aren't supported for the account — that's fine)
- `analyseAppleMusicIdentity` receives the new parameters

- [ ] **Step 5: Commit any fixes**

```bash
git add -u
git commit -m "fix: resolve type/integration issues from platform signal enrichment"
```
