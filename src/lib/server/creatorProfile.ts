import type { UserProfileRow } from '$lib/server/supabase';

export function getCreatorInstagramUsername(profile: UserProfileRow): string | null {
  const profileData = (profile.profile_data ?? {}) as Record<string, unknown>;
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  const username = String(instagramIdentity?.username ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();

  return username || null;
}
