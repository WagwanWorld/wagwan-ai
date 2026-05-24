import { normalizeIgHandle } from '$lib/server/marketplace/creatorInvite';

type RosterLinkValidation =
  | { ok: true; alreadyLinked: boolean }
  | { ok: false; status: number; error: string };

export function validateRosterLinkback(input: {
  googleSub: string;
  rosterIgUsername: string | null;
  existingUserGoogleSub: string | null;
  verifiedIgUsername: string | null;
}): RosterLinkValidation {
  if (input.existingUserGoogleSub) {
    return input.existingUserGoogleSub === input.googleSub
      ? { ok: true, alreadyLinked: true }
      : { ok: false, status: 409, error: 'invite_already_linked' };
  }

  const expected = input.rosterIgUsername ? normalizeIgHandle(input.rosterIgUsername) : null;
  const verified = input.verifiedIgUsername ? normalizeIgHandle(input.verifiedIgUsername) : null;
  if (!expected || !verified) {
    return { ok: false, status: 401, error: 'instagram_verification_required' };
  }
  if (expected !== verified) {
    return { ok: false, status: 403, error: 'invite_identity_mismatch' };
  }

  return { ok: true, alreadyLinked: false };
}
