import type { UserProfileRow } from '$lib/server/supabase';

export function normalizeInstagramUsername(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function profileInstagramUsername(profile: Pick<UserProfileRow, 'profile_data'>): string {
  const profileData = (profile.profile_data ?? {}) as Record<string, unknown>;
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeInstagramUsername(instagramIdentity?.username);
}
