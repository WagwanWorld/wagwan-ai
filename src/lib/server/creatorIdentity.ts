import type { UserProfileRow } from '$lib/server/supabase';

export function normalizeCreatorInstagramUsername(input: unknown): string | null {
  const raw = String(input ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  return raw || null;
}

export function instagramUsernameFromProfile(profile: UserProfileRow | null): string | null {
  const profileData = profile?.profile_data ?? {};
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeCreatorInstagramUsername(instagramIdentity?.username);
}
