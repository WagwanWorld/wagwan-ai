export type CreatorAuthProfile = {
  google_sub: string;
};

export type CreatorAuthDeps<TProfile extends CreatorAuthProfile> = {
  isWagwanAuthConfigured: () => boolean;
  extractWagwanUserId: (request: Request) => string | null;
  getProfileByWagwanId: (wagwanUserId: string) => Promise<TProfile | null>;
};

export type CreatorAuthResult<TProfile extends CreatorAuthProfile> =
  | { ok: true; wagwanUserId: string; googleSub: string; profile: TProfile }
  | { ok: false; status: number; error: string };

export async function resolveAuthenticatedCreatorProfile<TProfile extends CreatorAuthProfile>(
  request: Request,
  requestedGoogleSub: string | null | undefined,
  deps: CreatorAuthDeps<TProfile>,
): Promise<CreatorAuthResult<TProfile>> {
  if (!deps.isWagwanAuthConfigured()) {
    return { ok: false, status: 503, error: 'wagwan_auth_not_configured' };
  }

  const wagwanUserId = deps.extractWagwanUserId(request);
  if (!wagwanUserId) {
    return { ok: false, status: 401, error: 'invalid_or_missing_token' };
  }

  const profile = await deps.getProfileByWagwanId(wagwanUserId);
  if (!profile) {
    return { ok: false, status: 403, error: 'creator_profile_not_linked' };
  }

  const requested = requestedGoogleSub?.trim();
  if (requested && requested !== profile.google_sub) {
    return { ok: false, status: 403, error: 'google_sub_mismatch' };
  }

  return { ok: true, wagwanUserId, googleSub: profile.google_sub, profile };
}
