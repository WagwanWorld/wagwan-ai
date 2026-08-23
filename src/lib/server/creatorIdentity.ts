import { normalizeIgHandle } from './marketplace/creatorInviteUtils';

export function profileInstagramUsername(profileData: Record<string, unknown>): string | null {
  const identity = profileData.instagramIdentity;
  if (!identity || typeof identity !== 'object') return null;

  const raw =
    (identity as Record<string, unknown>).username ?? (identity as Record<string, unknown>).handle;
  return typeof raw === 'string' ? normalizeIgHandle(raw) : null;
}
