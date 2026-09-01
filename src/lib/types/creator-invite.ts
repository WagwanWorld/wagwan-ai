export type CreatorInviteFitLabel = 'Strong fit' | 'Good fit' | 'Worth exploring' | 'Limited data';

export type CreatorInviteAnalysis = {
  dataSource: 'wagwan' | 'public_scrape';
  summary: string;
  highlights: string[];
  fitLabel: CreatorInviteFitLabel;
  fitScore: number | null;
  signals: { label: string; value: string }[];
  feedInsight?: string;
};

export type CreatorInviteLinks = {
  onboarding: string;
  instagramProfile: string;
  instagramApp: string;
};

export type RosterProfileSnapshot = {
  handle: string;
  displayName: string;
  bio: string;
  profilePicture?: string;
  followers: string;
  followersCount: number | null;
  following: string;
  posts: string;
  isVerified: boolean;
  onPlatform: boolean;
  archetype?: string;
  location?: string;
  strengthScore?: number;
  strengthLabel?: string;
  engagementTier?: string;
  vibeTags?: string[];
  contentTags?: string[];
  colorPalette?: string[];
  aesthetic?: string;
  lifestyle?: string;
  feedSummary?: string;
  recentCaptions?: string[];
  scrapedAt: string;
  // Optional fields from bulk sheet upload
  email?: string;
  phone?: string;
  rates?: string;
  notes?: string;
  tags?: string;
  custom_fields?: Record<string, string>;
};

export type BrandCreatorRosterEntry = {
  id: string;
  brand_id: string;
  ig_username: string;
  display_name: string;
  profile_snapshot: RosterProfileSnapshot;
  user_google_sub: string | null;
  invite_message: string;
  onboarding_url: string;
  analysis_snapshot: CreatorInviteAnalysis;
  status: 'prospect' | 'on_platform';
  delivery_status: 'draft' | 'copied' | 'sent_manual';
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

function optionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const str = String(value);
  return str ? str : undefined;
}

function optionalStringArray(value: unknown, limit: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => String(item))
    .filter(Boolean)
    .slice(0, limit);
}

function optionalCustomFields(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, entryValue]) => [key, String(entryValue)] as const)
    .filter(([key, entryValue]) => key && entryValue);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/** Normalize legacy or partial profile_snapshot rows from the database. */
export function coerceRosterProfileSnapshot(
  raw: Record<string, unknown> | null | undefined,
  fallbackHandle: string,
  fallbackDisplayName?: string,
): RosterProfileSnapshot {
  const r = raw ?? {};
  const handle = String(r.handle ?? r.ig_username ?? fallbackHandle).replace(/^@/, '');
  return {
    handle,
    displayName: String(
      r.displayName ?? r.fullName ?? r.wagwanName ?? fallbackDisplayName ?? handle,
    ),
    bio: String(r.bio ?? ''),
    profilePicture: r.profilePicture ? String(r.profilePicture) : undefined,
    followers: String(r.followers ?? ''),
    followersCount: typeof r.followersCount === 'number' ? r.followersCount : null,
    following: String(r.following ?? ''),
    posts: String(r.posts ?? ''),
    isVerified: Boolean(r.isVerified),
    onPlatform: Boolean(r.onPlatform ?? r.wagwanName),
    archetype: r.archetype ? String(r.archetype) : undefined,
    location: r.location ? String(r.location) : undefined,
    strengthScore: typeof r.strengthScore === 'number' ? r.strengthScore : undefined,
    strengthLabel: r.strengthLabel ? String(r.strengthLabel) : undefined,
    engagementTier: r.engagementTier ? String(r.engagementTier) : undefined,
    vibeTags: optionalStringArray(r.vibeTags, 6),
    contentTags: optionalStringArray(r.contentTags, 8),
    colorPalette: optionalStringArray(r.colorPalette, 4),
    aesthetic: r.aesthetic ? String(r.aesthetic) : undefined,
    lifestyle: r.lifestyle ? String(r.lifestyle) : undefined,
    feedSummary: r.feedSummary ? String(r.feedSummary) : undefined,
    recentCaptions: optionalStringArray(r.recentCaptions, 6),
    scrapedAt: String(r.scrapedAt ?? new Date(0).toISOString()),
    email: optionalString(r.email),
    phone: optionalString(r.phone),
    rates: optionalString(r.rates),
    notes: optionalString(r.notes),
    tags: optionalString(r.tags),
    custom_fields: optionalCustomFields(r.custom_fields),
  };
}
