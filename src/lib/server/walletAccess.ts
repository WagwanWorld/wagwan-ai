import { extractWagwanUserId, isWagwanAuthConfigured } from './wagwanAuth';
import { getProfileByWagwanId } from './supabase';
import { isWalletSubjectAuthorized } from './walletAccessRules';

type WalletAccessOk = { ok: true };
type WalletAccessDenied = { ok: false; status: 401 | 403 | 503; error: string };

export type WalletAccessResult = WalletAccessOk | WalletAccessDenied;

/**
 * Wallet mutations use the service-role Supabase client, so the endpoint must
 * bind the requested ledger subject to the authenticated Wagwan account first.
 */
export async function authorizeWalletMutation(
  request: Request,
  requestedGoogleSub: string,
): Promise<WalletAccessResult> {
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

  if (!isWalletSubjectAuthorized(profile.google_sub, requestedGoogleSub)) {
    return { ok: false, status: 403, error: 'wallet_subject_mismatch' };
  }

  return { ok: true };
}
