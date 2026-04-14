# Apple Music Deep Signals

**Date:** 2026-04-14
**Goal:** Extract maximum signal from Apple Music — raise all API limits, parse artwork, add followed artists, fetch playlist contents, and feed everything into the identity graph and inference pipeline for deeply personalized music intelligence.

---

## 1. API Fetch Improvements

### Raise Limits

| Endpoint | Current | New |
|----------|---------|-----|
| `/me/history/heavy-rotation` | 25 | 100 |
| `/me/library/albums` | 20 | 100 |
| `/me/library/playlists` | 20 | 100 |
| `/me/recent/played/tracks` | 20 | 30 (Apple max) |
| `/me/library/artists` | 50 | 100 |
| `/me/ratings/songs?filter[rating]=loved` | 40 | 100 |
| `/me/recommendations` | 10 | 30 |
| `/me/library/songs` (fallback) | 30 | 100 |

### New Endpoints to Call

| Endpoint | Signal | Purpose |
|----------|--------|---------|
| `/me/library/playlists/{id}/tracks?limit=50` | Playlist curation — what's inside the user's playlists | Top 5 playlists by track count. Deep taste signal. |

### Parse New Fields from Existing Responses

From every track/album response, parse:
- `attributes.artwork.url` — album/track artwork URL (template: `{w}x{h}bb.jpg`)
- `attributes.durationInMillis` — track length (short vs long = energy patterns)
- `attributes.releaseDate` — when the music was released (new vs classic preference)
- `attributes.albumName` — album context for tracks

### Store User Storefront

The storefront is already fetched but not stored in the identity. Store it as `storefront: string` in `AppleMusicIdentity` for locale-aware catalog discovery.

---

## 2. Data Model Changes

### AppleMusicTrackHint (enhanced)

Current:
```typescript
interface AppleMusicTrackHint {
  title: string;
  artistName: string;
  appleMusicId?: string;
}
```

New:
```typescript
interface AppleMusicTrackHint {
  title: string;
  artistName: string;
  appleMusicId?: string;
  artworkUrl?: string;      // NEW — album art template URL
  albumName?: string;       // NEW — album context
  durationMs?: number;      // NEW — track length
  releaseDate?: string;     // NEW — release date
}
```

### AppleMusicIdentity (enhanced)

Add new fields:
```typescript
  storefront?: string;              // NEW — user's Apple Music storefront (e.g. "us", "in")
  followedArtists?: string[];       // NEW — explicitly followed artists
  playlistContents?: PlaylistContent[]; // NEW — top playlist track lists
  artworkMap?: Record<string, string>; // NEW — artist name → artwork URL
```

New type:
```typescript
interface PlaylistContent {
  name: string;
  trackCount: number;
  tracks: AppleMusicTrackHint[];
}
```

---

## 3. Identity Graph Integration

### New Graph Fields

In `IdentityGraph` (identity.ts), the Apple Music data maps to:

| Graph Field | Source | Currently | After |
|-------------|--------|-----------|-------|
| `topArtists` | AM artists + followed | Top 10 from heavy rotation | Top 30 from rotation + followed + loved |
| `topGenres` | AM genres | Top 10 | Top 15 with frequency counts |
| `topTracks` | AM heavy rotation + recent | Not stored separately | Top 20 tracks with artwork |
| `musicPersonality` | LLM analysis | From 8 tracks max | From 30+ tracks + playlists + follows |
| `musicVibe` | LLM analysis | Short phrase | Enhanced with temporal + curation data |
| `temporalPattern` | NEW — track durations | Not available | Short/long listening patterns |

### Enhanced LLM Prompt for Music Analysis

The current prompt to `analyseAppleMusicIdentity` sends:
- 8 heavy rotation tracks
- 8 recent tracks  
- 8 loved songs
- Genre list
- Playlist names (not contents)

Enhanced prompt sends:
- 20 heavy rotation tracks with artwork + duration
- 15 recent tracks
- 15 loved songs
- Top 5 playlist contents (actual track lists — deep curation signal)
- Followed artists (explicit taste)
- Duration distribution (% short vs long tracks)
- Release year distribution (% new vs classic)
- Genre frequency (not just names, but how often each appears)

This feeds into both `musicPersonality` and `vibeDescription` with much richer data.

### Inference Pipeline Impact

The `inferIdentityGraph` (life_domains['music']) will receive:
- Richer `musicQueryStr` with followed artists, playlist contents, duration patterns
- Genre frequency data for the donut chart (real percentages, not estimated)
- Temporal signals (new music vs catalog listener)
- Curation depth (playlist creation vs passive listening)

---

## 4. Frontend Integration

### ArtistStrip Enhancement
- Use `artworkMap` from Apple Music identity for artist images
- Falls back to iTunes API (existing) only if artworkMap misses
- Album art is already the right shape (square) for circular crops

### Music Section Cards (enhanced)
- "Your Sound" donut chart: use real genre frequency data from Apple Music
- "Top Tracks" card: show track list with album art thumbnails
- "New Releases" card: latest releases from followed/rotation artists with cover art

### Home Page Data Flow
- `musicArtists` reactive: include `artworkUrl` from the enhanced `AppleMusicTrackHint`
- `musicGenreSegments` reactive: use real genre frequency instead of estimated values
- New: `musicTopTracks` reactive: top tracks with artwork for a visual grid

---

## 5. Files to Change

| Action | File | What |
|--------|------|------|
| Modify | `src/lib/server/applemusic.ts` | Raise limits, parse artwork/duration/releaseDate, add followed artists, fetch playlist contents |
| Modify | `src/lib/utils.ts` | Update `AppleMusicIdentity` and `AppleMusicTrackHint` types |
| Modify | `src/lib/server/identity.ts` | Enhanced music signal extraction for identity graph |
| Modify | `src/routes/(app)/home/+page.svelte` | Use real artwork + genre frequency data |
| Modify | `src/lib/components/home/ArtistStrip.svelte` | Prefer artworkMap over iTunes API |
| Modify | `src/lib/components/home/MiniDonut.svelte` | No changes needed (data-driven) |
