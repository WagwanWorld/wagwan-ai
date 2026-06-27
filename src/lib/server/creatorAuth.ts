import { error } from '@sveltejs/kit';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { getProfileByWagwanId } from '$lib/server/supabase';
import { fetchInstagramProfile } from '$lib/server/instagram';

type CreatorAuthBody = {
  googleSub?: unknown;
  googleAccessToken?: unknown;
  instagramToken?: unknown;
};

type GoogleUserInfo = {
  sub?: string;
};

function bearerToken(request: Request): string {
  const authHeader = request.headers.get('Authorization') ?? '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function verifyGoogleAccessToken(token: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GoogleUserInfo;
    return data.sub?.trim() || null;
  } catch {
    return null;
  }
}

async function tokenMatchesClaimedCreator(
  request: Request,
  claimedGoogleSub: string,
  body: CreatorAuthBody,
): Promise<boolean> {
  const token = bearerToken(request);

  if (token && isWagwanAuthConfigured()) {
    const wagwanUserId = extractWagwanUserId(request);
    if (wagwanUserId) {
      const profile = await getProfileByWagwanId(wagwanUserId);
      if (profile?.google_sub === claimedGoogleSub) return true;
    }
  }

  const googleAccessToken =
    typeof body.googleAccessToken === 'string' ? body.googleAccessToken.trim() : '';
  if (googleAccessToken) {
    const googleSub = await verifyGoogleAccessToken(googleAccessToken);
    if (googleSub === claimedGoogleSub) return true;
  }

  const instagramToken = typeof body.instagramToken === 'string' ? body.instagramToken.trim() : '';
  if (instagramToken) {
    try {
      const profile = await fetchInstagramProfile(instagramToken);
      const id = profile.id?.trim();
      const username = profile.username?.trim().toLowerCase();
      if (id && claimedGoogleSub === `ig:${id}`) return true;
      if (username && claimedGoogleSub === `ig:user:${username}`) return true;
    } catch {
      return false;
    }
  }

  return false;
}

export async function assertCreatorAccount(
  request: Request,
  claimedGoogleSub: string,
  body: CreatorAuthBody,
): Promise<void> {
  if (!claimedGoogleSub) {
    throw error(400, 'googleSub is required');
  }

  if (!(await tokenMatchesClaimedCreator(request, claimedGoogleSub, body))) {
    throw error(401, 'Creator authentication required');
  }
}
