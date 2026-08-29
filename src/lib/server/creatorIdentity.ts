import { normalizeIgHandle } from '$lib/server/marketplace/creatorInviteUtils';

export function getProfileInstagramUsername(profileData: Record<string, unknown>): string | null {
  const instagramIdentity = profileData.instagramIdentity;
  if (!instagramIdentity || typeof instagramIdentity !== 'object') return null;

  const rawUsername = (instagramIdentity as Record<string, unknown>).username;
  if (typeof rawUsername !== 'string') return null;

  return normalizeIgHandle(rawUsername);
}
