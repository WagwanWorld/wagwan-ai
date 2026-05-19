import type { BrandCreatorRosterEntry } from '$lib/types/creator-invite';

export type CreatorCardView = {
  name: string;
  handle: string;
  location: string;
  profilePicture: string;
  initial: string;
  followers: number;
  mediaCount: number;
  postsDisplay: string;
  strength: number;
  strengthLabel: string;
  engagementTier: string;
  bio: string;
  archetype: string;
  aesthetic: string;
  lifestyle: string;
  vibeTags: string[];
  interests: string[];
  contentTags: string[];
  colorPalette: string[];
  creatorTier: string;
  fitLabel?: string;
  fitScore?: number | null;
  feedSummary?: string;
  label?: string;
};

export type NetworkCreator = {
  name: string;
  handle: string;
  location: string;
  profilePicture: string;
  initial: string;
  followers: number;
  mediaCount: number;
  strength: number;
  strengthLabel: string;
  engagementTier: string;
  bio: string;
  archetype: string;
  aesthetic: string;
  lifestyle: string;
  vibeTags: string[];
  interests: string[];
  contentTags: string[];
  colorPalette: string[];
  creatorTier: string;
};

export function networkCreatorToView(c: NetworkCreator): CreatorCardView {
  return {
    name: c.name,
    handle: c.handle,
    location: c.location,
    profilePicture: c.profilePicture,
    initial: c.initial,
    followers: c.followers,
    mediaCount: c.mediaCount,
    postsDisplay: c.mediaCount > 0 ? String(c.mediaCount) : '—',
    strength: c.strength,
    strengthLabel: c.strengthLabel,
    engagementTier: c.engagementTier,
    bio: c.bio,
    archetype: c.archetype,
    aesthetic: c.aesthetic,
    lifestyle: c.lifestyle,
    vibeTags: c.vibeTags ?? [],
    interests: c.interests ?? [],
    contentTags: c.contentTags ?? [],
    colorPalette: c.colorPalette ?? [],
    creatorTier: c.creatorTier,
    label: 'Featured Creator',
  };
}

export function rosterEntryToView(entry: BrandCreatorRosterEntry): CreatorCardView {
  const snap = entry.profile_snapshot;
  const analysis = entry.analysis_snapshot;
  const followers = snap.followersCount ?? 0;
  const postsNum = parseInt(String(snap.posts).replace(/,/g, ''), 10);
  const mediaCount = Number.isFinite(postsNum) ? postsNum : 0;

  return {
    name: snap.displayName,
    handle: entry.ig_username || snap.handle,
    location: snap.location ?? '',
    profilePicture: snap.profilePicture ?? '',
    initial: (snap.displayName || '?').charAt(0).toUpperCase(),
    followers,
    mediaCount,
    postsDisplay: snap.posts || (mediaCount > 0 ? String(mediaCount) : '—'),
    strength: snap.strengthScore ?? analysis.fitScore ?? 0,
    strengthLabel: snap.strengthLabel ?? analysis.fitLabel ?? 'medium',
    engagementTier: snap.engagementTier ?? '',
    bio: snap.bio || analysis.summary,
    archetype: snap.archetype ?? '',
    aesthetic: snap.aesthetic ?? '',
    lifestyle: snap.lifestyle ?? '',
    vibeTags: snap.vibeTags ?? [],
    interests: [],
    contentTags: snap.contentTags ?? [],
    colorPalette: snap.colorPalette ?? [],
    creatorTier: entry.status === 'on_platform' ? 'On Wagwan' : 'Prospect',
    fitLabel: analysis.fitLabel,
    fitScore: analysis.fitScore,
    feedSummary: snap.feedSummary,
    label: 'Roster',
  };
}
