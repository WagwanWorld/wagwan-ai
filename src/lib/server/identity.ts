/**
 * Identity Graph — centralised signal extraction from all connected platforms.
 *
 * There is no single global “primary” source: narrative emphasis follows
 * `behavioralPrecalc.primary_intent_type`, and the signal meter attaches
 * per-intent scores (`scores_by_intent`) plus platform buckets. Typical
 * reliability: streaming music APIs > LinkedIn structured > Instagram
 * inferred > Google/YouTube consumption > manual tags.
 */

import type { IdentityIntelligenceWrapper } from '$lib/types/identityIntelligence';
import type { IdentitySnapshotWrapper } from '$lib/types/identitySnapshot';
import type { InferenceIdentityWrapper } from '$lib/types/inferenceIdentity';
import type { HyperInferenceWrapper } from '$lib/types/hyperInference';
import type { MemoryGraphProjection } from '$lib/types/memoryGraph';
import type { ExpressionFeedbackState, ExpressionLayer } from '$lib/types/expressionLayer';
import type { SignalMeterOutput } from '$lib/types/signalMeter';
import type {
  IgCreatorTier,
  IgPostingCadence,
  VisualIdentity,
  TemporalProfile,
  EngagementProfile,
  CommentGraphProfile,
} from './instagram';
import type { GoogleTwin, SpotifyIdentity } from '$lib/utils';
import {
  deriveGoogleIntentHints,
  deriveGoogleSignalTags,
} from '$lib/server/signalProcessor/googleGraphSignals';

interface RawProfile {
  name?: string;
  city?: string;
  budget?: string;
  interests?: string[];
  instagramIdentity?: {
    username?: string;
    city?: string;
    aesthetic?: string;
    lifestyle?: string;
    brandVibes?: string[];
    musicVibe?: string;
    foodVibe?: string;
    travelStyle?: string;
    activityPattern?: string;
    interests?: string[];
    rawSummary?: string;
    displayName?: string;
    profilePicture?: string;
    followersCount?: number;
    mediaCount?: number;
    topHashtags?: string[];
    captionMentions?: string[];
    igPostingCadence?: IgPostingCadence;
    igCreatorTier?: IgCreatorTier;
    visual?: VisualIdentity;
    bioKeywords?: string[];
    bioRoles?: string[];
    personality?: { expressive: number; humor: number; introspective: number };
    captionIntent?: string;
    temporal?: TemporalProfile;
    engagement?: EngagementProfile;
    commentGraph?: CommentGraphProfile;
    igInsightsTags?: string[];
  } | null;
  spotifyIdentity?: SpotifyIdentity | null;
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
    importantSenders?: string[];
    twin?: GoogleTwin;
  } | null;
  youtubeIdentity?: {
    topChannels?: string[];
    topCategories?: string[];
    contentPersonality?: string;
    lifestyleSignals?: string[];
  } | null;
  linkedinIdentity?: {
    name?: string;
    headline?: string;
    currentRole?: string;
    currentCompany?: string;
    industry?: string;
    seniority?: string;
    skills?: string[];
    jobInterests?: string[];
    careerSummary?: string;
    location?: string;
    skillClusters?: string[];
    industryAffinity?: string[];
    professionalThemeTags?: string[];
    linkedinIntentHints?: Array<{ intent: string; confidence: number; time_horizon?: string }>;
  } | null;
  /** From user_marketing_prefs — injected at refresh/save for graph + brand overlap */
  manualInterestTags?: string[];
  signalMeter?: SignalMeterOutput;
  hyperInference?: HyperInferenceWrapper;
  memoryGraph?: MemoryGraphProjection;
}

export interface IdentitySignalMeta {
  hasStreamingIdentity: boolean;
  hasLinkedIn: boolean;
  hasYoutube: boolean;
  hasInstagram: boolean;
  /** When false, prefer genres/interests over IG aesthetic for broad style queries */
  trustIgStyle: boolean;
}

export interface IdentityGraph {
  name: string;
  city: string;
  budget: 'low' | 'mid' | 'high';

  topArtists: string[];
  topGenres: string[];
  topTracks: string[];
  musicPersonality: string;
  musicVibe: string;

  aesthetic: string;
  brandVibes: string[];
  foodVibe: string;
  travelStyle: string;

  activities: string[];
  lifestyle: string;
  lifestyleSignals: string[];

  role: string;
  company: string;
  industry: string;
  headline: string;
  linkedinLocation: string;
  skills: string[];
  jobInterests: string[];

  contentCategories: string[];
  contentPersonality: string;
  topChannels: string[];
  interests: string[];

  topHashtags: string[];
  captionMentions: string[];
  igPostingCadence: IgPostingCadence | null;
  igCreatorTier: IgCreatorTier | null;

  rawSummarySnippet: string;
  signalMeta: IdentitySignalMeta;
  /** For queries when IG style is low-trust */
  queryStyleHint: string;

  musicQueryStr: string;
  styleQueryStr: string;
  activityQueryStr: string;
  professionalStr: string;

  // NEW: enriched IG signals
  visualScenes: Record<string, number>;
  visualAesthetic: { brightness: string; tone: string; composition: string } | null;
  visualColorPalette: string[];
  visualCuisineTypes: string[];
  visualLocationTypes: string[];
  visualFashionStyle: string;
  personality: { expressive: number; humor: number; introspective: number } | null;
  captionIntent: string;
  temporalPattern: string;
  temporalPeakDays: string[];
  engagementTier: string;
  socialVisibility: string;
  bioRoles: string[];
  externalPerception: string[];
  communityTone: string;
  /** Sanitized behavior lines for models (schedule/commerce rhythm, no data-source wording). */
  googleBehaviorHints: string[];
  /** Short tags to bias web search queries (travel | fitness | food_social). */
  googleQueryBoosters: string[];
  googleSignalTags: string[];
  /** Serialized intent:id:confidence for flatten */
  googleIntentTokens: string[];

  /** Apple Music track hints (from last analyze / reconnect) */
  appleListeningHint: string;
  linkedinCareerSnippet: string;
  igMetricsHint: string;

  manualTags: string[];
  igInsightsTags: string[];

  skillClusters: string[];
  industryAffinity: string[];
  professionalThemeTags: string[];
  linkedinIntentTokens: string[];

  musicDescriptorTags: string[];
  musicLifestyleTags: string[];
  musicCultureTags: string[];
  musicMoodTags: string[];
  listeningBehaviorTags: string[];
  musicIntentTokens: string[];

  musicSignalNarrative: string;
  professionalSignalNarrative: string;
  lifeRhythmNarrative: string;

  /** LinkedIn marketing API activity — reserved; empty until partner APIs enabled */
  linkedinActivityNote: string;

  appleMusicDescriptorTags: string[];

  /** LLM-evolved behavioral identity (server-persisted; not set by buildIdentityGraph). */
  inferenceIdentity?: InferenceIdentityWrapper;
  /** Decision-layer intelligence snapshot (server-persisted). */
  identityIntelligence?: IdentityIntelligenceWrapper;
  /** Identity compression portrait (server-persisted). */
  identitySnapshot?: IdentitySnapshotWrapper;
  /** Ranked signal layer persisted alongside the graph. */
  signalMeter?: SignalMeterOutput;
  /** Hyper Inference Engine (LLM; server-persisted; not set by buildIdentityGraph). */
  hyperInference?: HyperInferenceWrapper;
  /** Projected behavioral memory graph (server-persisted). */
  memoryGraph?: MemoryGraphProjection;
  /** Expression Engine: atoms, vibes, top unified signals (server-persisted). */
  expressionLayer?: ExpressionLayer;
  /** User votes + atom weight nudges for feedback loop (server-persisted). */
  expressionFeedback?: ExpressionFeedbackState;
}

function snipSummary(raw: string | undefined, max = 280): string {
  if (!raw?.trim()) return '';
  const one = raw.replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}

function dedupeInterestsPreserveOrder(items: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of items) {
    const t = x.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

const ACTIVITY_KEYWORDS = /fitness|sport|gym|yoga|travel|photo|art|cook|dance|music|run|hike|climb|cycle|swim/i;

function activityHintsFromText(text: string): string[] {
  const out: string[] = [];
  for (const w of text.split(/[\s,;]+/).filter(Boolean)) {
    if (ACTIVITY_KEYWORDS.test(w) && w.length > 2) out.push(w);
  }
  return [...new Set(out)].slice(0, 2);
}

function roleFromHeadline(headline: string): string {
  const h = headline.trim();
  if (!h) return '';
  const at = h.split(/\s+at\s+/i);
  if (at.length >= 2) return at[0].trim();
  const pipe = h.split(/\s*[|·]\s*/);
  return pipe[0]?.trim() ?? h;
}

/**
 * Build a structured identity graph from the raw profile.
 */
export function buildIdentityGraph(profile: RawProfile): IdentityGraph {
  const rankedSignalValues = (profile.signalMeter?.signals ?? [])
    .filter(signal => signal.final_score >= 0.55)
    .slice(0, 10)
    .map(signal => signal.value);
  const rankedBehaviorValues = (profile.signalMeter?.signals ?? [])
    .filter(signal => signal.type === 'behavior' && signal.final_score >= 0.55)
    .slice(0, 6)
    .map(signal => signal.value);

  const ig = profile.instagramIdentity;
  const sp = profile.spotifyIdentity;
  const am = profile.appleMusicIdentity;
  const googleFull = profile.googleIdentity;
  const yt = googleFull ?? profile.youtubeIdentity;
  const li = profile.linkedinIdentity;
  const twin = googleFull?.twin;

  const hasStreamingIdentity = Boolean(sp?.topArtists?.length || am?.topArtists?.length);
  const hasLinkedIn = Boolean(
    li?.currentRole?.trim() ||
      li?.headline?.trim() ||
      li?.name?.trim() ||
      li?.careerSummary?.trim() ||
      li?.industry?.trim() ||
      li?.currentCompany?.trim() ||
      (li?.skills?.length ?? 0) > 0,
  );
  const hasYoutube = Boolean(yt?.topChannels?.length || yt?.lifestyleSignals?.length || yt?.topCategories?.length);
  const hasInstagram = Boolean(ig?.username || ig?.rawSummary);

  const city =
    ig?.city?.trim() ||
    profile.city?.trim() ||
    li?.location?.trim() ||
    'Mumbai';

  const budget = (profile.budget as 'low' | 'mid' | 'high') ?? 'mid';

  const topArtists = sp?.topArtists?.length
    ? sp.topArtists.slice(0, 6)
    : (am?.topArtists?.slice(0, 6) ?? []);
  const topGenres = sp?.topGenres?.length
    ? sp.topGenres.slice(0, 5)
    : (am?.topGenres?.slice(0, 5) ?? []);
  const topTracks = sp?.topTracks?.slice(0, 4) ?? [];
  const musicPersonality = sp?.musicPersonality ?? am?.musicPersonality ?? '';
  const musicVibe = sp?.vibeDescription ?? am?.vibeDescription ?? ig?.musicVibe ?? '';

  const aesthetic = ig?.aesthetic ?? (profile.interests?.slice(0, 2).join(' ') ?? '');
  let brandVibes = ig?.brandVibes?.filter(Boolean) ?? [];
  if (!brandVibes.length && twin?.topMerchantHints?.length) {
    brandVibes = twin.topMerchantHints.slice(0, 3).filter(Boolean);
  }
  const foodVibe = ig?.foodVibe ?? '';
  let travelStyle = ig?.travelStyle ?? '';
  if (!travelStyle.trim() && twin?.lifestyle?.dominantCalendarTypes?.includes('travel')) {
    travelStyle = 'often planning trips';
  }

  const calendarTags: string[] = [];
  for (const t of twin?.lifestyle?.dominantCalendarTypes ?? []) {
    if (t === 'fitness') calendarTags.push('fitness routine');
    else if (t === 'food_social') calendarTags.push('social dining');
    else if (t === 'work') calendarTags.push('focused work blocks');
    else if (t === 'travel') calendarTags.push('travel plans');
  }
  for (const th of googleFull?.emailThemes?.slice(0, 3) ?? []) {
    const s = th.trim();
    if (s) calendarTags.push(s.slice(0, 48));
  }

  const rawActivities = [
    ...(ig?.activityPattern ? ig.activityPattern.split(/[,;]+/).map(s => s.trim()) : []),
    ...(yt?.lifestyleSignals ?? []),
    ...(ig?.interests?.filter(i => ACTIVITY_KEYWORDS.test(i)) ?? []),
    ...calendarTags,
    ...rankedBehaviorValues,
  ].filter(Boolean);

  let activities = [...new Set(rawActivities)].slice(0, 6);
  if (activities.length === 0 && yt?.contentPersonality) {
    activities = [...activities, ...activityHintsFromText(yt.contentPersonality)].slice(0, 6);
  }

  const lifestyle = ig?.lifestyle ?? '';
  const lifestyleSignals = yt?.lifestyleSignals ?? [];

  const headline = li?.headline?.trim() ?? '';
  const role = li?.currentRole?.trim() || roleFromHeadline(headline);
  const company = li?.currentCompany?.trim() ?? '';
  const industry = li?.industry?.trim() ?? '';
  const linkedinLocation = li?.location?.trim() ?? '';
  const skills = li?.skills?.slice(0, 6) ?? [];
  const jobInterests = li?.jobInterests?.slice(0, 3) ?? [];

  const contentCategories = yt?.topCategories ?? [];
  const contentPersonality = yt?.contentPersonality?.trim() ?? '';
  const topChannels = (yt?.topChannels ?? []).slice(0, 8).filter(Boolean);

  const commerceInterests: string[] = [];
  if (twin?.spending?.categoryFocus === 'food_delivery') commerceInterests.push('dining & delivery');
  if (twin?.spending?.categoryFocus === 'travel') commerceInterests.push('trips & transport');
  if (twin?.spending?.categoryFocus === 'shopping') commerceInterests.push('online shopping');
  const mergedInterests = [
    ...(ig?.interests ?? []),
    ...(profile.interests ?? []),
    ...(profile.manualInterestTags ?? []),
    ...commerceInterests,
    ...rankedSignalValues,
  ];
  const interests = dedupeInterestsPreserveOrder(mergedInterests, 16);

  const topHashtags = (ig?.topHashtags ?? []).slice(0, 8);
  const captionMentions = (ig?.captionMentions ?? []).slice(0, 3);
  const igPostingCadence = ig?.igPostingCadence ?? null;
  const igCreatorTier = ig?.igCreatorTier ?? null;

  const rawSummarySnippet = snipSummary(ig?.rawSummary);

  // Prefer Instagram for style when we have a strong IG graph (visual, caption summary, or aesthetic),
  // even if the account is "private" tier and streaming is connected.
  const hasVisualConfirmation = Boolean(ig?.visual?.aesthetic);
  const trustIgStyle =
    hasVisualConfirmation ||
    Boolean(rawSummarySnippet?.trim()) ||
    Boolean(ig?.aesthetic?.trim()) ||
    !(igCreatorTier === 'private' && hasStreamingIdentity);

  // If visual analysis found a fashion style, blend it into the aesthetic
  const visualEnhancedAesthetic = ig?.visual?.fashionStyle && aesthetic
    ? `${aesthetic}, ${ig.visual.fashionStyle}`
    : aesthetic;

  const queryStyleHint = trustIgStyle && visualEnhancedAesthetic.trim()
    ? visualEnhancedAesthetic.trim()
    : (interests[0] || topGenres[0] || musicVibe.split(/[,;]/)[0]?.trim() || 'lifestyle');

  const signalMeta: IdentitySignalMeta = {
    hasStreamingIdentity,
    hasLinkedIn,
    hasYoutube,
    hasInstagram,
    trustIgStyle,
  };

  const appleReleaseBoost =
    !sp?.topArtists?.length && am?.latestReleases?.length
      ? am.latestReleases
          .slice(0, 2)
          .map(r => `${r.artistName ?? ''} ${r.title ?? ''}`.trim())
          .filter(Boolean)
      : [];
  const musicQueryStr = [...topArtists.slice(0, 3), ...topGenres.slice(0, 2), ...appleReleaseBoost]
    .filter(Boolean)
    .join(' ');
  const styleQueryStr = [...brandVibes.slice(0, 3), trustIgStyle ? visualEnhancedAesthetic : queryStyleHint].filter(Boolean).join(' ');
  const activityQueryStr = activities.slice(0, 3).join(' ');
  const professionalStr = [role, company, industry].filter(Boolean).join(' ');

  // Visual signals
  const visualScenes = ig?.visual?.sceneCategories ?? {};
  const visualAesthetic = ig?.visual?.aesthetic ?? null;
  const visualColorPalette = ig?.visual?.colorPalette ?? [];
  const visualCuisineTypes = ig?.visual?.cuisineTypes ?? [];
  const visualLocationTypes = ig?.visual?.locationTypes ?? [];
  const visualFashionStyle = ig?.visual?.fashionStyle ?? '';

  // Use image-proven food types to strengthen foodVibe
  const enrichedFoodVibe = visualCuisineTypes.length > 0 && foodVibe
    ? `${foodVibe} (photos show: ${visualCuisineTypes.join(', ')})`
    : foodVibe;

  // Personality, temporal, engagement, comment graph
  const personality = ig?.personality ?? null;
  const captionIntent = ig?.captionIntent ?? '';
  let temporalPattern = ig?.temporal?.activityPattern ?? '';
  if (!temporalPattern.trim() && twin?.lifestyle?.scheduleDensity === 'high') {
    temporalPattern = 'busy most days';
  } else if (!temporalPattern.trim() && twin?.lifestyle?.scheduleDensity === 'low') {
    temporalPattern = 'lighter typical week';
  }
  const temporalPeakDays = ig?.temporal?.peakDays ?? [];
  const engagementTier = ig?.engagement?.engagementTier ?? '';
  const socialVisibility = ig?.engagement?.socialVisibility ?? '';
  const bioRoles = ig?.bioRoles ?? [];
  const externalPerception = ig?.commentGraph?.externalPerception ?? [];
  const communityTone = ig?.commentGraph?.communityTone ?? '';

  const googleBehaviorHints: string[] = [];
  if (twin?.intent?.plansHint) googleBehaviorHints.push(`upcoming rhythm: ${twin.intent.plansHint}`);
  if (twin?.lifestyle?.workIntensity === 'high') googleBehaviorHints.push('work-heavy typical week');
  if (twin?.spending?.band === 'high') googleBehaviorHints.push('active commerce across categories');
  if (twin?.insights?.length) googleBehaviorHints.push(...twin.insights.slice(0, 4));

  const googleQueryBoosters: string[] = [];
  if (twin?.lifestyle?.dominantCalendarTypes?.includes('travel')) googleQueryBoosters.push('travel');
  if (twin?.lifestyle?.dominantCalendarTypes?.includes('fitness')) googleQueryBoosters.push('fitness');
  if (
    twin?.spending?.categoryFocus === 'food_delivery' ||
    twin?.lifestyle?.dominantCalendarTypes?.includes('food_social')
  ) {
    googleQueryBoosters.push('food_social');
  }

  function appleTrackLine(
    tracks: { title?: string; artistName?: string }[] | undefined,
    prefix: string,
  ): string {
    if (!tracks?.length) return '';
    const parts = tracks
      .slice(0, 3)
      .map(t => {
        const title = (t.title ?? '').trim();
        if (!title) return '';
        const a = (t.artistName ?? '').trim();
        return a ? `${title} — ${a}` : title;
      })
      .filter(Boolean);
    if (!parts.length) return '';
    return `${prefix} ${parts.join(', ')}`;
  }

  const appleListeningHint = [
    appleTrackLine(am?.heavyRotationTracks, 'heavy:'),
    appleTrackLine(am?.recentlyPlayed, 'recent:'),
  ]
    .filter(Boolean)
    .join(' | ')
    .slice(0, 280);

  const linkedinCareerSnippet = (li?.careerSummary ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);

  const igMetricsHint = ig?.username
    ? [
        ig.followersCount != null ? `${ig.followersCount} followers` : '',
        ig.mediaCount != null ? `${ig.mediaCount} posts` : '',
        ig.igPostingCadence ? `${ig.igPostingCadence} cadence` : '',
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const manualTags = dedupeInterestsPreserveOrder(profile.manualInterestTags ?? [], 40);

  const googleSignalTags = deriveGoogleSignalTags(
    googleFull
      ? {
          topCategories: googleFull.topCategories,
          lifestyleSignals: googleFull.lifestyleSignals,
          emailThemes: googleFull.emailThemes,
          twin: googleFull.twin,
        }
      : null,
  );
  const gIntents = deriveGoogleIntentHints(
    googleFull
      ? {
          topCategories: googleFull.topCategories,
          lifestyleSignals: googleFull.lifestyleSignals,
          emailThemes: googleFull.emailThemes,
          twin: googleFull.twin,
        }
      : null,
  );
  const googleIntentTokens = gIntents.map(
    h => `gintent_${h.intent}_${Math.round((h.confidence ?? 0.5) * 100)}_${h.time_horizon ?? 'na'}`,
  );

  const skillClusters = li?.skillClusters ?? [];
  const industryAffinity = li?.industryAffinity ?? [];
  const professionalThemeTags = li?.professionalThemeTags ?? [];
  const linkedinIntentTokens = (li?.linkedinIntentHints ?? []).map(
    h => `liintent_${h.intent}_${Math.round((h.confidence ?? 0.5) * 100)}`,
  );

  const spEx = sp;
  const musicDescriptorTags = [...(spEx?.musicDescriptorTags ?? [])];
  const musicLifestyleTags = spEx?.musicLifestyleTags ?? [];
  const musicCultureTags = spEx?.musicCultureTags ?? [];
  const musicMoodTags = spEx?.audioFeatureMoodTags ?? [];
  const listeningBehaviorTags = spEx?.listeningBehaviorTags ?? [];
  const musicIntentTokens = (spEx?.musicIntentHints ?? []).map(
    h => `musicintent_${h.intent}_${Math.round((h.confidence ?? 0.5) * 100)}`,
  );

  const igInsightsTags = ig?.igInsightsTags ?? [];

  const appleMusicDescriptorTags = dedupeInterestsPreserveOrder(
    [...(am?.rotationPlaylists ?? []), ...(am?.libraryPlaylists ?? [])].map(s => String(s).slice(0, 48)),
    10,
  );

  const musicSignalNarrative = snipSummary(
    [
      sp?.musicPersonality,
      sp?.vibeDescription,
      am?.musicPersonality,
      musicDescriptorTags.slice(0, 4).join(', '),
    ]
      .filter(Boolean)
      .join(' · '),
    220,
  );

  const professionalSignalNarrative = snipSummary(
    [headline, professionalStr, linkedinCareerSnippet, professionalThemeTags.join(', ')].filter(Boolean).join(' · '),
    220,
  );

  const lifeRhythmNarrative = snipSummary(
    [
      temporalPattern,
      twin?.intent?.plansHint,
      ...(twin?.insights?.slice(0, 2) ?? []),
      lifestyle,
    ]
      .filter(Boolean)
      .join(' · '),
    220,
  );

  const linkedinActivityNote = '';

  return {
    name: profile.name ?? li?.name ?? '',
    city,
    budget,
    topArtists,
    topGenres,
    topTracks,
    musicPersonality,
    musicVibe,
    aesthetic: visualEnhancedAesthetic,
    brandVibes,
    foodVibe: enrichedFoodVibe,
    travelStyle,
    activities,
    lifestyle,
    lifestyleSignals,
    role,
    company,
    industry,
    headline,
    linkedinLocation,
    skills,
    jobInterests,
    contentCategories,
    contentPersonality,
    topChannels,
    interests,
    topHashtags,
    captionMentions,
    igPostingCadence,
    igCreatorTier,
    rawSummarySnippet,
    signalMeta,
    queryStyleHint,
    musicQueryStr,
    styleQueryStr,
    activityQueryStr,
    professionalStr,
    visualScenes,
    visualAesthetic,
    visualColorPalette,
    visualCuisineTypes,
    visualLocationTypes,
    visualFashionStyle,
    personality,
    captionIntent,
    temporalPattern,
    temporalPeakDays,
    engagementTier,
    socialVisibility,
    bioRoles,
    externalPerception,
    communityTone,
    googleBehaviorHints,
    googleQueryBoosters,
    googleSignalTags,
    googleIntentTokens,
    appleListeningHint,
    linkedinCareerSnippet,
    igMetricsHint,
    manualTags,
    igInsightsTags,
    skillClusters,
    industryAffinity,
    professionalThemeTags,
    linkedinIntentTokens,
    musicDescriptorTags,
    musicLifestyleTags,
    musicCultureTags,
    musicMoodTags,
    listeningBehaviorTags,
    musicIntentTokens,
    musicSignalNarrative,
    professionalSignalNarrative,
    lifeRhythmNarrative,
    linkedinActivityNote,
    appleMusicDescriptorTags,
    signalMeter: profile.signalMeter,
    hyperInference: profile.hyperInference,
    memoryGraph: profile.memoryGraph,
  };
}

// ── Diverse query selection ────────────────────────────────────────────────

export type QueryBucket =
  | 'music'
  | 'food'
  | 'fashion'
  | 'activity'
  | 'professional'
  | 'content'
  | 'fallback';

export interface QueryCandidate {
  query: string;
  bucket: QueryBucket;
  /** Lower = higher fidelity (0 = best). */
  tier: number;
}

/** Prefer distinct buckets, then fill by tier order. */
export function pickDiverseQueries(candidates: QueryCandidate[], maxN: number): string[] {
  const sorted = [...candidates].filter(c => c.query.trim()).sort((a, b) => a.tier - b.tier || a.query.localeCompare(b.query));
  const picked: string[] = [];
  const usedBuckets = new Set<QueryBucket>();

  for (const c of sorted) {
    if (picked.length >= maxN) break;
    if (usedBuckets.has(c.bucket)) continue;
    picked.push(c.query.trim());
    usedBuckets.add(c.bucket);
  }

  for (const c of sorted) {
    if (picked.length >= maxN) break;
    const q = c.query.trim();
    if (!picked.includes(q)) picked.push(q);
  }

  return picked.slice(0, maxN);
}

function ym(at: Date): { month: string; year: number } {
  return {
    month: at.toLocaleString('en', { month: 'long' }),
    year: at.getFullYear(),
  };
}

// ── Per-domain query builders ──────────────────────────────────────────────

export function buildShopQueries(g: IdentityGraph, at: Date = new Date()): string[] {
  const { year } = ym(at);
  const candidates: QueryCandidate[] = [];

  if (g.brandVibes.length >= 2) {
    candidates.push({
      query: `${g.brandVibes[0]} ${g.brandVibes[1]} clothing india buy online`,
      bucket: 'fashion',
      tier: 1,
    });
  } else if (g.brandVibes.length === 1) {
    candidates.push({
      query: `${g.brandVibes[0]} ${g.queryStyleHint} clothing india buy`,
      bucket: 'fashion',
      tier: 1,
    });
  } else if (g.queryStyleHint) {
    candidates.push({
      query: `${g.queryStyleHint} fashion clothing india buy online ${year}`,
      bucket: 'fashion',
      tier: 3,
    });
  }

  if (g.topArtists.length) {
    candidates.push({
      query: `${g.topArtists[0]} official merch india buy`,
      bucket: 'music',
      tier: 0,
    });
  } else if (g.topGenres.length) {
    candidates.push({
      query: `${g.topGenres[0]} music merchandise clothing india buy`,
      bucket: 'music',
      tier: 1,
    });
  }

  const gearActivity =
    g.activities.find(a => /gym|fitness|yoga|run|sport|climb|swim|cycle|trek|skate|dance/i.test(a)) ??
    g.activities[0];
  if (gearActivity) {
    candidates.push({
      query: `${gearActivity} gear equipment india buy amazon`,
      bucket: 'activity',
      tier: 2,
    });
  }

  const techCat =
    g.contentCategories.find(c => /tech|gaming|camera|audio|photography|productivity/i.test(c)) ??
    g.lifestyleSignals.find(s => /tech|gadget|camera|headphone/i.test(s));
  if (g.contentPersonality && /tech|gadget|camera|code|developer|design/i.test(g.contentPersonality)) {
    candidates.push({
      query: `${g.contentPersonality.slice(0, 60)} gadget india buy amazon`,
      bucket: 'content',
      tier: 2,
    });
  } else if (techCat) {
    candidates.push({
      query: `${techCat} gadget india buy amazon flipkart`,
      bucket: 'content',
      tier: 2,
    });
  } else if (g.skills.length) {
    candidates.push({
      query: `${g.skills[0]} tools india buy online`,
      bucket: 'professional',
      tier: 2,
    });
  }

  if (/minimal|clean|wellness|yoga|natural|organic|glow/i.test(g.aesthetic + ' ' + g.lifestyle)) {
    candidates.push({
      query: `${g.queryStyleHint} skincare wellness products india buy nykaa`,
      bucket: 'fashion',
      tier: 2,
    });
  }

  candidates.push(
    { query: `${g.queryStyleHint || 'streetwear'} fashion india amazon buy ${year}`, bucket: 'fallback', tier: 4 },
    { query: `lifestyle products india ${year} buy online`, bucket: 'fallback', tier: 5 },
  );

  return pickDiverseQueries(candidates, 2);
}

export function buildEventQueries(
  g: IdentityGraph,
  at: Date = new Date(),
): { queries: string[]; musicQuery: string } {
  const { month, year } = ym(at);
  const candidates: QueryCandidate[] = [];

  const mvShort = g.musicVibe?.split(/[,;]/)[0]?.trim();
  const concertArtist = (g.topArtists[0] ?? g.topGenres[0] ?? mvShort) || 'live music';
  const musicQuery = `${concertArtist} concert live event ${g.city} ${month} ${year}`;
  candidates.push({ query: musicQuery, bucket: 'music', tier: g.topArtists.length ? 0 : 2 });

  const styleBit = g.signalMeta.trustIgStyle ? g.aesthetic : g.queryStyleHint;
  const lifeFrag = g.lifestyle ? g.lifestyle.split(/\s+/).slice(0, 3).join(' ') : '';
  if (styleBit) {
    candidates.push({
      query: `${styleBit} ${lifeFrag} event experience ${g.city} ${month} ${year}`.replace(/\s+/g, ' ').trim(),
      bucket: 'content',
      tier: 2,
    });
  } else if (g.interests[0]) {
    candidates.push({
      query: `${g.interests[0]} event ${g.city} ${month} ${year}`,
      bucket: 'content',
      tier: 3,
    });
  }

  const catHint = g.contentCategories[0];
  if (catHint && !g.signalMeta.trustIgStyle) {
    candidates.push({
      query: `${catHint} event experience ${g.city} ${month} ${year}`,
      bucket: 'content',
      tier: 2,
    });
  }

  if (g.travelStyle) {
    candidates.push({
      query: `${g.travelStyle} travel experience ${g.city} ${month} ${year}`,
      bucket: 'activity',
      tier: 2,
    });
  }

  if ((g.googleQueryBoosters ?? []).includes('travel')) {
    candidates.push({
      query: `weekend trip travel experience near ${g.city} ${month} ${year}`,
      bucket: 'activity',
      tier: 2,
    });
  }

  if ((g.googleQueryBoosters ?? []).includes('fitness')) {
    candidates.push({
      query: `fitness class gym workout event ${g.city} ${month} ${year}`,
      bucket: 'activity',
      tier: 2,
    });
  }

  if (g.activities[0]) {
    candidates.push({
      query: `${g.activities[0]} workshop class event ${g.city} ${month} ${year}`,
      bucket: 'activity',
      tier: 2,
    });
  }

  candidates.push({
    query: `events things to do ${g.city} ${month} ${year}`,
    bucket: 'fallback',
    tier: 4,
  });

  return { queries: pickDiverseQueries(candidates, 2), musicQuery };
}

export function buildLifestyleQueries(g: IdentityGraph, at: Date = new Date()): string[] {
  const { year } = ym(at);
  const candidates: QueryCandidate[] = [];

  if (g.topArtists.length) {
    candidates.push({
      query: `${g.topArtists.slice(0, 2).join(' ')} new music release ${year}`,
      bucket: 'music',
      tier: 0,
    });
  } else if (g.topGenres.length) {
    candidates.push({
      query: `${g.topGenres[0]} new music ${year}`,
      bucket: 'music',
      tier: 1,
    });
  } else if (g.musicVibe) {
    candidates.push({
      query: `${g.musicVibe.split(/[,;]/)[0]?.trim() || g.musicVibe} new music releases ${year}`,
      bucket: 'music',
      tier: 3,
    });
  }

  if (g.foodVibe) {
    candidates.push({
      query: `${g.foodVibe} best restaurant cafe ${g.city} ${year}`,
      bucket: 'food',
      tier: 1,
    });
  }

  if ((g.googleQueryBoosters ?? []).includes('food_social') && !g.foodVibe) {
    candidates.push({
      query: `best dinner restaurants ${g.city} ${year}`,
      bucket: 'food',
      tier: 2,
    });
  }

  if (g.brandVibes.length) {
    candidates.push({
      query: `${g.brandVibes.slice(0, 2).join(' ')} new collection drop ${year}`,
      bucket: 'fashion',
      tier: 1,
    });
  }

  if (g.topHashtags.length >= 2) {
    candidates.push({
      query: `${g.topHashtags.slice(0, 3).join(' ')} culture trends ${g.city} ${year}`,
      bucket: 'content',
      tier: 2,
    });
  } else if (g.topHashtags.length === 1) {
    candidates.push({
      query: `${g.topHashtags[0]} lifestyle news ${g.city} ${year}`,
      bucket: 'content',
      tier: 2,
    });
  }

  if (g.lifestyleSignals[0]) {
    candidates.push({
      query: `${g.lifestyleSignals[0]} ${g.queryStyleHint} ${year}`,
      bucket: 'content',
      tier: 2,
    });
  }

  if (g.topChannels.length) {
    candidates.push({
      query: `${g.topChannels.slice(0, 2).join(' ')} creator content ${year}`,
      bucket: 'content',
      tier: 1,
    });
  }

  candidates.push(
    {
      query: `new ${g.interests[0] ?? 'music'} releases ${year}`,
      bucket: 'fallback',
      tier: 4,
    },
    {
      query: `best ${g.interests[1] ?? 'food'} spots ${g.city} ${year}`,
      bucket: 'fallback',
      tier: 4,
    },
  );

  return pickDiverseQueries(candidates, 2);
}

export function buildNewsQueries(g: IdentityGraph, at: Date = new Date()): string[] {
  const { month, year } = ym(at);
  const candidates: QueryCandidate[] = [];

  if (g.topArtists.length) {
    candidates.push({
      query: `${g.topArtists.slice(0, 2).join(' ')} news ${month} ${year}`,
      bucket: 'music',
      tier: 0,
    });
  } else if (g.musicVibe) {
    candidates.push({
      query: `${g.musicVibe.split(/[,;]/)[0]?.trim() || g.musicVibe} music news ${month} ${year}`,
      bucket: 'music',
      tier: 3,
    });
  }

  if (g.brandVibes.length) {
    candidates.push({
      query: `${g.brandVibes.slice(0, 2).join(' ')} news release ${month} ${year}`,
      bucket: 'fashion',
      tier: 1,
    });
  } else if (g.queryStyleHint) {
    candidates.push({
      query: `${g.queryStyleHint} culture news ${year}`,
      bucket: 'content',
      tier: 2,
    });
  }

  if (g.topHashtags.length) {
    candidates.push({
      query: `${g.topHashtags.slice(0, 2).join(' ')} news ${month} ${year}`,
      bucket: 'content',
      tier: 2,
    });
  }

  if (g.industry || g.role) {
    candidates.push({
      query: `${g.industry || g.role} news ${month} ${year}`,
      bucket: 'professional',
      tier: 1,
    });
  } else if (g.interests[0]) {
    candidates.push({
      query: `${g.interests[0]} news ${month} ${year}`,
      bucket: 'professional',
      tier: 3,
    });
  }

  if (g.activities[0]) {
    candidates.push({
      query: `${g.activities[0]} ${g.city} news ${month} ${year}`,
      bucket: 'activity',
      tier: 2,
    });
  }

  candidates.push(
    { query: `culture news India ${month} ${year}`, bucket: 'fallback', tier: 5 },
    { query: `lifestyle news India ${month} ${year}`, bucket: 'fallback', tier: 5 },
  );

  return pickDiverseQueries(candidates, 1);
}

/** Tribe / social tab — two searches (existing cap). */
export function buildTribeQueries(g: IdentityGraph, at: Date = new Date()): string[] {
  const { month, year } = ym(at);
  const candidates: QueryCandidate[] = [];

  const aestheticPart = g.signalMeta.trustIgStyle ? g.aesthetic : g.queryStyleHint;
  const q1Parts = [aestheticPart, g.lifestyleSignals[0], g.contentCategories[0], g.city].filter(Boolean).slice(0, 3);
  if (q1Parts.length) {
    candidates.push({
      query: `${q1Parts.join(' ')} community trending ${month} ${year}`,
      bucket: 'content',
      tier: 2,
    });
  }

  if (g.topArtists.length) {
    candidates.push({
      query: `${g.topArtists.slice(0, 2).join(' ')} fans community culture ${year}`,
      bucket: 'music',
      tier: 0,
    });
  } else if (g.musicVibe) {
    candidates.push({
      query: `${g.musicVibe.split(/[,;]/)[0]?.trim()} music community trending ${year}`,
      bucket: 'music',
      tier: 3,
    });
  }

  const q3Parts = [
    ...g.brandVibes.slice(0, 2),
    ...g.contentCategories.slice(0, 2),
    ...g.interests.slice(0, 2),
    g.industry,
  ].filter(Boolean).slice(0, 4);

  if (g.topHashtags.length) {
    candidates.push({
      query: `${g.topHashtags.slice(0, 3).join(' ')} trending community ${year}`,
      bucket: 'fashion',
      tier: 2,
    });
  }

  if (q3Parts.length) {
    candidates.push({
      query: `${q3Parts.join(' ')} drops trending community ${year}`,
      bucket: 'fashion',
      tier: 2,
    });
  }

  candidates.push(
    { query: `trending culture community ${month} ${year}`, bucket: 'fallback', tier: 5 },
    { query: `lifestyle FOMO trends ${year}`, bucket: 'fallback', tier: 5 },
  );

  return pickDiverseQueries(candidates, 2);
}

/** Video tab — two searches (existing cap). */
export function buildVideoQueries(g: IdentityGraph, at: Date = new Date()): string[] {
  const { year } = ym(at);
  const candidates: QueryCandidate[] = [];

  if (g.topChannels.length) {
    candidates.push({
      query: `${g.topChannels.slice(0, 3).join(' ')} latest video ${year}`,
      bucket: 'content',
      tier: 0,
    });
  } else if (g.lifestyleSignals[0] && g.contentPersonality) {
    candidates.push({
      query: `${g.lifestyleSignals[0]} ${g.contentPersonality} youtube ${year}`,
      bucket: 'content',
      tier: 1,
    });
  } else if (g.lifestyleSignals[0]) {
    candidates.push({
      query: `best ${g.lifestyleSignals[0]} youtube video ${year}`,
      bucket: 'content',
      tier: 2,
    });
  } else if (g.interests[0]) {
    candidates.push({
      query: `best ${g.interests[0]} youtube video ${year}`,
      bucket: 'content',
      tier: 3,
    });
  }

  if (g.topArtists.length) {
    const genre = g.topGenres[0] ?? '';
    candidates.push({
      query: `${g.topArtists.slice(0, 2).join(' ')}${genre ? ` ${genre}` : ''} new music video ${year}`,
      bucket: 'music',
      tier: 0,
    });
  } else if (g.musicVibe) {
    candidates.push({
      query: `${g.musicVibe.split(/[,;]/)[0]?.trim()} music video trending ${year}`,
      bucket: 'music',
      tier: 3,
    });
  }

  const q3Parts = [
    g.signalMeta.trustIgStyle ? g.aesthetic : g.queryStyleHint,
    g.interests[0],
    g.lifestyleSignals[0],
    g.city,
    g.industry,
  ].filter(Boolean).slice(0, 4);

  if (q3Parts.length) {
    candidates.push({
      query: `${q3Parts.join(' ')} lifestyle youtube ${year}`,
      bucket: 'activity',
      tier: 2,
    });
  }

  candidates.push(
    { query: `trending music videos ${year}`, bucket: 'fallback', tier: 5 },
    { query: `best videos to watch ${year}`, bucket: 'fallback', tier: 5 },
  );

  const picked = pickDiverseQueries(candidates, 2);
  if (!picked.length) return [`trending music videos ${year}`, `best videos to watch ${year}`];
  return picked;
}

export function identitySummary(g: IdentityGraph): string {
  const lines = [
    g.headline && `headline: ${g.headline}`,
    g.signalMeta.trustIgStyle && g.aesthetic && `aesthetic: ${g.aesthetic}`,
    !g.signalMeta.trustIgStyle && g.queryStyleHint && `style_hint: ${g.queryStyleHint}`,
    g.brandVibes.length && `brands: ${g.brandVibes.slice(0, 3).join(', ')}`,
    g.musicQueryStr && `music: ${g.musicQueryStr}`,
    g.rawSummarySnippet && `ig_context: ${g.rawSummarySnippet.slice(0, 200)}`,
    g.contentPersonality && `watches: ${g.contentPersonality.slice(0, 120)}`,
    g.topChannels.length && `channels: ${g.topChannels.slice(0, 4).join(', ')}`,
    g.lifestyle && `lifestyle: ${g.lifestyle}`,
    g.activities.length && `active: ${g.activities.slice(0, 3).join(', ')}`,
    g.foodVibe && `food: ${g.foodVibe}`,
    g.travelStyle && `travel: ${g.travelStyle}`,
    g.topHashtags.length && `tags: ${g.topHashtags.slice(0, 5).join(', ')}`,
    g.professionalStr && `works as: ${g.professionalStr}`,
    g.skills.length && `linkedin_skills: ${g.skills.slice(0, 5).join(', ')}`,
    g.linkedinCareerSnippet && `linkedin: ${g.linkedinCareerSnippet}`,
    g.appleListeningHint && `apple_listening: ${g.appleListeningHint}`,
    g.igMetricsHint && `ig_metrics: ${g.igMetricsHint}`,
    g.bioRoles.length && `roles: ${g.bioRoles.join(', ')}`,
    g.visualFashionStyle && `fashion: ${g.visualFashionStyle}`,
    g.visualCuisineTypes.length && `cuisine: ${g.visualCuisineTypes.join(', ')}`,
    g.personality && `personality: expressive=${g.personality.expressive} humor=${g.personality.humor}`,
    g.temporalPattern && `active_time: ${g.temporalPattern}`,
    g.externalPerception.length && `perceived_as: ${g.externalPerception.join(', ')}`,
    g.engagementTier && `engagement: ${g.engagementTier}`,
    (g.googleBehaviorHints ?? []).length &&
      `behavior_signals: ${(g.googleBehaviorHints ?? []).slice(0, 5).join('; ').slice(0, 240)}`,
    g.musicSignalNarrative && `music_graph: ${g.musicSignalNarrative.slice(0, 160)}`,
    g.professionalSignalNarrative && `pro_graph: ${g.professionalSignalNarrative.slice(0, 160)}`,
    (g.googleSignalTags ?? []).length &&
      `google_tags: ${(g.googleSignalTags ?? []).slice(0, 8).join(', ')}`,
    (g.manualTags ?? []).length && `manual: ${(g.manualTags ?? []).slice(0, 6).join(', ')}`,
    `city: ${g.city}`,
    `budget: ${g.budget}`,
  ];

  const inf = g.inferenceIdentity?.current;
  if (inf) {
    const pr = inf.predictive_read;
    if (pr?.you_in_one_line?.trim()) {
      lines.push(`inference_read: ${pr.you_in_one_line.trim().slice(0, 200)}`);
    }
    if (inf.intent?.primary?.trim()) {
      lines.push(`inference_intent: ${inf.intent.primary.trim().slice(0, 120)}`);
    }
    const topDomains = (inf.life_domains ?? []).slice(0, 3);
    for (const d of topDomains) {
      if (d.narrative?.trim()) {
        lines.push(`inference_${d.id}: ${d.narrative.trim().slice(0, 140)}`);
      }
    }
  }

  return lines.filter(Boolean).join(' | ');
}
