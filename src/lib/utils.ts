// Shared types and helpers safe to use in both server and browser code.

export interface SpotifyIdentity {
  topArtists: string[];
  topGenres: string[];
  topTracks: string[];
  musicPersonality: string;
  vibeDescription: string;
  artistsShortTerm?: string[];
  artistsLongTerm?: string[];
  recentTrackTitles?: string[];
  playlistNames?: string[];
  audioFeatureMoodTags?: string[];
  musicDescriptorTags?: string[];
  musicLifestyleTags?: string[];
  musicCultureTags?: string[];
  listeningBehaviorTags?: string[];
  musicIntentHints?: Array<{ intent: string; confidence: number; time_horizon?: string }>;
}

/** Newest catalog album for a heavy-rotation artist (when catalog id is available). */
export interface AppleMusicLatestRelease {
  artistName: string;
  /** Album or release title */
  title: string;
  /** ISO date (YYYY-MM-DD) when known */
  releaseDate?: string;
}

/** Song line for heavy rotation / recently played (title + optional artist). */
export interface AppleMusicTrackHint {
  title: string;
  artistName?: string;
  /** Catalog numeric id, or library id (e.g. i.xxx) for MusicKit */
  appleMusicId?: string;
  /** Queue mode for MusicKit `setQueue` */
  playAs?: 'song' | 'album';
  /** Apple Music web URL when available */
  playUrl?: string;
}

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
}

/** Merge defaults for identities saved before new Apple Music fields existed */
export function normalizeAppleMusicIdentity(am: AppleMusicIdentity): AppleMusicIdentity {
  return {
    ...am,
    rotationPlaylists: am.rotationPlaylists ?? [],
    libraryPlaylists: am.libraryPlaylists ?? [],
    latestReleases: am.latestReleases ?? [],
    heavyRotationTracks: (am.heavyRotationTracks ?? []).map(normalizeTrackHint),
    recentlyPlayed: (am.recentlyPlayed ?? []).map(normalizeTrackHint),
  };
}

function normalizeTrackHint(t: AppleMusicTrackHint): AppleMusicTrackHint {
  return {
    title: t.title,
    artistName: t.artistName,
    appleMusicId: t.appleMusicId,
    playAs: t.playAs,
    playUrl: t.playUrl,
  };
}

/** Catalog discovery row for Explore (server search + optional playback). */
export interface AppleMusicExplorePick extends AppleMusicTrackHint {
  artworkUrl?: string;
  reason: string;
}

export interface YouTubeIdentity {
  topChannels: string[];
  topCategories: string[];
  contentPersonality: string;
  lifestyleSignals: string[];
}

/** Processed calendar + commerce + schedule signals (no raw mail/calendar text). */
export interface GoogleTwinCalendarHint {
  id: string;
  title: string;
  start: string;
  end: string;
  type: string;
  location?: string;
}

export interface GoogleTwin {
  lifestyle: {
    workIntensity: 'low' | 'mid' | 'high';
    socialFrequency: string;
    fitnessConsistency: 'low' | 'mid' | 'high';
    scheduleDensity: string;
    dominantCalendarTypes: string[];
  };
  intent: {
    nextEventTitle?: string;
    nextEventStart?: string;
    plansHint?: string;
    next48hCount?: number;
  };
  spending: {
    band: 'low' | 'mid' | 'high';
    categoryFocus?: string;
    purchaseCount30d: number;
  };
  personality: {
    structuredVsSpontaneous: 'structured' | 'mixed' | 'spontaneous';
  };
  insights: string[];
  calendarIntent48h?: GoogleTwinCalendarHint[];
  /** Top repeated merchant names from commerce signals (for graph when IG brands empty). */
  topMerchantHints?: string[];
}

export interface GoogleIdentity {
  // Account
  sub?: string;
  email: string;
  name?: string;
  picture?: string;
  // YouTube signals
  topChannels: string[];
  topCategories: string[];
  contentPersonality: string;
  lifestyleSignals: string[];
  // Gmail signals
  emailThemes: string[];
  importantSenders: string[];
  /** Deterministic merge of calendar + Gmail metadata + profile */
  twin?: GoogleTwin;
}

export interface LinkedInIdentity {
  name: string;
  headline: string;       // e.g. "Product Designer at Swiggy"
  industry: string;       // e.g. "Technology", "Finance"
  location: string;       // from locale or Instagram city
  seniority: string;      // e.g. "mid-level", "senior", "entry-level"
  currentRole: string;    // e.g. "Product Designer"
  currentCompany: string; // e.g. "Swiggy"
  skills: string[];       // inferred by Claude
  jobInterests: string[]; // ideal next roles inferred by Claude
  careerSummary: string;  // 1-sentence Claude summary
  skillClusters?: string[];
  industryAffinity?: string[];
  professionalThemeTags?: string[];
  linkedinIntentHints?: Array<{ intent: string; confidence: number; time_horizon?: string }>;
}

export interface ResultCard {
  title: string;
  description: string;
  price: string;
  url: string;
  category:
    | 'music'
    | 'food'
    | 'nightlife'
    | 'fitness'
    | 'fashion'
    | 'travel'
    | 'experience'
    | 'deal'
    | 'tech'
    | 'wellness'
    | 'culture'
    | 'job'
    | 'video'
    | 'product'
    | 'other';
  match_score: number;
  match_reason: string;
  emoji: string;
  image_hint?: string;
  image_url?: string;
  /** Expression Engine — 0–1 when produced by shop / identity modules */
  confidence?: number;
  /** Expression Engine — UI emphasis */
  tier?: 'high' | 'medium' | 'low';
}

export type TwinMood = 'warm' | 'excited' | 'thoughtful' | 'neutral' | 'sorry';

export interface TwinChatAction {
  type: 'set_reminder' | 'navigate' | 'gmail_draft' | 'copy_text';
  text?: string;
  when?: string;
  path?: string;
  to?: string;
  subject?: string;
  body?: string;
}

export interface ChatResponse {
  message: string;
  cards: ResultCard[];
  /** Short follow-up suggestions for chips (max 4) */
  suggested_followups?: string[];
  mood?: TwinMood;
  actions?: TwinChatAction[];
}

export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  let m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  m = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  m = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  return null;
}

export function categoryToGrad(category: string, hint?: string): string {
  const map: Record<string, string> = {
    music: 'grad-music',
    food: 'grad-food',
    nightlife: 'grad-night',
    fitness: 'grad-fitness',
    fashion: 'grad-fashion',
    travel: 'grad-travel',
    tech: 'grad-tech',
    sports: 'grad-sports',
    deal: 'grad-deal',
    experience: 'grad-night',
    wellness: 'grad-fitness',
    culture: 'grad-music',
    job: 'grad-job',
    video: 'grad-video',
    product: 'grad-fashion',
  };
  return map[category] ?? 'grad-default';
}
