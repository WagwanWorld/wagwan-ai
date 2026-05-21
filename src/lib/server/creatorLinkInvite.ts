import { normalizeIgHandle } from './marketplace/creatorInviteUtils';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function instagramHandleFromProfileData(profileData: unknown): string | null {
  const profile = asRecord(profileData);
  const instagramIdentity = asRecord(profile?.instagramIdentity);
  const candidates = [instagramIdentity?.username, instagramIdentity?.handle, profile?.instagramUsername];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const handle = normalizeIgHandle(candidate);
    if (handle) return handle;
  }

  return null;
}

export function profileMatchesRosterInstagram(profileData: unknown, rosterIgUsername: string): boolean {
  const profileHandle = instagramHandleFromProfileData(profileData);
  const rosterHandle = normalizeIgHandle(rosterIgUsername);
  return Boolean(profileHandle && rosterHandle && profileHandle === rosterHandle);
}
