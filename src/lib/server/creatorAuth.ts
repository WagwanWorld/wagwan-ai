import { json } from '@sveltejs/kit';
import type { UserProfileRow } from '$lib/server/supabase';
import { getProfileByWagwanId, isSupabaseConfigured } from '$lib/server/supabase';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { extractProfileInstagramUsername } from '$lib/server/creatorAuthUtils';

export interface AuthenticatedCreator {
  wagwanUserId: string;
  googleSub: string;
  profile: UserProfileRow;
  instagramUsername: string | null;
}

export type CreatorAuthResult =
  | { ok: true; creator: AuthenticatedCreator }
  | { ok: false; response: Response };

export async function requireAuthenticatedCreator(request: Request): Promise<CreatorAuthResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      response: json({ ok: false, error: 'supabase_not_configured' }, { status: 503 }),
    };
  }
  if (!isWagwanAuthConfigured()) {
    return {
      ok: false,
      response: json({ ok: false, error: 'wagwan_auth_not_configured' }, { status: 503 }),
    };
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return {
      ok: false,
      response: json({ ok: false, error: 'invalid_or_missing_token' }, { status: 401 }),
    };
  }

  const profile = await getProfileByWagwanId(wagwanUserId);
  if (!profile) {
    return {
      ok: false,
      response: json({ ok: false, error: 'profile_not_linked' }, { status: 404 }),
    };
  }

  return {
    ok: true,
    creator: {
      wagwanUserId,
      googleSub: profile.google_sub,
      profile,
      instagramUsername: extractProfileInstagramUsername(profile.profile_data ?? {}),
    },
  };
}
