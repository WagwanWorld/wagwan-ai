import type { UserProfileRow } from './supabase';

export function normalizeInstagramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .split(/[/?#]/)[0]
    .toLowerCase();
  return normalized || null;
}

export function getProfileInstagramUsername(
  profile: Pick<UserProfileRow, 'profile_data'>,
): string | null {
  const profileData = profile.profile_data ?? {};
  const instagramIdentity = profileData.instagramIdentity;
  if (!instagramIdentity || typeof instagramIdentity !== 'object') return null;
  return normalizeInstagramUsername((instagramIdentity as Record<string, unknown>).username);
}
