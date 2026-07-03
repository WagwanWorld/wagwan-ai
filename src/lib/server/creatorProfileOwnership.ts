import type { UserProfileRow } from '$lib/server/supabase';

export function instagramUsernameForProfile(profile: UserProfileRow): string | null {
  const profileData = (profile.profile_data ?? {}) as Record<string, unknown>;
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  const username = instagramIdentity?.username;
  return typeof username === 'string' && username.trim() ? username.trim().toLowerCase() : null;
}

export function profileOwnsInstagramHandle(
  profile: UserProfileRow,
  handle: string | null | undefined,
): boolean {
  const expected = instagramUsernameForProfile(profile);
  const actual = typeof handle === 'string' ? handle.trim().replace(/^@+/, '').toLowerCase() : '';
  return Boolean(expected && actual && expected === actual);
}
