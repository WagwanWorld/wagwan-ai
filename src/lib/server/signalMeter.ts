import type {
  SignalCluster,
  SignalMeterDirection,
  SignalMeterOutput,
  SignalMeterType,
  WeightedSignal,
} from '$lib/types/signalMeter';
import {
  type IntentType,
  type PlatformBucket,
  INTENT_TYPES,
  PLATFORM_BUCKETS,
  averageIntentWeightsAcrossPlatforms,
} from '$lib/types/intentWeights';

type SyncMeta = Record<string, string>;

export interface SignalMeterInput {
  profileUpdatedAt?: string;
  signalSyncMeta?: SyncMeta;
  interests?: string[];
  manualInterestTags?: string[];
  instagramIdentity?: {
    username?: string;
    aesthetic?: string;
    lifestyle?: string;
    brandVibes?: string[];
    musicVibe?: string;
    activityPattern?: string;
    interests?: string[];
    bioKeywords?: string[];
    bioRoles?: string[];
    captionIntent?: string;
    igPostingCadence?: string;
    igCreatorTier?: string;
    topHashtags?: string[];
    captionMentions?: string[];
    followersCount?: number;
    visual?: {
      colorPalette?: string[];
      cuisineTypes?: string[];
      locationTypes?: string[];
      fashionStyle?: string;
      aesthetic?: { tone?: string; brightness?: string };
    };
    commentGraph?: {
      externalPerception?: string[];
      communityTone?: string;
    };
    igInsightsTags?: string[];
  } | null;
  spotifyIdentity?: {
    topArtists?: string[];
    topGenres?: string[];
    topTracks?: string[];
    musicPersonality?: string;
    vibeDescription?: string;
    listeningBehaviorTags?: string[];
  } | null;
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
  } | null;
  googleIdentity?: {
    topChannels?: string[];
    topCategories?: string[];
    contentPersonality?: string;
    lifestyleSignals?: string[];
    emailThemes?: string[];
    twin?: {
      insights?: string[];
      intent?: { plansHint?: string };
      lifestyle?: {
        dominantCalendarTypes?: string[];
        scheduleDensity?: string;
        workIntensity?: string;
      };
      spending?: {
        band?: string;
        categoryFocus?: string;
      };
    };
  } | null;
  linkedinIdentity?: {
    headline?: string;
    currentRole?: string;
    currentCompany?: string;
    industry?: string;
    skills?: string[];
    jobInterests?: string[];
    skillClusters?: string[];
    industryAffinity?: string[];
    professionalThemeTags?: string[];
    linkedinIntentHints?: Array<{ intent?: string; confidence?: number }>;
  } | null;
  firstPartySignals?: Array<{ value: string; category: string; type: string; strength: number; confidence: number; recency: number; frequency: number; source: string; platform_buckets: string[]; direction: string; context: string }>;
  feedbackAdjustments?: Array<{ target_value: string; target_category: string; multiplier: number }>;
}

interface SignalCandidate {
  type: SignalMeterType;
  category: string;
  value: string;
  context: string;
  strength: number;
  confidence: number;
  recency: number;
  frequency: number;
  source: string;
  /** Resolved platform bucket(s) for this row (comma = multi-source merge). */
  platform_buckets: PlatformBucket[];
  direction: SignalMeterDirection;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

function sourceTokensToBuckets(source: string): PlatformBucket[] {
  const parts = source
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  const set = new Set<PlatformBucket>();
  for (const p of parts) {
    if (p === 'spotify' || p === 'apple_music') set.add('music');
    else if (p === 'instagram') set.add('instagram');
    else if (p === 'linkedin') set.add('linkedin');
    else if (p === 'google') set.add('google');
    else if (p === 'youtube') set.add('youtube');
    else if (p === 'manual' || p === 'profile') set.add('manual');
    else set.add('manual');
  }
  return set.size ? [...set] : ['manual'];
}

function primaryBucket(buckets: PlatformBucket[]): PlatformBucket {
  for (const b of PLATFORM_BUCKETS) {
    if (buckets.includes(b)) return b;
  }
  return 'manual';
}

const PLATFORM_WEIGHTS: Record<string, { s: number; r: number; f: number; c: number }> = {
  manual:    { s: 0.50, r: 0.10, f: 0.10, c: 0.30 },
  instagram: { s: 0.45, r: 0.25, f: 0.15, c: 0.15 },
  linkedin:  { s: 0.35, r: 0.15, f: 0.10, c: 0.40 },
  music:     { s: 0.30, r: 0.35, f: 0.30, c: 0.05 },
  google:    { s: 0.35, r: 0.40, f: 0.20, c: 0.05 },
  youtube:   { s: 0.40, r: 0.25, f: 0.25, c: 0.10 },
};

/** Platform-stratified scoring: weights vary by platform bucket. */
function scoreBase(signal: {
  strength: number;
  recency: number;
  frequency: number;
  confidence: number;
  platform_bucket?: string;
}): number {
  const w = PLATFORM_WEIGHTS[signal.platform_bucket ?? 'manual'] ?? PLATFORM_WEIGHTS.manual;
  return clamp01(
    signal.strength * w.s +
      signal.recency * w.r +
      signal.frequency * w.f +
      signal.confidence * w.c,
  );
}

function crossPlatformBoost(distinctBuckets: number): number {
  if (distinctBuckets >= 3) return 0.08;
  if (distinctBuckets >= 2) return 0.04;
  return 0;
}

function buildScoresByIntent(baseScore: number, buckets: PlatformBucket[]): Partial<Record<IntentType, number>> {
  const out: Partial<Record<IntentType, number>> = {};
  for (const intent of INTENT_TYPES) {
    const w = averageIntentWeightsAcrossPlatforms(intent, buckets);
    out[intent] = clamp01(baseScore * w);
  }
  return out;
}

function clean(value: string | undefined | null): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function generic(value: string): boolean {
  const lower = value.toLowerCase();
  return new Set([
    'music',
    'food',
    'travel',
    'design',
    'fashion',
    'lifestyle',
    'content',
    'business',
    'work',
  ]).has(lower);
}

function recencyFromIso(iso?: string): number {
  const ts = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ts)) return 0.45;
  const ageMs = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  if (ageMs <= day) return 1;
  if (ageMs <= 7 * day) return 0.8;
  if (ageMs <= 30 * day) return 0.6;
  if (ageMs <= 90 * day) return 0.35;
  return 0.18;
}

function sourceRecency(input: SignalMeterInput, source: string): number {
  const meta = input.signalSyncMeta ?? {};
  const sourceIso =
    source === 'spotify'
      ? meta.spotify
      : source === 'apple_music'
        ? meta.apple_music
        : source === 'google'
          ? meta.google
          : source === 'linkedin'
            ? meta.linkedin
            : source === 'instagram'
              ? meta.instagram
              : input.profileUpdatedAt;
  return recencyFromIso(sourceIso ?? input.profileUpdatedAt);
}

function frequencyFromIndex(index: number, total: number, boost = 0): number {
  if (total <= 0) return clamp01(0.45 + boost);
  const score = 1 - index / Math.max(total, 1);
  return clamp01(0.42 + score * 0.45 + boost);
}

function splitList(raw: string | undefined | null): string[] {
  return clean(raw)
    .split(/[,;|/]+/)
    .map(clean)
    .filter(Boolean);
}

function addCandidate(
  out: SignalCandidate[],
  noise: Array<{ reason: string; discarded_signal: string }>,
  candidate: SignalCandidate,
): void {
  const value = clean(candidate.value);
  if (!value) return;
  if (value.length < 3) {
    noise.push({ reason: 'too_short', discarded_signal: value });
    return;
  }
  if (generic(value) && candidate.strength < 0.75) {
    noise.push({ reason: 'generic_signal', discarded_signal: value });
    return;
  }
  out.push({ ...candidate, value });
}

const EVIDENCE_K: Record<string, number> = {
  linkedin:  8,
  google:    12,
  instagram: 20,
  music:     5,
  manual:    3,
  youtube:   10,
};

/** Exponential saturation gate — sparse platforms get score dampened. */
function evidenceGate(nSignals: number, platform: string): number {
  const k = EVIDENCE_K[platform] ?? 10;
  return 1 - Math.exp(-nSignals / k);
}

function mergeCandidates(
  candidates: SignalCandidate[],
  feedbackAdjustments?: Array<{ target_value: string; target_category: string; multiplier: number }>,
): { merged: WeightedSignal[]; noise: Array<{ reason: string; discarded_signal: string }> } {
  type Acc = Omit<SignalCandidate, 'platform_buckets'> & { platform_buckets: PlatformBucket[] };
  const map = new Map<string, Acc>();
  const noise: Array<{ reason: string; discarded_signal: string }> = [];

  function unionBuckets(a: PlatformBucket[], b: PlatformBucket[]): PlatformBucket[] {
    return [...new Set([...a, ...b])];
  }

  for (const c of candidates) {
    const key = `${c.type}::${c.category.toLowerCase()}::${c.value.toLowerCase()}`;
    const existing = map.get(key);
    if (!existing) {
      const { platform_buckets: _pb, ...rest } = c;
      map.set(key, { ...rest, platform_buckets: [...c.platform_buckets] });
      continue;
    }
    const sources = new Set(
      `${existing.source},${c.source}`
        .split(',')
        .map(clean)
        .filter(Boolean),
    );
    map.set(key, {
      ...existing,
      context: existing.context.length >= c.context.length ? existing.context : c.context,
      strength: clamp01(Math.max(existing.strength, c.strength) + 0.05),
      confidence: clamp01(Math.max(existing.confidence, c.confidence)),
      recency: clamp01(Math.max(existing.recency, c.recency)),
      frequency: clamp01(Math.max(existing.frequency, c.frequency) + 0.05),
      source: [...sources].join(', '),
      direction: existing.direction === c.direction ? existing.direction : 'neutral',
      platform_buckets: unionBuckets(existing.platform_buckets, c.platform_buckets),
    });
  }

  // Count signals per platform bucket for evidence gating
  const bucketCounts: Record<string, number> = {};
  for (const c of candidates) {
    const pb = primaryBucket(c.platform_buckets);
    bucketCounts[pb] = (bucketCounts[pb] ?? 0) + 1;
  }

  const merged: WeightedSignal[] = [];
  for (const row of map.values()) {
    const pb = primaryBucket(row.platform_buckets);
    const boost = crossPlatformBoost(row.platform_buckets.length);
    const gate = evidenceGate(bucketCounts[pb] ?? 0, pb);
    const base_score = clamp01((scoreBase({ ...row, platform_bucket: pb }) + boost) * gate);
    const scores_by_intent = buildScoresByIntent(base_score, row.platform_buckets);
    let adjusted_score = base_score;
    if (feedbackAdjustments) {
      for (const adj of feedbackAdjustments) {
        const valueMatch = adj.target_value && row.value.toLowerCase().includes(adj.target_value.toLowerCase());
        const categoryMatch = adj.target_category && row.category.toLowerCase() === adj.target_category.toLowerCase();
        if (valueMatch || categoryMatch) {
          adjusted_score = clamp01(adjusted_score * adj.multiplier);
          break;
        }
      }
    }
    const ws: WeightedSignal = {
      type: row.type,
      category: row.category,
      value: row.value,
      context: row.context,
      strength: row.strength,
      confidence: row.confidence,
      recency: row.recency,
      frequency: row.frequency,
      source: row.source,
      platform_bucket: primaryBucket(row.platform_buckets),
      platform_buckets: row.platform_buckets,
      direction: row.direction,
      base_score,
      final_score: adjusted_score,
      scores_by_intent,
    };
    if (ws.final_score < 0.3) {
      noise.push({
        reason: 'low_final_score',
        discarded_signal: `${ws.category}: ${ws.value}`,
      });
      continue;
    }
    merged.push(ws);
  }

  merged.sort((a, b) => b.final_score - a.final_score);
  return { merged: merged.slice(0, 48), noise };
}

const CLUSTER_RULES: Array<{ theme: string; re: RegExp }> = [
  { theme: 'design + product thinking', re: /\bdesign|product|ux|brand|editorial|creative\b/i },
  { theme: 'minimalist lifestyle', re: /\bminimal|editorial|warm modern|soft light|neutral|clean\b/i },
  { theme: 'founder content consumption', re: /\bfounder|startup|operator|shipping|build|saas\b/i },
  { theme: 'indie music taste', re: /\bindie|alternative|rnb|neo-soul|electronic|house|jazz\b/i },
  { theme: 'community-first builder', re: /\bcommunity|storytelling|creator|culture|documenter\b/i },
];

/** Collapse inflated genre clusters into a single merged signal when >2 exist. */
function collapseGenreCluster(candidates: SignalCandidate[]): SignalCandidate[] {
  const genreSignals = candidates.filter(c => /genre/i.test(c.category));
  const rest = candidates.filter(c => !/genre/i.test(c.category));
  if (genreSignals.length <= 2) return candidates;

  const top3 = [...genreSignals].sort((a, b) => b.strength - a.strength).slice(0, 3);
  const collapsed: SignalCandidate = {
    type: top3[0].type,
    category: top3[0].category,
    value: top3.map(g => g.value).join(' / '),
    context: 'Collapsed genre cluster from listening history',
    strength: Math.max(...genreSignals.map(g => g.strength)),
    confidence: genreSignals[0].confidence,
    recency: Math.max(...genreSignals.map(g => g.recency)),
    frequency: genreSignals.reduce((sum, g) => sum + g.frequency, 0) / genreSignals.length,
    source: genreSignals[0].source,
    platform_buckets: genreSignals[0].platform_buckets,
    direction: genreSignals[0].direction,
  };

  return [...rest, collapsed];
}

const PLAYLIST_PATTERNS: Array<{ re: RegExp; value: string; context: string }> = [
  { re: /gym|workout|lift|gains|sweat|run|cardio/i,     value: 'fitness active',         context: 'Inferred from gym/workout playlist names' },
  { re: /party|turn up|hype|pregame|rave|festival/i,    value: 'active social life',      context: 'Inferred from party/social playlist names' },
  { re: /study|focus|deep work|grind|concentrate/i,     value: 'deep focus worker',       context: 'Inferred from study/focus playlist names' },
  { re: /chill|relax|vibe|lofi|lo-fi|mellow|calm/i,    value: 'calm / introspective',    context: 'Inferred from chill/relax playlist names' },
  { re: /travel|road trip|drive|cruise|jet/i,           value: 'travel lifestyle',        context: 'Inferred from travel playlist names' },
  { re: /morning|sunrise|wake|coffee|commute/i,         value: 'structured morning routine', context: 'Inferred from morning routine playlist names' },
  { re: /night|late|sleep|wind down|moonlight/i,        value: 'night owl tendencies',    context: 'Inferred from night/sleep playlist names' },
  { re: /cook|kitchen|dinner|brunch|foodie/i,           value: 'food culture interest',   context: 'Inferred from cooking/food playlist names' },
];

/** Extract lifestyle signals from Apple Music playlist names. */
function playlistNameToContextSignals(playlistNames: string[], recency: number): SignalCandidate[] {
  const out: SignalCandidate[] = [];
  for (const name of playlistNames) {
    for (const pattern of PLAYLIST_PATTERNS) {
      if (pattern.re.test(name)) {
        out.push({
          type: 'behavior',
          category: 'playlist lifestyle signal',
          value: pattern.value,
          context: pattern.context,
          strength: 0.62,
          confidence: 0.65,
          recency,
          frequency: 0.55,
          source: 'apple_music',
          platform_buckets: ['music'],
          direction: 'positive',
        });
        break; // one signal per playlist name
      }
    }
  }
  return out;
}

const APPLE_MUSIC_TIERS: Record<string, { strength: number; confidence: number }> = {
  lovedSongs:       { strength: 0.92, confidence: 0.90 },
  heavyRotation:    { strength: 0.75, confidence: 0.70 },
  recentlyPlayed:   { strength: 0.55, confidence: 0.50 },
  libraryArtists:   { strength: 0.45, confidence: 0.40 },
  recommendedNames: { strength: 0.30, confidence: 0.25 },
};

/** Convert Instagram captionMentions to high-confidence intent signals. */
function captionMentionsToSignals(mentions: string[], recency: number): SignalCandidate[] {
  return mentions.map(mention => ({
    type: 'intent' as SignalMeterType,
    category: 'caption mention',
    value: mention,
    context: 'Brand or entity explicitly mentioned in Instagram captions',
    strength: 0.80,
    confidence: 0.95,
    recency,
    frequency: 0.65,
    source: 'instagram',
    platform_buckets: ['instagram'] as PlatformBucket[],
    direction: 'positive' as SignalMeterDirection,
  }));
}

function buildClusters(signals: WeightedSignal[]): SignalCluster[] {
  const clusters: SignalCluster[] = [];
  for (const rule of CLUSTER_RULES) {
    const matched = signals.filter(signal =>
      rule.re.test(`${signal.value} ${signal.context} ${signal.category}`),
    );
    if (!matched.length) continue;
    const intensity =
      matched.reduce((sum, signal) => sum + signal.final_score, 0) / matched.length;
    clusters.push({
      theme: rule.theme,
      signals: matched.slice(0, 5).map(signal => signal.value),
      intensity: clamp01(intensity),
    });
  }
  return clusters.sort((a, b) => b.intensity - a.intensity).slice(0, 8);
}

export function buildSignalMeter(input: SignalMeterInput): SignalMeterOutput {
  const candidates: SignalCandidate[] = [];
  const rawNoise: Array<{ reason: string; discarded_signal: string }> = [];

  const ig = input.instagramIdentity;
  const sp = input.spotifyIdentity;
  const am = input.appleMusicIdentity;
  const google = input.googleIdentity;
  const li = input.linkedinIdentity;
  const twin = google?.twin;

  const igRecency = sourceRecency(input, 'instagram');
  const spotifyRecency = sourceRecency(input, 'spotify');
  const appleRecency = sourceRecency(input, 'apple_music');
  const googleRecency = sourceRecency(input, 'google');
  const linkedinRecency = sourceRecency(input, 'linkedin');
  const manualRecency = sourceRecency(input, 'manual');

  if (ig?.igPostingCadence) {
    addCandidate(candidates, rawNoise, {
      type: 'behavior',
      category: 'posting cadence',
      value: `${ig.igPostingCadence} posting cadence`,
      context: 'Instagram publishing rhythm',
      strength: /daily|weekly/i.test(ig.igPostingCadence) ? 0.86 : 0.62,
      confidence: 0.9,
      recency: igRecency,
      frequency: /daily/i.test(ig.igPostingCadence) ? 0.95 : 0.72,
      source: 'instagram',
      platform_buckets: sourceTokensToBuckets('instagram'),
      direction: 'positive',
    });
  }

  for (const [index, value] of (ig?.interests ?? []).slice(0, 8).entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'interest',
      category: 'instagram interest',
      value,
      context: 'Repeated themes inferred from Instagram identity',
      strength: 0.72,
      confidence: 0.7,
      recency: igRecency,
      frequency: frequencyFromIndex(index, ig?.interests?.length ?? 1),
      source: 'instagram',
      platform_buckets: sourceTokensToBuckets('instagram'),
      direction: 'positive',
    });
  }

  for (const [index, value] of (ig?.brandVibes ?? []).slice(0, 6).entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'taste',
      category: 'brand vibe',
      value,
      context: 'Instagram aesthetic and brand affinity',
      strength: 0.68,
      confidence: 0.65,
      recency: igRecency,
      frequency: frequencyFromIndex(index, ig?.brandVibes?.length ?? 1),
      source: 'instagram',
      platform_buckets: sourceTokensToBuckets('instagram'),
      direction: 'positive',
    });
  }

  for (const value of [ig?.aesthetic, ig?.lifestyle, ig?.musicVibe, ig?.captionIntent]) {
    if (!clean(value)) continue;
    addCandidate(candidates, rawNoise, {
      type: value === ig?.captionIntent ? 'intent' : 'taste',
      category: value === ig?.captionIntent ? 'caption intent' : 'instagram descriptor',
      value: value!,
      context: 'Instagram identity summary',
      strength: 0.74,
      confidence: 0.72,
      recency: igRecency,
      frequency: 0.6,
      source: 'instagram',
      platform_buckets: sourceTokensToBuckets('instagram'),
      direction: 'positive',
    });
  }

  for (const [index, value] of (ig?.bioRoles ?? []).slice(0, 5).entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'intent',
      category: 'bio role',
      value,
      context: 'How the user describes themselves publicly',
      strength: 0.78,
      confidence: 0.85,
      recency: igRecency,
      frequency: frequencyFromIndex(index, ig?.bioRoles?.length ?? 1, 0.05),
      source: 'instagram',
      platform_buckets: sourceTokensToBuckets('instagram'),
      direction: 'positive',
    });
  }

  for (const [index, value] of (ig?.igInsightsTags ?? []).slice(0, 8).entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'behavior',
      category: 'instagram pattern',
      value,
      context: 'Deterministic media and caption insights',
      strength: 0.66,
      confidence: 0.76,
      recency: igRecency,
      frequency: frequencyFromIndex(index, ig?.igInsightsTags?.length ?? 1),
      source: 'instagram',
      platform_buckets: sourceTokensToBuckets('instagram'),
      direction: 'positive',
    });
  }

  for (const signal of captionMentionsToSignals(ig?.captionMentions ?? [], igRecency)) {
    addCandidate(candidates, rawNoise, signal);
  }

  for (const [index, value] of (sp?.topGenres ?? am?.topGenres ?? []).slice(0, 6).entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'taste',
      category: 'music genre',
      value,
      context: 'Listening history',
      strength: 0.82,
      confidence: 0.92,
      recency: Math.max(spotifyRecency, appleRecency),
      frequency: frequencyFromIndex(index, (sp?.topGenres ?? am?.topGenres ?? []).length, 0.08),
      source: sp?.topGenres?.length ? 'spotify' : 'apple_music',
      platform_buckets: sourceTokensToBuckets(sp?.topGenres?.length ? 'spotify' : 'apple_music'),
      direction: 'positive',
    });
  }

  for (const [index, value] of (sp?.topArtists ?? am?.topArtists ?? []).slice(0, 6).entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'taste',
      category: 'artist affinity',
      value,
      context: 'Top artists from listening history',
      strength: 0.8,
      confidence: 0.9,
      recency: Math.max(spotifyRecency, appleRecency),
      frequency: frequencyFromIndex(index, (sp?.topArtists ?? am?.topArtists ?? []).length, 0.06),
      source: sp?.topArtists?.length ? 'spotify' : 'apple_music',
      platform_buckets: sourceTokensToBuckets(sp?.topArtists?.length ? 'spotify' : 'apple_music'),
      direction: 'positive',
    });
  }

  for (const value of [
    sp?.musicPersonality,
    sp?.vibeDescription,
    am?.musicPersonality,
    am?.vibeDescription,
  ]) {
    if (!clean(value)) continue;
    addCandidate(candidates, rawNoise, {
      type: 'taste',
      category: 'music identity',
      value: value!,
      context: 'Music personality summary',
      strength: 0.7,
      confidence: 0.74,
      recency: Math.max(spotifyRecency, appleRecency),
      frequency: 0.58,
      source: clean(sp?.musicPersonality || sp?.vibeDescription) ? 'spotify' : 'apple_music',
      platform_buckets: sourceTokensToBuckets(
        clean(sp?.musicPersonality || sp?.vibeDescription) ? 'spotify' : 'apple_music',
      ),
      direction: 'positive',
    });
  }

  // Apple Music tier-based ingestion
  for (const [index, track] of (am?.heavyRotationTracks ?? []).slice(0, 6).entries()) {
    const value = clean([track.title, track.artistName].filter(Boolean).join(' — '));
    if (!value) continue;
    const tier = APPLE_MUSIC_TIERS.heavyRotation;
    addCandidate(candidates, rawNoise, {
      type: 'taste',
      category: 'heavy rotation track',
      value,
      context: 'Track in heavy rotation on Apple Music',
      strength: tier.strength,
      confidence: tier.confidence,
      recency: appleRecency,
      frequency: frequencyFromIndex(index, am?.heavyRotationTracks?.length ?? 1, 0.05),
      source: 'apple_music',
      platform_buckets: sourceTokensToBuckets('apple_music'),
      direction: 'positive',
    });
  }

  for (const [index, track] of (am?.recentlyPlayed ?? []).slice(0, 6).entries()) {
    const value = clean([track.title, track.artistName].filter(Boolean).join(' — '));
    if (!value) continue;
    const tier = APPLE_MUSIC_TIERS.recentlyPlayed;
    addCandidate(candidates, rawNoise, {
      type: 'taste',
      category: 'recently played track',
      value,
      context: 'Recently played on Apple Music',
      strength: tier.strength,
      confidence: tier.confidence,
      recency: appleRecency,
      frequency: frequencyFromIndex(index, am?.recentlyPlayed?.length ?? 1),
      source: 'apple_music',
      platform_buckets: sourceTokensToBuckets('apple_music'),
      direction: 'positive',
    });
  }

  // Apple Music playlist name → lifestyle signals
  const allPlaylists = [...(am?.rotationPlaylists ?? []), ...(am?.libraryPlaylists ?? [])];
  for (const signal of playlistNameToContextSignals(allPlaylists, appleRecency)) {
    addCandidate(candidates, rawNoise, signal);
  }

  for (const [index, value] of (google?.topChannels ?? []).slice(0, 8).entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'consumption',
      category: 'youtube channel',
      value,
      context: 'YouTube subscription and watch graph',
      strength: 0.66,
      confidence: 0.76,
      recency: googleRecency,
      frequency: frequencyFromIndex(index, google?.topChannels?.length ?? 1),
      source: 'youtube',
      platform_buckets: sourceTokensToBuckets('youtube'),
      direction: 'positive',
    });
  }

  for (const [index, value] of (google?.emailThemes ?? []).slice(0, 6).entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'intent',
      category: 'gmail theme',
      value,
      context: 'Gmail metadata themes',
      strength: 0.58,
      confidence: 0.62,
      recency: googleRecency,
      frequency: frequencyFromIndex(index, google?.emailThemes?.length ?? 1),
      source: 'google',
      platform_buckets: sourceTokensToBuckets('google'),
      direction: 'positive',
    });
  }

  for (const [index, value] of (google?.topCategories ?? []).slice(0, 6).entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'consumption',
      category: 'content category',
      value,
      context: 'Google and YouTube consumption',
      strength: 0.64,
      confidence: 0.74,
      recency: googleRecency,
      frequency: frequencyFromIndex(index, google?.topCategories?.length ?? 1),
      source: 'google',
      platform_buckets: sourceTokensToBuckets('google'),
      direction: 'positive',
    });
  }

  for (const [index, value] of (google?.lifestyleSignals ?? []).slice(0, 6).entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'behavior',
      category: 'lifestyle signal',
      value,
      context: 'Lifestyle inferred from calendar and browsing behavior',
      strength: 0.68,
      confidence: 0.68,
      recency: googleRecency,
      frequency: frequencyFromIndex(index, google?.lifestyleSignals?.length ?? 1),
      source: 'google',
      platform_buckets: sourceTokensToBuckets('google'),
      direction: 'positive',
    });
  }

  for (const value of [
    twin?.intent?.plansHint,
    ...(twin?.insights ?? []).slice(0, 4),
  ]) {
    if (!clean(value)) continue;
    addCandidate(candidates, rawNoise, {
      type: 'intent',
      category: 'google twin intent',
      value: value!,
      context: 'Recent plans and schedule direction',
      strength: 0.72,
      confidence: 0.64,
      recency: googleRecency,
      frequency: 0.62,
      source: 'google',
      platform_buckets: sourceTokensToBuckets('google'),
      direction: 'positive',
    });
  }

  for (const value of twin?.lifestyle?.dominantCalendarTypes ?? []) {
    addCandidate(candidates, rawNoise, {
      type: 'behavior',
      category: 'calendar pattern',
      value,
      context: 'Dominant calendar categories',
      strength: 0.7,
      confidence: 0.78,
      recency: googleRecency,
      frequency: 0.72,
      source: 'google',
      platform_buckets: sourceTokensToBuckets('google'),
      direction: 'positive',
    });
  }

  for (const value of [li?.headline, li?.currentRole, li?.industry]) {
    if (!clean(value)) continue;
    addCandidate(candidates, rawNoise, {
      type: 'intent',
      category: 'professional identity',
      value: value!,
      context: 'LinkedIn public professional signal',
      strength: 0.8,
      confidence: 0.88,
      recency: linkedinRecency,
      frequency: 0.7,
      source: 'linkedin',
      platform_buckets: sourceTokensToBuckets('linkedin'),
      direction: 'positive',
    });
  }

  for (const [index, value] of [
    ...(li?.skills ?? []),
    ...(li?.skillClusters ?? []),
    ...(li?.professionalThemeTags ?? []),
  ].slice(0, 10).entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'intent',
      category: 'professional skill',
      value,
      context: 'LinkedIn skill and theme signal',
      strength: 0.74,
      confidence: 0.82,
      recency: linkedinRecency,
      frequency: frequencyFromIndex(index, (li?.skills?.length ?? 0) + (li?.skillClusters?.length ?? 0) + (li?.professionalThemeTags?.length ?? 0)),
      source: 'linkedin',
      platform_buckets: sourceTokensToBuckets('linkedin'),
      direction: 'positive',
    });
  }

  for (const [index, value] of [...(input.manualInterestTags ?? []), ...(input.interests ?? [])]
    .slice(0, 10)
    .entries()) {
    addCandidate(candidates, rawNoise, {
      type: 'interest',
      category: index < (input.manualInterestTags ?? []).length ? 'manual tag' : 'profile interest',
      value,
      context: 'Self-declared signal',
      strength: 0.58,
      confidence: index < (input.manualInterestTags ?? []).length ? 0.92 : 0.78,
      recency: manualRecency,
      frequency: frequencyFromIndex(index, (input.manualInterestTags?.length ?? 0) + (input.interests?.length ?? 0), 0.03),
      source: index < (input.manualInterestTags ?? []).length ? 'manual' : 'profile',
      platform_buckets: sourceTokensToBuckets(
        index < (input.manualInterestTags ?? []).length ? 'manual' : 'profile',
      ),
      direction: 'positive',
    });
  }

  // Inject first-party signals (fetched async by caller)
  if (input.firstPartySignals) {
    for (const fp of input.firstPartySignals) {
      addCandidate(candidates, rawNoise, {
        type: (fp.type ?? 'interest') as SignalMeterType,
        category: fp.category,
        value: fp.value,
        context: fp.context ?? 'First-party activity signal',
        strength: fp.strength,
        confidence: fp.confidence,
        recency: fp.recency,
        frequency: fp.frequency,
        source: fp.source,
        platform_buckets: (fp.platform_buckets ?? []) as PlatformBucket[],
        direction: (fp.direction ?? 'positive') as SignalMeterDirection,
      });
    }
  }

  const { merged, noise } = mergeCandidates(collapseGenreCluster(candidates), input.feedbackAdjustments);
  const clusters = buildClusters(merged);
  const dominant_patterns = clusters.slice(0, 5).map(cluster => cluster.theme);

  return {
    signals: merged,
    clusters,
    dominant_patterns,
    noise: [...rawNoise, ...noise].slice(0, 32),
  };
}

