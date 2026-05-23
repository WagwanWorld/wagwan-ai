import { normalizeIgHandle } from '$lib/server/marketplace/creatorInviteUtils';

export type InviteLinkValidationError =
  | 'invalid_roster_handle'
  | 'creator_instagram_missing'
  | 'instagram_mismatch'
  | 'roster_already_linked';

export type InviteLinkValidationResult =
  | { ok: true; normalizedHandle: string }
  | { ok: false; error: InviteLinkValidationError };

export function instagramHandleFromProfileData(profileData: unknown): string | null {
  if (!profileData || typeof profileData !== 'object') return null;
  const data = profileData as Record<string, unknown>;
  const ig = data.instagramIdentity;
  if (!ig || typeof ig !== 'object') return null;
  const username = (ig as Record<string, unknown>).username;
  return typeof username === 'string' ? normalizeIgHandle(username) : null;
}

export function validateCreatorInviteLink(input: {
  creatorGoogleSub: string;
  creatorProfileData: unknown;
  rosterIgUsername: string;
  rosterUserGoogleSub: string | null;
}): InviteLinkValidationResult {
  const rosterHandle = normalizeIgHandle(input.rosterIgUsername);
  if (!rosterHandle) return { ok: false, error: 'invalid_roster_handle' };

  const creatorHandle = instagramHandleFromProfileData(input.creatorProfileData);
  if (!creatorHandle) return { ok: false, error: 'creator_instagram_missing' };
  if (creatorHandle !== rosterHandle) return { ok: false, error: 'instagram_mismatch' };

  const existingSub = input.rosterUserGoogleSub?.trim();
  if (existingSub && existingSub !== input.creatorGoogleSub) {
    return { ok: false, error: 'roster_already_linked' };
  }

  return { ok: true, normalizedHandle: creatorHandle };
}
