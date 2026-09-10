import { normalizeIgHandle } from '$lib/server/marketplace/creatorInviteUtils';

export function extractCreatorInstagramUsername(
  profileData: Record<string, unknown> | null | undefined,
): string | null {
  const instagramIdentity = profileData?.instagramIdentity as Record<string, unknown> | undefined;
  const raw = instagramIdentity?.username;
  if (typeof raw !== 'string') return null;
  return normalizeIgHandle(raw);
}
