# Identity Signal & Inference Architecture

> Generated: 2026-04-16  
> Based on actual source code at `src/lib/server/`

---

## Table of Contents

1. [Overview](#overview)
2. [Signal Sources](#1-signal-sources)
3. [Identity Graph Construction](#2-identity-graph-construction)
4. [Signal Weightage & Trust](#3-signal-weightage--trust)
5. [Inference Pipeline (LLM Layers)](#4-inference-pipeline-llm-layers)
6. [Summary Generation](#5-summary-generation)
7. [Signal Refresh Flow](#6-signal-refresh-flow)
8. [How the Graph is Consumed](#7-how-the-graph-is-consumed)
9. [Behavioral Precalc](#8-behavioral-precalc)
10. [Memory Graph](#9-memory-graph)
11. [Identity Claims](#10-identity-claims)
12. [Data Flow Diagram](#11-data-flow-diagram)

---

## Overview

wagwan-ai builds a real-time, multi-platform behavioral identity for each user. The pipeline has five distinct stages:

1. **Signal ingestion** — raw data fetched from connected OAuth platforms
2. **Per-platform analysis** — Claude-powered or deterministic analysis produces a typed identity object per platform
3. **Identity graph construction** — `buildIdentityGraph()` merges all platform objects into one `IdentityGraph`
4. **Signal meter** — every field gets scored by strength, recency, frequency, confidence and cross-platform corroboration
5. **LLM inference layers** — four parallel inference passes (InferenceIdentity, IdentityIntelligence, IdentitySnapshot, HyperInference) evolve the graph into behavioral narrative

The graph is then used in: chat system prompts, home recommendations, search query construction, marketplace matching, expression atoms, and the identity claims vector store.

---

## 1. Signal Sources

### 1.1 Instagram — `src/lib/server/instagram.ts`

**OAuth scope:** Basic Display API (profile, media, comments)

**Data fetched:**
- Profile: `username`, `biography`, `followers_count`, `media_count`, `profile_picture_url`
- Media: up to 100 posts (`CAROUSEL_ALBUM` children expanded, up to 8 carousels × 4 children)
- Comments: top 5 posts × 15 comments each

**Analysis pipeline (sequential):**

| Phase | Function | Output |
|-------|----------|--------|
| 1 | `fetchInstagramProfile()` + `fetchInstagramMedia()` | Raw API data |
| 2 | `analyseVisualIdentity()` | `VisualIdentity` — Claude analyzes representative images for scene categories, color palette, cuisine types, location types, fashion style, aesthetic tone/brightness/composition |
| 3B | `analyseCaptionsWithClaude()` | Claude reads captions + bio → aesthetic, lifestyle, brandVibes, musicVibe, foodVibe, travelStyle, activityPattern, interests, rawSummary, displayName, bioKeywords, bioRoles, captionIntent, personality scores (expressive/humor/introspective), igPostingCadence |
| 4A | `analyseTemporalPatterns()` | `TemporalProfile` — activityPattern (morning/evening/etc.), peakDays from post timestamps |
| 4B | `analyseEngagement()` | `EngagementProfile` — engagementTier (high/medium/low), socialVisibility (viral/micro/niche/low) based on likes/comments vs follower count |
| 4C | `analyseCommentGraph()` | `CommentGraphProfile` — Claude reads top comments → externalPerception[], communityTone |
| Bio parse | `parseBio()` | `BioSignals` — bioKeywords[], bioRoles[] extracted from bio text |
| Caption signals | `extractMediaCaptionSignals()` | topHashtags[], captionMentions[] |
| Creator tier | `computeIgCreatorTier()` | `IgCreatorTier`: `micro` (>10k followers), `hobby` (has media), `private` |

**Identity fields produced (InstagramIdentity interface):**
```
username, city, aesthetic, lifestyle, brandVibes[], musicVibe, foodVibe, travelStyle,
activityPattern, interests[], rawSummary, displayName, profilePicture, followersCount,
mediaCount, topHashtags[], captionMentions[], igPostingCadence, igCreatorTier,
visual: { sceneCategories, colorPalette, cuisineTypes, locationTypes, fashionStyle, aesthetic },
bioKeywords[], bioRoles[], personality: { expressive, humor, introspective },
captionIntent, temporal: { activityPattern, peakDays }, engagement: { engagementTier, socialVisibility },
commentGraph: { externalPerception[], communityTone }
```

**Supplementary: Instagram Insights — `src/lib/server/instagramInsights.ts`**
- `computeInstagramInsightsFromMedia()` — deterministic stats from media array (posting frequency, format distribution, engagement velocity)
- `instagramInsightsToGraphTags()` — converts to `igInsightsTags[]` appended to identity

---

### 1.2 Spotify — `src/lib/server/spotify.ts`

**OAuth scope:** `user-top-read`, `playlist-read-private`, `user-library-read`

**Data fetched (`fetchSpotifyEnrichedData()`):**
- Top artists (long/medium/short term), top tracks
- Audio features for top tracks (danceability, energy, valence, tempo, acousticness, instrumentalness)
- Followed playlists (names only)

**Analysis (`analyseSpotifyIdentityEnriched()`):**

| Function | Purpose |
|----------|---------|
| `genreHistogram()` | Aggregates genre tags from all top artists, produces `genres[]` and `topGenres[]` |
| `moodTagsFromFeatures()` | Averages audio features → mood tags: high energy, danceable, acoustic, chill, melancholic, upbeat, intense |
| `lifestyleFromPlaylists()` | Playlist name keywords → lifestyle signals (gym/workout, chill/sleep, road trip, etc.) |
| `cultureTagsFromGenres()` | Genre → cultural affinity tags (desi, afrobeats, K-pop, underground, etc.) |
| `intentFromMusic()` | Derives `musicIntentHints[]` — purchase/discovery/social intent from music profile |

**Identity fields produced (SpotifyIdentity):**
```
topArtists[], topGenres[], topTracks[], musicPersonality (string), vibeDescription (string),
musicDescriptorTags[], musicLifestyleTags[], musicCultureTags[], audioFeatureMoodTags[],
listeningBehaviorTags[], musicIntentHints[]: { intent, confidence, context }
```

**Legacy function:** `analyseSpotifyIdentity()` (artists+tracks only, no audio features) — still present but deprecated in favor of enriched flow.

---

### 1.3 Apple Music — `src/lib/server/applemusic.ts`

**Auth:** MusicKit JS user token (`Music-User-Token`) + server-generated JWT developer token

**Data fetched (`fetchAppleMusicData()`):**

| Source | Function | Signal |
|--------|----------|--------|
| Heavy rotation | `/v1/me/history/heavy-rotation` | Highest-play artists/albums/tracks |
| Recently played | `/v1/me/recent/played/tracks` | Recency-weighted tracks |
| Library songs | `/v1/me/library/songs` | Broad library (fallback) |
| Library artists | `/v1/me/library/artists` | All library artists (broader than rotation) |
| Loved songs | `/v1/me/ratings/songs` (loved only) | **Highest-intent signal** — explicit preference |
| Recommendations | `/v1/me/recommendations` | Apple's own inference about user taste |
| Latest releases | Catalog lookups per artist | Fresh content from known artists |
| Playlists | `/v1/me/library/playlists` | Playlist names as lifestyle signal |

**Snapshot type (`AppleMusicFetchedSnapshot`):**
```
artists[], albums[], genres[], rotationPlaylists[], libraryPlaylistNames[], latestReleases[],
heavyRotationTracks[], recentlyPlayed[], libraryArtists[], lovedSongs[], recommendedNames[],
storefront, artworkMap, genreFrequency, durationStats, releaseYearDist
```

**Analysis (`analyseAppleMusicIdentity()`):** Claude-powered — receives all snapshot data, produces:
```
topArtists[], topGenres[], musicPersonality, vibeDescription, rotationPlaylists[],
libraryPlaylists[], latestReleases[], heavyRotationTracks[], recentlyPlayed[],
libraryArtists[], lovedSongs[], recommendedNames[]
```

**Priority note:** `lovedSongs` is treated as highest-intent music signal. `heavyRotationTracks` drives the `appleListeningHint` in the identity graph.

---

### 1.4 Google / YouTube / Gmail / Calendar — `src/lib/server/google.ts`

**OAuth scopes:** YouTube Data API, Gmail readonly, Calendar readonly, userinfo

**Data fetched:**

| Component | Function | Data |
|-----------|----------|------|
| YouTube | `fetchYouTubeData()` | Subscribed channels (title, description), liked video categories, video tags |
| Gmail | `fetchGmailSummary()` | Thread subjects (anonymized), sender domains — privacy-safe |
| Calendar | `fetchCalendarEvents()` | Events for next 7 days |
| User info | Direct OAuth endpoint | email, name, picture |

**Google Twin — `src/lib/server/signalProcessor/googleProcessor.ts`**
- `computeGoogleTwinForToken()` — synthesizes calendar + Gmail → behavioral twin:
  - `insights[]` — behavioral summary sentences (never referencing raw mail/calendar data)
  - `lifestyle.dominantCalendarTypes[]` — inferred from event patterns (fitness, food_social, work, travel)
  - `lifestyle.scheduleDensity`, `lifestyle.workIntensity`
  - `spending.band`, `spending.categoryFocus` — inferred from merchant patterns in Gmail
  - `intent.plansHint`, `intent.nextEventTitle`
  - `topMerchantHints[]` — brand signals from purchase receipts

**Analysis (`analyseGoogleIdentity()`):** Claude-powered — receives YouTube channels/categories, Gmail thread themes, sender emails, user info, lifestyle patterns → produces `GoogleIdentity`:
```
topChannels[], topCategories[], contentPersonality, lifestyleSignals[], emailThemes[],
importantSenders[], twin: GoogleTwin
```

**YouTube standalone — `src/lib/server/youtube.ts`**
- `fetchYouTubeData()` — channels, categories, tags, video titles, channel descriptions
- `analyseYouTubeIdentity()` — Claude analysis → `YouTubeIdentity`: topChannels[], topCategories[], contentPersonality, lifestyleSignals[]
- Note: `google.ts` is preferred when Google OAuth is connected; YouTube standalone uses a separate OAuth

---

### 1.5 LinkedIn — `src/lib/server/linkedin.ts`

**OAuth scope:** `openid`, `profile`, `email`, `w_member_social`

**Data fetched (`fetchLinkedInProfile()`):**
- `/userinfo` (OpenID) → `name`, `email`, `picture`, `locale`
- `/v2/me` → `localizedHeadline`, `localizedFirstName`, `localizedLastName`

**Note:** LinkedIn partner API access is required for full profile (industry, skills, location). Current implementation uses available OpenID fields.

**Deterministic signals — `inferEmailDomainSignals()`:**
- No LLM needed: email domain → company type hints (gmail=consumer, corp domain=B2B, edu=student)

**Analysis (`analyseLinkedInIdentity()`):** Claude-powered — receives name, headline, industry, location, email → produces `LinkedInIdentity`:
```
name, headline, currentRole, currentCompany, industry, seniority, skills[], jobInterests[],
careerSummary, location, skillClusters[], industryAffinity[], professionalThemeTags[],
linkedinIntentHints[]: { intent, confidence, time_horizon }
```

---

### 1.6 Manual / Profile Signals

- `profile.city` — user-entered city (highest priority in city resolution)
- `profile.budget` — `low | mid | high` (user-set)
- `profile.interests[]` — onboarding interest selections
- `manualInterestTags[]` — fetched from `user_marketing_prefs` Supabase table via `getManualInterestTags()`

---

## 2. Identity Graph Construction

**File:** `src/lib/server/identity.ts`  
**Function:** `buildIdentityGraph(profile: RawProfile): IdentityGraph`  
**Lines:** 291–717

### 2.1 Input: RawProfile

```typescript
interface RawProfile {
  name?, city?, budget?, interests?,
  instagramIdentity?: InstagramIdentity | null,
  spotifyIdentity?: SpotifyIdentity | null,
  appleMusicIdentity?: { topArtists, topGenres, musicPersonality, ... } | null,
  googleIdentity?: { topChannels, topCategories, contentPersonality, lifestyleSignals, emailThemes, twin } | null,
  youtubeIdentity?: { topChannels, topCategories, contentPersonality, lifestyleSignals } | null,
  linkedinIdentity?: { name, headline, currentRole, ... } | null,
  manualInterestTags?, signalMeter?, hyperInference?, memoryGraph?
}
```

### 2.2 Field-by-Field Priority Logic

| Field | Priority Chain | Fallback |
|-------|---------------|---------|
| `city` | `profile.city` → `ig.city` → `li.location` | `'India'` |
| `name` | `profile.name` → `li.name` | `''` |
| `budget` | `profile.budget` | `'mid'` |
| `topArtists` | Spotify top 6 → Apple Music top 6; supplements with Apple library artists (8) + loved song artists | `[]` |
| `topGenres` | Spotify genres (5) → Apple Music genres (5) | `[]` |
| `topTracks` | Spotify only (4) | `[]` |
| `musicPersonality` | `sp.musicPersonality` → `am.musicPersonality` | `''` |
| `musicVibe` | `sp.vibeDescription` → `am.vibeDescription` → `ig.musicVibe` | `''` |
| `aesthetic` | `ig.aesthetic` → first 2 user interests joined | `''` |
| `brandVibes` | `ig.brandVibes` → `twin.topMerchantHints` (if IG empty) | `[]` |
| `foodVibe` | `ig.foodVibe` enriched with `visualCuisineTypes` if present | `''` |
| `travelStyle` | `ig.travelStyle` → `'often planning trips'` if Google Twin has travel calendar | `''` |
| `activities` | IG activityPattern + YouTube lifestyleSignals + IG interests (activity keywords) + Google calendar tags + signal meter behavior values | `[]` |
| `lifestyle` | `ig.lifestyle` | `''` |
| `lifestyleSignals` | YouTube/Google lifestyleSignals | `[]` |
| `role` | `li.currentRole` → parsed from `li.headline` via `roleFromHeadline()` | `''` |
| `company` | `li.currentCompany` | `''` |
| `industry` | `li.industry` | `''` |
| `headline` | `li.headline` | `''` |
| `contentCategories` | YouTube/Google topCategories | `[]` |
| `contentPersonality` | YouTube/Google contentPersonality | `''` |
| `topChannels` | YouTube/Google topChannels (max 8) | `[]` |
| `interests` | IG interests + profile interests + manualInterestTags + Google twin commerce + top signal meter values (deduped, max 16) | `[]` |
| `visualFashionStyle` | `ig.visual.fashionStyle` | `''` |
| `aesthetic` (final) | If IG has fashion style: `"${ig.aesthetic}, ${fashionStyle}"` else `ig.aesthetic` | `''` |
| `temporalPattern` | `ig.temporal.activityPattern` → Google twin schedule density hint | `''` |
| `engagementTier` | `ig.engagement.engagementTier` | `''` |
| `googleBehaviorHints` | Assembled from `twin.intent.plansHint`, `twin.lifestyle.workIntensity`, `twin.spending.band`, `twin.insights` | `[]` |
| `appleListeningHint` | Formatted string: heavy rotation + recent plays + loved songs + recommendations | `''` |

### 2.3 Trust Signal: `trustIgStyle`

Controls whether Instagram aesthetic is used as the style source for search queries:

```typescript
const trustIgStyle =
  hasVisualConfirmation ||        // ig.visual.aesthetic exists
  Boolean(rawSummarySnippet) ||   // IG has caption analysis
  Boolean(ig.aesthetic) ||        // IG has aesthetic string
  !(igCreatorTier === 'private' && hasStreamingIdentity);
  // If account is private AND user has Spotify/AM, fall back to music signals
```

When `trustIgStyle = false`, the `queryStyleHint` falls back to `interests[0] || topGenres[0] || musicVibe`.

### 2.4 IdentitySignalMeta

```typescript
export interface IdentitySignalMeta {
  hasStreamingIdentity: boolean;  // Spotify or Apple Music connected with data
  hasLinkedIn: boolean;           // LinkedIn has any meaningful professional data
  hasYoutube: boolean;            // YouTube has channels, lifestyle, or categories
  hasInstagram: boolean;          // Instagram connected with username or raw summary
  trustIgStyle: boolean;          // Whether to use IG aesthetic for style queries
}
```

### 2.5 Full IdentityGraph Interface

```typescript
export interface IdentityGraph {
  // Core identity
  name: string; city: string; budget: 'low' | 'mid' | 'high';

  // Music
  topArtists: string[]; topGenres: string[]; topTracks: string[];
  musicPersonality: string; musicVibe: string;

  // Aesthetic / lifestyle
  aesthetic: string; brandVibes: string[]; foodVibe: string; travelStyle: string;
  activities: string[]; lifestyle: string; lifestyleSignals: string[];

  // Professional (LinkedIn)
  role: string; company: string; industry: string; headline: string;
  linkedinLocation: string; skills: string[]; jobInterests: string[];

  // Content (YouTube/Google)
  contentCategories: string[]; contentPersonality: string; topChannels: string[];
  interests: string[];

  // Instagram creator signals
  topHashtags: string[]; captionMentions: string[];
  igPostingCadence: IgPostingCadence | null;
  igCreatorTier: IgCreatorTier | null;

  // Composite query strings (pre-built for search)
  musicQueryStr: string; styleQueryStr: string;
  activityQueryStr: string; professionalStr: string;
  rawSummarySnippet: string; queryStyleHint: string;

  // Visual analysis (from image AI)
  visualScenes: Record<string, number>;
  visualAesthetic: { brightness, tone, composition } | null;
  visualColorPalette: string[]; visualCuisineTypes: string[];
  visualLocationTypes: string[]; visualFashionStyle: string;

  // Personality / behavioral
  personality: { expressive: number; humor: number; introspective: number } | null;
  captionIntent: string; temporalPattern: string; temporalPeakDays: string[];
  engagementTier: string; socialVisibility: string;
  bioRoles: string[]; externalPerception: string[]; communityTone: string;

  // Google behavioral
  googleBehaviorHints: string[]; googleQueryBoosters: string[];
  googleSignalTags: string[]; googleIntentTokens: string[];

  // Apple Music
  appleListeningHint: string; appleMusicDescriptorTags: string[];

  // LinkedIn enriched
  linkedinCareerSnippet: string; skillClusters: string[];
  industryAffinity: string[]; professionalThemeTags: string[];
  linkedinIntentTokens: string[];

  // Spotify enriched
  musicDescriptorTags: string[]; musicLifestyleTags: string[];
  musicCultureTags: string[]; musicMoodTags: string[];
  listeningBehaviorTags: string[]; musicIntentTokens: string[];

  // IG metrics
  igMetricsHint: string; igInsightsTags: string[];

  // Manual
  manualTags: string[];

  // Narrative summaries
  musicSignalNarrative: string; professionalSignalNarrative: string;
  lifeRhythmNarrative: string;

  signalMeta: IdentitySignalMeta;

  // Persisted LLM layers (not set by buildIdentityGraph, added by refresh pipeline)
  inferenceIdentity?: InferenceIdentityWrapper;
  identityIntelligence?: IdentityIntelligenceWrapper;
  identitySnapshot?: IdentitySnapshotWrapper;
  signalMeter?: SignalMeterOutput;
  hyperInference?: HyperInferenceWrapper;
  memoryGraph?: MemoryGraphProjection;
  expressionLayer?: ExpressionLayer;
  expressionFeedback?: ExpressionFeedbackState;
}
```

---

## 3. Signal Weightage & Trust

**File:** `src/lib/server/signalMeter.ts`  
**Main export:** `buildSignalMeter(input: SignalMeterInput): SignalMeterOutput`  
**Lines:** 360–698

### 3.1 Score Formula

```typescript
// Behavioral spec comment in code: "strength 0.4, recency 0.3, frequency 0.2, confidence 0.1"
function scoreBase(signal): number {
  return clamp01(
    signal.strength  * 0.4 +
    signal.recency   * 0.3 +
    signal.frequency * 0.2 +
    signal.confidence * 0.1
  );
}
```

### 3.2 Cross-Platform Boost

Signals that appear on multiple platforms get an additive boost applied after `scoreBase()`:

```typescript
function crossPlatformBoost(distinctBuckets: number): number {
  if (distinctBuckets >= 3) return 0.08;
  if (distinctBuckets >= 2) return 0.04;
  return 0;
}

// Applied in mergeCandidates():
const base_score = clamp01(scoreBase(row) + crossPlatformBoost(row.platform_buckets.length));
```

### 3.3 Recency Scoring

```typescript
function recencyFromIso(iso?: string): number {
  // ≤ 1 day   → 1.0
  // ≤ 7 days  → 0.8
  // ≤ 30 days → 0.6
  // ≤ 90 days → 0.35
  // older     → 0.18
  // unknown   → 0.45 (neutral)
}
```

Recency is per-platform: `signalSyncMeta` in the merged profile stores ISO timestamps for last sync per platform (`spotify`, `apple_music`, `google`, `linkedin`, `instagram`).

### 3.4 Frequency Scoring

```typescript
// Array position → frequency (top of list = higher frequency)
function frequencyFromIndex(index, total, boost = 0): number {
  const score = 1 - index / Math.max(total, 1);
  return clamp01(0.42 + score * 0.45 + boost);
}
```

### 3.5 Platform Buckets

```
spotify / apple_music → 'music'
instagram             → 'instagram'
linkedin              → 'linkedin'
google                → 'google'
youtube               → 'youtube'
manual / profile      → 'manual'
```

Signals can carry multiple platform buckets when the same value appears on different platforms. The primary bucket (used for display) follows priority: music > instagram > linkedin > google > youtube > manual.

### 3.6 Signal Filtering

- Signals with `length < 3` are discarded (too short)
- Generic single-word signals (music, food, travel, design, fashion, lifestyle, content, business, work) are discarded unless `strength >= 0.75`
- After merge: signals with `final_score < 0.3` are discarded as noise
- After sort by `final_score`: output capped at 48 signals total

### 3.7 Merge Logic

When the same signal value appears from multiple sources:
- `strength` → `max(a, b) + 0.05` (small corroboration boost)
- `confidence` → `max(a, b)`
- `recency` → `max(a, b)` (use most recent sync)
- `frequency` → `max(a, b) + 0.05`
- `source` → union of source strings
- `platform_buckets` → union of all buckets
- `direction` → if mismatch between positive/negative → `'neutral'`

### 3.8 Intent-Weighted Scoring

`buildScoresByIntent()` maps each signal's base score through per-platform intent weights into `scores_by_intent: Partial<Record<IntentType, number>>`. Intent types: `action`, `purchase`, `identity`, `taste`, `growth`.

### 3.9 Signal Clusters

`buildClusters()` groups `WeightedSignal[]` into `SignalCluster[]` by theme using regex rules:

```
'design + product thinking'     → /design|product|ux|brand|editorial|creative/
'minimalist lifestyle'          → /minimal|editorial|warm modern|soft light|neutral|clean/
'founder content consumption'   → /founder|startup|operator|shipping|build|saas/
'indie music taste'             → /indie|alternative|rnb|neo-soul|electronic|house|jazz/
'community-first builder'       → /community|storytelling|creator|culture|documenter/
```

### 3.10 SignalMeterInput

The full input type for `buildSignalMeter()` (sourced from `SignalMeterInput` interface):

```typescript
interface SignalMeterInput {
  profileUpdatedAt?: string;
  signalSyncMeta?: Record<string, string>;  // per-platform ISO timestamps
  interests?: string[];
  manualInterestTags?: string[];
  instagramIdentity?: {
    aesthetic, lifestyle, brandVibes, musicVibe, activityPattern, interests,
    bioKeywords, bioRoles, captionIntent, igPostingCadence, igCreatorTier,
    topHashtags, captionMentions, followersCount,
    visual: { colorPalette, cuisineTypes, locationTypes, fashionStyle, aesthetic },
    commentGraph: { externalPerception, communityTone },
    igInsightsTags
  };
  spotifyIdentity?: { topArtists, topGenres, topTracks, musicPersonality, vibeDescription, listeningBehaviorTags };
  appleMusicIdentity?: { topArtists, topGenres, musicPersonality, vibeDescription, rotationPlaylists, ... };
  googleIdentity?: {
    topChannels, topCategories, contentPersonality, lifestyleSignals, emailThemes,
    twin: { insights, intent, lifestyle, spending }
  };
  linkedinIdentity?: { headline, currentRole, industry, skills, jobInterests, skillClusters, ... };
}
```

---

## 4. Inference Pipeline (LLM Layers)

All inference uses `claude-sonnet-4-5` (or configured model) via the Anthropic SDK with 120-second timeouts. Four LLM passes run in sequence (base inference) then parallel (intelligence + snapshot + hyper).

### 4.1 Layer 1: InferenceIdentity (Base)

**File:** `src/lib/server/marketplace/inferIdentityGraph.ts`  
**Functions:** `buildInferenceSignalBundle()`, `runInferenceFromBundle()`, `inferIdentityGraphEvolved()`

**Input bundle** (`buildInferenceSignalBundle()`):
```json
{
  "identity_summary": "<string, max 1200 chars>",
  "deterministic_graph_compact": {
    "topGenres": [], "topArtists": [], "interests": [], "aesthetic": "",
    "lifestyle": "", "brandVibes": [], "foodVibe": "", "travelStyle": "",
    "activities": [], "visualFashionStyle": "", "visual_scenes_top": [],
    "musicVibe": "", "budget": "", "igPostingCadence": "", "igCreatorTier": "",
    "temporalPattern": "", "temporalPeakDays": [], "engagementTier": "",
    "topHashtags": [], "captionIntent": "", "headline": "",
    "linkedinCareerSnippet": "", "professionalThemeTags": [],
    "musicDescriptorTags": [], "contentCategories": [], "lifestyleSignals": [],
    "googleSignalTags": [], "manualTags": [], "topChannels": [],
    "youtube_style_categories": [], "synced_platforms_this_run": [],
    "meaningful_platform_sync": false
  },
  "instagram_raw": { "rawSummary": "", "igMetricsHint": "", "aesthetic": "", ... },
  "linkedin_raw": { "headline": "", "careerSummary": "", "skills": [], ... },
  "spotify_raw": { "topGenres": [], "topArtists": [], "musicPersonality": "" },
  "apple_music_raw": { "topGenres": [], "topArtists": [] },
  "youtube_channels": [],
  "prior_inference_compact": { "intent_primary": "", "predictive_read_prior": {}, "life_domains_prior": [] },
  "behavioral_precalc": { ... }
}
```

**Max bundle size:** 15,000 characters (truncated)

**System prompt role:** "Advanced identity inference engine across LIFE DOMAINS"

**Output schema:**
```json
{
  "predictive_read": {
    "you_in_one_line": "punchy second-person sentence",
    "next_moves": ["3-5 concrete time-grounded actions"],
    "commerce_affinity": ["3-6 hedged brand/product lines"]
  },
  "intent": { "primary": "", "secondary": [], "confidence": 0 },
  "stage": { "category": "", "confidence": 0 },
  "behavior": {
    "creation_patterns": { "frequency": "", "content_types": [], "original_vs_consumption_ratio": "" },
    "engagement_patterns": { "engages_with": [], "interaction_depth": "", "network_type": "" },
    "temporal_patterns": { "active_hours": [], "consistency": "", "recent_trend": "" }
  },
  "interests": { "explicit": [], "latent": [] },
  "needs": { "immediate": [], "emerging": [] },
  "trajectory": { "direction": "", "velocity": "", "stage_shift_signals": [] },
  "derived_signals": {
    "builder_score": 0, "creator_score": 0, "consumer_score": 0,
    "momentum_score": 0, "taste_profile": "", "risk_appetite": ""
  },
  "content_profile": { "style": "", "themes": [], "strengths": [], "gaps": [] },
  "predictions": { "likely_next_actions": [], "short_term": [], "long_term": [] },
  "life_domains": [
    {
      "id": "music|shopping_style|career_work|sports_fitness|social_creator|travel_food|wellness|tech_media",
      "label": "", "confidence": 0, "salience_0_100": 0,
      "narrative": "2-4 sentences, second person",
      "evidence": [{ "text": "", "source": "platform" }],
      "signals": [], "consumption_vs_creation": "", "likely_next": []
    }
    // exactly 8 objects
  ]
}
```

**Throttle:** Re-runs only if: (a) forced, (b) meaningful platform sync occurred, (c) no prior inference, or (d) prior inference is older than 7 days (3× faster threshold = 2.3 days when 3+ platforms sync in one pass).

**Persistence:** Each new inference is inserted into `identity_inference_snapshots` table with revision number. The wrapper tracks `revision` and `inferredAt`.

---

### 4.2 Layer 2: IdentityIntelligence (Decision Layer)

**File:** `src/lib/server/marketplace/inferIdentityIntelligence.ts`  
**Functions:** `buildIdentityIntelligenceBundle()`, `inferIdentityIntelligenceFromBundle()`

**Input bundle** (`buildIdentityIntelligenceBundle()`):
```json
{
  "identity_summary": "<max 1400 chars>",
  "deterministic_graph_compact": { "topGenres": [], "topArtists": [], "interests": [], "aesthetic": "", "lifestyle": "", "brandVibes": [], "headline": "", "linkedinCareerSnippet": "", "igPostingCadence": "", "igCreatorTier": "", "captionIntent": "", "engagementTier": "", "manualTags": [] },
  "prior_domain_inference_compact": { "<condensed InferenceIdentityCurrent>" },
  "recency_context": "<string from buildRecencyContext()>",
  "user_query": "<optional string, highest priority lens>"
}
```

**Max bundle size:** 16,000 characters

**System prompt role:** "Real-time identity intelligence engine — decision layer; NOT descriptive. Produce sharp, actionable, time-relevant insight for a founder/operator."

**Rules in prompt:**
1. RECENCY > HISTORY — recency_context wins over stale narrative
2. ONE MOVE > MANY IDEAS — `decision.do_this_now` = single highest-leverage action
3. DETECT MODE — exactly one of: `building | executing | exploring | consuming | stuck | transitioning`
4. MISALIGNMENT — call out conflicts between intent and behavior
5. SPECIFICITY — no generic advice; name concrete moves
6. LEVERAGE — visibility, growth, direction validation

**Output schema:**
```json
{
  "snapshot": { "mode": "building|...", "one_line_state": "", "confidence": 0 },
  "now": { "focus": "", "pressure": "", "momentum": "" },
  "decision": { "do_this_now": "", "then_do": [], "stop_doing": [], "why_this_matters": "" },
  "blindspots": [{ "issue": "", "impact": "", "fix": "" }],
  "leverage": { "unfair_advantages": [], "underused_assets": [], "quick_wins": [] },
  "trajectory": { "direction": "", "risk": "", "next_critical_move": "" },
  "personalization": { "tone": "", "style": "", "response_format": "" }
}
```

**Max tokens:** 4,096

---

### 4.3 Layer 3: IdentitySnapshot (Compression Portrait)

**File:** `src/lib/server/marketplace/inferIdentitySnapshot.ts`  
**Functions:** `inferIdentitySnapshotFromBundle()`, `runIdentitySnapshotFromInputs()`

**Input bundle:** Reuses `buildIdentityIntelligenceBundle()` output directly (same bundle as Intelligence layer)

**System prompt role:** "Identity compression engine — compress identity graph into a sharp, emotionally resonant snapshot. Must feel like looking in a mirror."

**Rules in prompt:**
- ONE-LINER MUST HIT — specific, use proper nouns from data
- TAGS, NOT SENTENCES — max 1-3 words per tag
- ADD EDGE — include tension and contradiction
- MAKE IT SOCIAL-READY — one_liner should feel screenshotable
- BRAND-LEGIBLE — archetype must be 2-4 words

**Output schema:**
```json
{
  "one_liner": "specific punchy sentence",
  "archetype": "2-4 word brand-legible label",
  "vibe": ["4-10 tags"],
  "identity_tags": ["6-14 tags"],
  "current_mode": "building|executing|exploring|transitioning",
  "core_contradiction": "one sentence of central tension",
  "aesthetic_profile": { "visual": [], "brands": [], "spaces": [] },
  "shopping_style": { "type": "", "signals": [] },
  "taste": { "music": [], "media": [], "cultural": [] },
  "social_identity": { "how_people_see_you": "", "actual_you": "" },
  "status": { "level": "early stage|growth stage|established", "direction": "rising|pivoting|consolidating" }
}
```

**Max tokens:** 3,000

---

### 4.4 Layer 4: HyperInference (Behavioral Intelligence)

**File:** `src/lib/server/marketplace/inferHyperInference.ts`  
**Functions:** `buildHyperInferenceBundle()`, `inferHyperInferenceFromBundle()`

**Input bundle** (richest of all inference layers):
```json
{
  "identity_summary": "<max 1400 chars>",
  "deterministic_graph_compact": { "<full graph fields including narrative strings>" },
  "signal_meter": { "signals": [up to 80], "clusters": [up to 20], "dominant_patterns": [up to 25], "noise": [up to 15] },
  "cross_platform_snippets": { "instagram_raw": {}, "linkedin_raw": {}, "youtube_channels": [] },
  "recency_context": "<string>",
  "behavioral_precalc": { "<BehavioralPrecalcResult>" }
}
```

**Max bundle size:** 19,000 characters

**System prompt role:** "Behavioral intelligence engine (v2 schema)"

**Rules:** No single primary source — dynamically respect `behavioral_precalc.intent_classification.primary_intent_type`. Cross-platform corroboration: same theme on 2+ platforms → higher confidence, 3+ → mark as `strong` in `supporting_signals`.

**Output schema:**
```json
{
  "intent_type": "action|purchase|identity|taste|growth",
  "identity": { "archetype": "", "stage": "", "confidence": 0 },
  "depth_layer": { "core_drivers": [], "behavioral_loops": [], "decision_patterns": [], "attention_patterns": [] },
  "inference_layer": { "true_intent": "", "hidden_goals": [], "frictions": [], "identity_gap": "", "motivations": [] },
  "prediction_layer": [{ "action": "", "probability": 0, "timeframe": "", "confidence": 0, "supporting_signals": [] }],
  "economic_profile": { "spending_style": "", "price_sensitivity": "", "purchase_triggers": [], "brand_affinity": [] },
  "lifestyle": { "brands": [], "fashion": [], "music": [], "media": [], "places": [] },
  "confidence": {
    "overall": 0,
    "by_source": { "instagram": 0, "google": 0, "youtube": 0, "linkedin": 0, "music": 0 }
  },
  "non_obvious_insights": []
}
```

---

### 4.5 Layer 5: IdentitySynthesis (Multi-Layer Fusion)

**File:** `src/lib/server/marketplace/inferIdentitySynthesis.ts`  
**Functions:** `buildIdentitySynthesisBundle()`, `inferIdentitySynthesisFromBundle()`

**Special role:** This layer is NOT part of the standard refresh pipeline. It is a fusion pass that takes ALL prior LLM outputs as input and produces a rich multi-agent synthesis.

**Input bundle** (`buildIdentitySynthesisBundle()`):
```json
{
  "identity_summary": "", "deterministic_graph_compact": {}, "prior_domain_inference_compact": {},
  "recency_context": "",
  "synthesis_context": {
    "identity_snapshot":     "<IdentitySnapshotWrapper, max 14000 chars>",
    "identity_intelligence": "<IdentityIntelligenceWrapper, max 12000 chars>",
    "hyper_inference":       "<HyperInferenceWrapper, max 14000 chars>",
    "signal_meter":          "<SignalMeterOutput, max 8000 chars>",
    "memory_graph":          "<MemoryGraphProjection, max 8000 chars>"
  },
  "user_query": "<optional — highest-priority activation lens>"
}
```

**Max bundle size:** 28,000 characters

**Signal weights in prompt:** Music/audio = emotional + identity; Instagram = aesthetic + social; LinkedIn = professional; Google/YouTube = curiosity + intent; `user_query` = highest-priority.

**Output schema (7 agents):**
```json
{
  "activation": { "primary_agents": [], "user_query_echo": "", "rationale": "" },
  "fashion": { "style_archetype": "", "style_breakdown": {}, "brand_affinity": [], "product_suggestions": [], "avoid_patterns": [], "image_queries": [], "confidence": "" },
  "commerce": { "high_intent_categories": [], "aspirational_categories": [], "purchase_behavior": {}, "product_recommendations": [], "brand_affinity_map": [], "image_queries": [], "confidence": "" },
  "moodboard": { "aesthetic_archetype": "", "visual_themes": [], "color_palette": [{"name":"","hex":"#RRGGBB"}], "textures": [], "environments": [], "design_references": [], "image_queries": [], "confidence": "" },
  "taste_culture": { "taste_archetype": "", "genre_clusters": [], "emotional_profile": [], "cultural_positioning": "", "artist_affinities": [], "content_preferences": [], "image_queries": [], "confidence": "" },
  "professional": { "current_signal": "", "skill_graph": [], "suggested_roles": [], "trajectory_direction": "", "opportunity_gaps": [], "learning_recommendations": [], "confidence": "" },
  "behavioral": { "decision_style": "", "attention_pattern": "", "risk_profile": "", "social_orientation": "", "behavioral_traits": [], "contradictions": [], "confidence": "" },
  "synthesis": { "core_identity": "", "top_traits": [], "dominant_signals": [], "conflicts": [], "resolved_identity": "", "what_we_know_about_you": {}, "confidence": "" }
}
```

**Schema validation:** `src/lib/server/marketplace/inferenceIdentitySchema.ts` — typed parsers for each schema version with runtime validation. `parseInferenceIdentityCurrent()` tries V2 then falls back to V1.

---

## 5. Summary Generation

**File:** `src/lib/server/identity.ts`  
**Functions:** `identitySummary()` (L1230), `formatSignalPackForChat()` (L1295)

### 5.1 identitySummary()

Produces a `key: value | key: value` pipe-separated string from all meaningful graph fields, in priority order:

```
headline: <linkedin headline>
aesthetic: <if trustIgStyle>  OR  style_hint: <queryStyleHint if not trustIgStyle>
brands: <top 3 brandVibes>
music: <musicQueryStr>
ig_context: <rawSummarySnippet, max 200 chars>
watches: <contentPersonality, max 120 chars>
channels: <top 4 channels>
lifestyle: <lifestyle>
active: <top 3 activities>
food: <foodVibe>
travel: <travelStyle>
tags: <top 5 topHashtags>
works as: <professionalStr>
linkedin_skills: <top 5 skills>
linkedin: <linkedinCareerSnippet>
apple_listening: <appleListeningHint>
ig_metrics: <igMetricsHint>
roles: <bioRoles>
fashion: <visualFashionStyle>
cuisine: <visualCuisineTypes>
personality: expressive=X humor=Y
active_time: <temporalPattern>
perceived_as: <externalPerception>
engagement: <engagementTier>
behavior_signals: <googleBehaviorHints, max 240 chars>
music_graph: <musicSignalNarrative, max 160 chars>
pro_graph: <professionalSignalNarrative, max 160 chars>
google_tags: <top 8 googleSignalTags>
manual: <top 6 manualTags>
city: <city>
budget: <budget>
```

**If `inferenceIdentity` is present, appended at end:**
```
inference_read: <predictive_read.you_in_one_line, max 200 chars>
inference_intent: <intent.primary, max 120 chars>
inference_<domain_id>: <domain narrative, max 140 chars>  (top 3 domains)
```

### 5.2 formatSignalPackForChat()

Wraps the identity summary in a Tier A header for chat injection:

```
--- Tier A: Signal pack (ground every reply here; identity match beats SERP noise) ---
<summary, capped at 4000 chars by default>
```

Used in `ai.ts` `buildSystemPrompt()` as the primary identity context block.

---

## 6. Signal Refresh Flow

**File:** `src/routes/api/refresh-signals/+server.ts`  
**Entry point:** `POST /api/refresh-signals`

### 6.1 Input

```json
{
  "googleSub": "string",
  "forceInference": false,
  "forceIntelligence": false,
  "userQuery": "optional string"
}
```

### 6.2 Full Pipeline (runRefreshPipeline)

The route responds with **Server-Sent Events** streaming step progress to the client.

```
Step 1: Platform sync (parallel Promise.allSettled)
│
├── Instagram (if connected + token)
│   fetchInstagramProfile() + fetchInstagramMedia(limit=40)
│   expandCarouselChildren(maxCarousels=8, maxChildren=4)
│   analyseInstagramIdentity(profile, media, token)
│   computeInstagramInsightsFromMedia() → instagramInsightsToGraphTags()
│   → updated.instagramIdentity
│
├── Google (if connected + refresh/access token)
│   refreshGoogleToken(refreshToken) → fresh accessToken
│   fetchYouTubeData(accessToken) + fetchGmailSummary(accessToken) + computeGoogleTwinForToken(accessToken, city)
│   analyseGoogleIdentity(yt.channels, yt.categories, gmail.threads, gmail.senders, email, name, picture, twin.lifestylePatterns)
│   identity.twin = twinData
│   → updated.googleIdentity
│
├── Spotify (if connected + token)
│   fetchSpotifyEnrichedData(token)
│   analyseSpotifyIdentityEnriched(enriched)
│   → updated.spotifyIdentity
│
├── LinkedIn (if connected + token)
│   fetchLinkedInProfile(token) → name, email, headline, industry, country
│   analyseLinkedInIdentity(name, headline, industry, '', country, email)
│   → updated.linkedinIdentity
│
└── Apple Music (if connected + userToken + configured)
    generateDeveloperToken()
    fetchAppleMusicData(devToken, userToken) → AppleMusicFetchedSnapshot
    analyseAppleMusicIdentity(snap.artists, snap.albums, snap.genres, ...)
    → updated.appleMusicIdentity

Step 2: Merge + persist profile
│   merged = { ...profileData, ...updated, manualInterestTags }
│   signalSyncMeta updated with per-platform ISO timestamps
│   upsertProfile(googleSub, merged)

Step 3: Identity graph + signal meter
│   signalMeter = buildSignalMeter(merged)
│   graph = buildIdentityGraph({ ...merged, signalMeter })
│   behavioralPrecalc = buildBehavioralPrecalc(graph, signalMeter, merged)
│   summaryStr = identitySummary(graph)

Step 4: InferenceIdentity (throttled, sequential)
│   Throttle: 7 days (2.3 days if ≥3 platforms updated)
│   Runs if: forceInference || meaningfulPlatformSync || no prior || stale
│   buildInferenceSignalBundle(merged, graph, summaryStr, priorWrap.current, syncMeta, behavioralPrecalc)
│   runInferenceFromBundle(bundle) → InferenceIdentityCurrent
│   mergeNextInference(priorWrap, current) → InferenceIdentityWrapper
│   insertIdentityInferenceSnapshot(googleSub, revision, wrapper)
│   → graphData.inferenceIdentity

Step 5: Intelligence + Snapshot + HyperInference (parallel, if shouldRunIntelligence)
│   Runs if: shouldInfer || userQuery || forceIntelligence
│   recency = buildRecencyContext({ profileData: merged, updatedPlatformKeys })
│   
│   Promise.allSettled([
│     runIdentityIntelligenceFromInputs({ graph, summaryStr, inferenceCurrent, recency, userQuery })
│     runIdentitySnapshotFromInputs({ graph, summaryStr, inferenceCurrent, recency })
│     runHyperInferenceFromInputs({ graph, signalMeter, summaryStr, recency, merged, behavioralPrecalc })
│   ])
│   → graphData.identityIntelligence, graphData.identitySnapshot, graphData.hyperInference

Step 6: Memory graph
│   graphData.memoryGraph = projectMemoryGraph({ precalc: behavioralPrecalc, signalMeter, inferenceIdentity, hyperInference })

Step 7: Expression layer (async, non-blocking)
│   buildExpressionLayer({ mergedProfile: merged, graph, signalMeter, identitySummary: summaryStr })
│   → graphData.expressionLayer

Step 8: Persist identity graph
│   upsertIdentityGraph(googleSub, graphData)
│   → written to identity_graphs Supabase table

Step 9: Sync identity claims
│   syncIdentityClaimsFromGraph(googleSub, graphData, inferenceRevision)
│   → written to user_identity_claims Supabase table (with embeddings)
```

### 6.3 Client Entry Points

| Entry point | File | Method |
|-------------|------|--------|
| Profile page manual refresh | `src/routes/(app)/profile/+page.svelte` L278 | POST with SSE streaming |
| Earn page refresh | `src/routes/(app)/earn/+page.svelte` L255 | POST |
| Fire-and-forget stale refresh | `src/lib/client/maybeStaleGraphRefresh.ts` | POST, no await |

---

## 7. How the Graph is Consumed

### 7.1 Chat System Prompt — `src/lib/server/ai.ts`

`buildSystemPrompt()` assembles a full natural-language identity context for the digital twin:

- **Tier A (graph summary):** `formatSignalPackForChat(graph, summary)` — pipe-separated key:value block, max 4000 chars, injected as "Who they are: ..."
- **Platform blocks** (structured, per-platform detail):
  - `spotifyBlock` — top artists/genres/tracks/vibe (highest priority for music)
  - `appleMusicBlock` — heavy rotation, playlists, newest releases, genres
  - `youtubeBlock` — channels, categories, lifestyle signals, content personality, email themes
  - `googleRhythmBlock` — behavioral insights from Google Twin (never reveals raw mail/calendar data)
  - `linkedinBlock` — headline, role, company, seniority, skills, career summary
  - `igBase` — aesthetic, lifestyle, interests, brand vibes, food/travel/music vibes, caption summary
  - `visualBlock` — fashion style, cuisine types, location types, photo tone (from image AI)
  - `personalityBlock` — expressive/humor/introspective scores
  - `temporalBlock` — most active time + peak days
  - `engagementBlock` — engagement tier + social visibility
  - `perceptionBlock` — how others see them (from comment graph)
  - `rolesBlock` — bio-described roles
- **Learned memory** (from chat history): facts, preferences, recent topics, identity overrides
- **Probe hints** — when low-confidence signals exist, nudges the twin to naturally ask (food preferences, music taste, interests)

### 7.2 Home Recommendations — `src/lib/server/ai.ts`

`generateHomeRecommendations()` uses the graph for:
- Music: `topArtists`, `topGenres`, `musicVibe`
- Events: `city`, `activities`, `lifestyle`
- Style/fashion: `brandVibes`, `aesthetic`, `visualFashionStyle`
- Food: `foodVibe`, `visualCuisineTypes`

### 7.3 Search Queries — `src/lib/server/search.ts`

`buildSearchQueries(message, profile, learnedHints?, precomputedGraph?)` performs intent detection on the user's message and constructs Brave API queries using graph fields:

| Intent | Key graph fields used |
|--------|----------------------|
| Event | `city`, `topArtists[0]`, `topGenres[0]`, `visualLocationTypes[0]`, `aesthetic`, `activityQueryStr` |
| Music | `topArtists`, `topGenres`, `musicVibe` |
| Food | `city`, `foodVibe`, `visualCuisineTypes` (preferred over foodVibe when present) |
| Job | `city`, `role`, `industry` |
| Product | `brandVibes`, `queryStyleHint`, `aesthetic`, `topChannels` |
| General | `queryStyleHint`, `aesthetic`, `activityQueryStr`, `topChannels`, `city` |

Learned `preferences` from chat memory can add positive/negative modifiers (`prefSuffix`) to queries.

### 7.4 Domain-Specific Query Builders — `src/lib/server/identity.ts`

Six query builders for home feed tabs, each taking `IdentityGraph`:

| Builder | Tab | Key fields |
|---------|-----|-----------|
| `buildShopQueries()` | Shop | `brandVibes`, `aesthetic`, `topArtists`, `budget`, `visualFashionStyle`, `visualCuisineTypes`, `city` |
| `buildEventQueries()` | Events | `city`, `topArtists`, `topGenres`, `activities`, `foodVibe`, `lifestyle` |
| `buildLifestyleQueries()` | Lifestyle | `lifestyle`, `activities`, `foodVibe`, `travelStyle`, `city`, `contentCategories` |
| `buildNewsQueries()` | News | `industry`, `role`, `interests`, `topChannels`, `contentCategories` |
| `buildTribeQueries()` | Tribe | `topHashtags`, `aesthetic`, `interests`, `bioRoles`, `contentPersonality` |
| `buildVideoQueries()` | Videos | `topChannels`, `topGenres`, `topArtists`, `contentCategories`, `lifestyle` |

`pickDiverseQueries()` selects from candidates preferring distinct `QueryBucket` types, then filling by tier rank (ensures variety across shop/event/lifestyle/news/tribe/video).

### 7.5 Marketplace Matching

- `src/lib/server/marketplace/audienceMatch.ts` — matches creators to brand audience prompts using identity claims semantic search
- `src/lib/server/marketplace/creatorScoring.ts` — scores creator profiles against brand requirements
- `src/lib/server/marketplace/buildBrandIntelligenceBundles.ts` — bundles creator graph data for brand AI

### 7.6 Expression Layer — `src/lib/server/expression/buildExpressionLayer.ts`

`buildExpressionLayer()` takes the graph + signal meter and produces `ExpressionLayer`:
- `collectUnifiedSignals()` — aggregates signals from all sources
- `selectTopUnifiedSignals()` — picks highest-scored signals for display
- `runAtomsAndVibesLlm()` — Claude produces expression atoms (short identity tokens) and vibe labels, with `fallbackAtomsAndVibesFromSignals()` as the non-LLM fallback
- Output stored in `graphData.expressionLayer`

---

## 8. Behavioral Precalc

**File:** `src/lib/server/behavioralPrecalc.ts`  
**Function:** `buildBehavioralPrecalc(graph, signalMeter, mergedProfile): BehavioralPrecalcResult`

Deterministic (no LLM) preprocessing that runs before inference passes to provide structured intent context.

### 8.1 Output: BehavioralPrecalcResult

```typescript
interface BehavioralPrecalcResult {
  primary_intent_type: IntentType;           // 'action' | 'purchase' | 'identity' | 'taste' | 'growth'
  intent_scores: Record<IntentType, number>; // 0-1 per intent type
  cross_platform_themes: CrossPlatformTheme[];
  negative_signals: NegativeSignalItem[];
  platform_connected: Record<string, boolean>;
  matrix_summary: string;
}
```

### 8.2 Intent Classification (`classifyIntent()`)

Heuristic scoring using graph fields + signal meter weighted by platform:
- Music-heavy + low posting + no LinkedIn → `taste`
- High LinkedIn + low IG engagement → `growth` or `action`
- Active posting + high engagement + Instagram creator tier → `identity`
- Shopping signals + brand mentions → `purchase`
- Mixed signals → `action` (default)

### 8.3 Cross-Platform Themes (`extractCrossPlatformThemes()`)

Identifies themes present on multiple platforms using token overlap:
- `tier 3` (3+ platforms): highest confidence, added as `high_confidence_truth` edges in memory graph
- `tier 2` (2 platforms): medium confidence, used as anchors in inference
- Each theme has: `theme` (key), `label`, `platforms[]`, `tier`

```typescript
interface CrossPlatformTheme {
  theme: string;
  label: string;
  platforms: string[];
  tier: number;
}
```

### 8.4 Negative Signals (`deriveNegativeSignals()`)

Patterns that should dampen over-confident predictions:

```typescript
interface NegativeSignalItem {
  pattern: string;    // e.g. 'low_ig_engagement'
  implication: string;
  dampens: IntentType[];
}
```

Examples: `low_ig_engagement` dampens `identity`; `consume_not_create` dampens `action`; `no_music_signals` dampens `taste`.

### 8.5 Serialization for LLM Bundles

`precalcToBundleJson()` converts to compact JSON for inclusion in inference bundles:
```json
{
  "intent_classification": { "primary_intent_type": "", "intent_scores": {} },
  "platform_connected": {},
  "cross_platform_themes": [{ "theme": "", "label": "", "platforms": [], "tier": 0 }],
  "negative_signals": [{ "pattern": "", "implication": "", "dampens": [] }],
  "matrix_summary": ""
}
```

---

## 9. Memory Graph

**File:** `src/lib/server/memoryGraphProjection.ts`  
**Function:** `projectMemoryGraph(input): MemoryGraphProjection`

A graph (nodes + edges) projected from all other identity layers. No LLM; pure deterministic projection.

### 9.1 Node Types

| Type | Description |
|------|-------------|
| `user` | Root node (always `user_root`) |
| `intent_mode` | Primary intent from precalc |
| `platform` | Connected platforms (one node per platform bucket) |
| `theme` | Cross-platform themes from precalc (weight 0.95 if tier≥3, 0.75 otherwise) |
| `negative_pattern` | Negative signals from precalc |
| `signal` | Top 24 signals from signal meter (weight = final_score) |
| `prediction` | Predictions from HyperInference (weight = probability) |

### 9.2 Edge Types

| Type | Meaning |
|------|---------|
| `derived_from` | User → intent, inference → user, predictions → user |
| `observed_on` | Signal/user → platform |
| `reinforces` | Theme → intent |
| `high_confidence_truth` | Theme → user_root (only for tier 3 themes) |
| `dampens` | Negative pattern → intent (label = dampened intent types) |

### 9.3 Output Schema

```typescript
interface MemoryGraphProjection {
  version: string;
  generatedAt: string;
  nodes: MemoryGraphNode[];  // { id, type, label, weight?, meta? }
  edges: MemoryGraphEdge[];  // { id, from, to, type, label? }
}
```

---

## 10. Identity Claims

**Directory:** `src/lib/server/identityClaims/`

A vector-searchable claim store that enables semantic retrieval of identity facts during chat and marketplace matching.

### 10.1 Claim Schema (`types.ts`)

```typescript
type IdentityClaimKind =
  | 'evidence'    // raw platform-sourced facts
  | 'narrative'   // LLM-generated domain narratives
  | 'signal'      // scored signal meter values
  | 'prediction'  // behavioral predictions
  | 'graph_fact'  // deterministic graph fields
  | 'intent'      // intent classification results
  | 'interest'    // explicit/latent interests
  | 'need'        // immediate/emerging needs
  | 'trajectory'  // direction/velocity signals

interface IdentityClaimInsert {
  user_google_sub: string;
  assertion: string;       // natural language claim
  domain: string | null;   // e.g. 'music', 'career_work'
  source: string;          // 'graph' | 'inference' | 'hyper_inference'
  confidence: number | null;
  salience_0_100: number | null;
  inference_revision: number | null;
  claim_kind: IdentityClaimKind;
  content_fingerprint: string;  // SHA hash for deduplication
  payload: Record<string, unknown>;
  embedding: number[] | null;   // pgvector embedding
}
```

### 10.2 Claim Projection (`projectClaims.ts`)

`projectIdentityClaims(googleSub, graph, inference)` builds insert rows from:

**From graph (`graphClaims()`):**
- `graph_fact` claims for: city, headline, role/company/industry, music (top artists/genres/vibe), aesthetic, brandVibes, lifestyle, activities, budget, topHashtags, skills, igCreatorTier, engagementTier, visualFashionStyle, googleSignalTags, manualTags
- Each gets a `content_fingerprint` for change detection

**From inference wrapper (`inferenceClaims()`):**
- `intent` claims from `inference.current.intent`
- `narrative` claims per life domain (8 domains)
- `signal` claims from `inference.current.derived_signals`
- `prediction` claims from `inference.current.predictions.likely_next_actions`
- `need` claims from `inference.current.needs`
- `trajectory` claims from `inference.current.trajectory`
- `evidence` claims from life domain evidence bullets

### 10.3 Claim Queries (`queryClaims.ts`)

| Function | Method | Use case |
|----------|--------|---------|
| `searchIdentityClaimsSemantic()` | pgvector cosine similarity | Find claims semantically similar to a query |
| `searchIdentityClaimsStructured()` | Supabase RPC `match_identity_claims` | Filtered by domain, kind, confidence threshold |
| `rollupIdentityDomain()` | Structured search, format to text | Get all claims for a domain as readable block |
| `retrieveClaimsForUserTask()` | Semantic search, format to text | Compact block for injection into chat/search prompts |

### 10.4 Claim Tools (`identityTools.ts`)

Three tools exposed to the Claude chat model via tool use:

```typescript
// IDENTITY_MEMORY_TOOLS — tools the twin can call during chat
'recall_identity_domain'   // rollupIdentityDomain() — get all facts about a life domain
'search_identity_memory'   // searchIdentityClaimsSemantic() — semantic search across claims
'lookup_identity_fact'     // searchIdentityClaimsStructured() — structured lookup by kind/domain
```

`executeIdentityMemoryTool()` in `identityTools.ts` dispatches these at runtime. The twin uses these to retrieve deep identity facts without hallucinating.

### 10.5 Storage

`replaceUserIdentityClaims(googleSub, claims)` — full snapshot replacement after each refresh:
1. Embeds all claim assertions via `embedTexts()` (batch embedding API)
2. Deletes all existing claims for the user
3. Bulk inserts new claims with embeddings
4. Written to `user_identity_claims` Supabase table with pgvector column

---

## 11. Data Flow Diagram

```
PLATFORM APIs
─────────────────────────────────────────────────────────────────────────────
Instagram API          Spotify API       Apple Music API    Google APIs    LinkedIn API
     │                     │                   │                │               │
fetchInstagramProfile   fetchSpotifyEnrichedData  fetchAppleMusicData  fetchYouTubeData  fetchLinkedInProfile
fetchInstagramMedia      (artists,tracks,         (heavy rotation,     fetchGmailSummary  analyseLinkedInIdentity
expandCarouselChildren    playlists,features)      loved songs,library)  fetchCalendarEvents     │
analyseInstagramIdentity analyseSpotifyIdentityEnriched analyseAppleMusicIdentity analyseGoogleIdentity LinkedInIdentity
     │                     │                   │                │
     └──────────────────────┴───────────────────┴────────────────┘
                                    │
                              RawProfile (merged)
                                    │
                           buildSignalMeter()
                                    │
                            SignalMeterOutput
                       (48 weighted signals, clusters)
                                    │
                          buildIdentityGraph()
                                    │
                            IdentityGraph
                    (all fields, signalMeta, trustIgStyle)
                                    │
                      ┌─────────────┴──────────────┐
                      │                            │
              identitySummary()           buildBehavioralPrecalc()
                      │                            │
              pipe-separated string        BehavioralPrecalcResult
                      │                    (intent, themes, negatives)
                      │                            │
              ┌───────┴────────────────────────────┘
              │
    buildInferenceSignalBundle() → runInferenceFromBundle()
              │
    InferenceIdentityCurrent → mergeNextInference() → InferenceIdentityWrapper
              │
    ┌─────────┴────────────┬────────────────────────┐
    │                      │                        │
runIdentityIntelligence  runIdentitySnapshot   runHyperInference
    │                      │                        │
IdentityIntelligenceWrapper  IdentitySnapshotWrapper  HyperInferenceWrapper
    │                      │                        │
    └─────────────┬─────────────────────────────────┘
                  │
          projectMemoryGraph()
                  │
         MemoryGraphProjection
                  │
         buildExpressionLayer()
                  │
           ExpressionLayer
                  │
         upsertIdentityGraph()    → identity_graphs (Supabase)
         syncIdentityClaimsFromGraph() → user_identity_claims (Supabase, pgvector)

CONSUMERS
──────────────────────────────────────────────────────────────────────────
IdentityGraph + Summary
    ├── Chat (ai.ts) → buildSystemPrompt() → Claude twin
    ├── Search (search.ts) → buildSearchQueries() → Brave API
    ├── Home queries (identity.ts) → buildShopQueries/buildEventQueries/... → Brave API
    ├── Marketplace (audienceMatch.ts, creatorScoring.ts)
    └── Identity claims (user_identity_claims) → chat tool use (recall_identity_domain, search_identity_memory)
```

---

## Key Design Decisions

1. **Deterministic before LLM:** `buildIdentityGraph()` and `buildSignalMeter()` run without any LLM — pure rule-based. LLM inference runs on top as an enhancement layer, not a replacement.

2. **Platform priority is explicit, not learned:** The priority chains for each field (e.g., Spotify > Apple Music > IG for music) are hardcoded in `buildIdentityGraph()`, not dynamically weighted by the model.

3. **trustIgStyle guard:** A critical trust flag prevents the system from over-relying on IG aesthetic signals when the account is private and streaming music data is richer.

4. **Cross-platform boost in signal meter:** The explicit `+0.04/+0.08` boost for signals corroborated across 2/3+ platforms is the core mechanism for surfacing high-confidence identity facts.

5. **Inference throttling:** Re-inference is rate-limited to 7 days by default (2.3 days for large syncs) to avoid burning API tokens on trivial profile updates while staying fresh after meaningful platform changes.

6. **Claims as the retrieval layer:** The `user_identity_claims` pgvector store decouples identity facts from the raw graph structure, enabling semantic retrieval without re-reading the full graph JSON during chat.

7. **Synthesis is optional:** `inferIdentitySynthesis` (the multi-agent fusion) is NOT called in the standard refresh pipeline — it's available for on-demand activation (e.g., moodboard generation, brand brief creation) via separate routes.
