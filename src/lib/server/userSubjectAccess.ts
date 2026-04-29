import { extractWagwanUserId, isWagwanAuthConfigured } from './wagwanAuth';
import { getProfileByWagwanId } from './supabase';
import { isUserSubjectAuthorized } from './userSubjectAccessRules';

type UserSubjectAccessOk = { ok: true };
type UserSubjectAccessDenied = { ok: false; status: 401 | 403 | 503; error: string };

export type UserSubjectAccessResult = UserSubjectAccessOk | UserSubjectAccessDenied;

/**
 * Service-role user mutations must be bound to the profile linked to the
 * authenticated Wagwan account; request-body subjects are otherwise spoofable.
 */
export async function authorizeUserSubjectMutation(
  request: Request,
  requestedGoogleSub: string,
): Promise<UserSubjectAccessResult> {
  if (!isWagwanAuthConfigured()) {
    return { ok: false, status: 503, error: 'wagwan_auth_not_configured' };
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return { ok: false, status: 401, error: 'invalid_or_missing_token' };
  }

  const profile = await getProfileByWagwanId(wagwanUserId);
  if (!profile) {
    return { ok: false, status: 403, error: 'profile_not_linked' };
  }

  if (!isUserSubjectAuthorized(profile.google_sub, requestedGoogleSub)) {
    return { ok: false, status: 403, error: 'user_subject_mismatch' };
  }

  return { ok: true };
}
