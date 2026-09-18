import { normalizeIgHandle } from '$lib/server/marketplace/creatorInviteUtils';

export function instagramUsernameFromProfileData(
  profileData: Record<string, unknown> | null | undefined,
): string | null {
  const ig = profileData?.instagramIdentity as Record<string, unknown> | undefined;
  const candidates = [
    ig?.username,
    ig?.handle,
    ig?.igUsername,
    profileData?.instagramUsername,
    profileData?.igUsername,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = normalizeIgHandle(candidate);
    if (normalized) return normalized;
  }

  return null;
}
