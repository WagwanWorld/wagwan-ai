import { normalizeIgHandle } from '$lib/server/marketplace/creatorInviteUtils';

export function extractProfileInstagramUsername(
  profileData: Record<string, unknown>,
): string | null {
  const instagramIdentity = profileData.instagramIdentity;
  if (!instagramIdentity || typeof instagramIdentity !== 'object') return null;

  const username = (instagramIdentity as Record<string, unknown>).username;
  if (typeof username !== 'string') return null;

  return normalizeIgHandle(username);
}
