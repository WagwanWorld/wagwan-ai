import type { InstagramIdentity } from '$lib/server/instagram';
import type { GoogleIdentity } from '$lib/utils';
import type { UserProfile } from '$lib/stores/profile';

export type AccountKeyOAuthState = {
  googleConnected: boolean;
  googleIdentity: GoogleIdentity | null;
  igConnected: boolean;
  igIdentity: InstagramIdentity | null;
};

/** Prefer Google `sub` when connected; else Instagram `ig:<id>` or legacy `ig:user:<username>`. */
export function primaryAccountKeyFromOAuthState(s: AccountKeyOAuthState): string {
  if (s.googleConnected && s.googleIdentity?.sub?.trim()) {
    return s.googleIdentity.sub.trim();
  }
  if (s.igConnected && s.igIdentity) {
    const id = s.igIdentity.igUserId?.trim();
    if (id) return `ig:${id}`;
    const u = s.igIdentity.username?.trim();
    if (u) return `ig:user:${u.toLowerCase()}`;
  }
  return '';
}

export function primaryAccountKey(
  p: Pick<UserProfile, 'googleConnected' | 'googleIdentity' | 'instagramConnected' | 'instagramIdentity'>,
): string {
  return primaryAccountKeyFromOAuthState({
    googleConnected: p.googleConnected,
    googleIdentity: p.googleIdentity,
    igConnected: p.instagramConnected,
    igIdentity: p.instagramIdentity,
  });
}
